from accounts.models import BlockedUser
from django.db import IntegrityError
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from .models import Post, PostMedia, Comment, Like, Bookmark, PostShare, PostView

User = get_user_model()

class PostsModelTests(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            username="alice",
            email="alice@example.com",
            password="password123"
        )
        self.user2 = User.objects.create_user(
            username="bob",
            email="bob@example.com",
            password="password456"
        )
        
        # Create a base post
        self.post = Post.objects.create(
            author=self.user1,
            content="Hello world! This is my first post.",
            post_type="text",
            privacy="public"
        )

    def test_post_creation(self):
        self.assertEqual(self.post.author, self.user1)
        self.assertEqual(self.post.content, "Hello world! This is my first post.")
        self.assertEqual(self.post.post_type, "text")
        self.assertEqual(self.post.privacy, "public")
        self.assertEqual(self.post.like_count, 0)
        self.assertFalse(self.post.is_deleted)

    def test_post_media_creation(self):
        media = PostMedia.objects.create(
            post=self.post,
            media_url="https://res.cloudinary.com/demo/image/upload/sample.jpg",
            media_type="image",
            order=1
        )
        self.assertEqual(media.post, self.post)
        self.assertEqual(media.media_url, "https://res.cloudinary.com/demo/image/upload/sample.jpg")
        self.assertEqual(media.media_type, "image")
        self.assertEqual(media.order, 1)

    def test_comment_and_replies(self):
        # Top-level comment
        comment = Comment.objects.create(
            post=self.post,
            author=self.user2,
            content="Great post, Alice!"
        )
        self.assertEqual(comment.post, self.post)
        self.assertEqual(comment.author, self.user2)
        self.assertIsNone(comment.parent)
        self.assertEqual(comment.content, "Great post, Alice!")

        # Reply to comment
        reply = Comment.objects.create(
            post=self.post,
            author=self.user1,
            parent=comment,
            content="Thanks, Bob!"
        )
        self.assertEqual(reply.parent, comment)
        self.assertEqual(reply.content, "Thanks, Bob!")
        self.assertIn(reply, comment.replies.all())

    def test_generic_likes(self):
        post_ct = ContentType.objects.get_for_model(Post)
        comment_ct = ContentType.objects.get_for_model(Comment)

        # Alice likes Bob's comment (let's create it first)
        comment = Comment.objects.create(
            post=self.post,
            author=self.user2,
            content="Awesome!"
        )

        # Like a Post
        like_post = Like.objects.create(
            user=self.user2,
            content_type=post_ct,
            object_id=self.post.id
        )
        self.assertEqual(like_post.content_object, self.post)

        # Like a Comment
        like_comment = Like.objects.create(
            user=self.user1,
            content_type=comment_ct,
            object_id=comment.id
        )
        self.assertEqual(like_comment.content_object, comment)

        # Unique constraint test: user cannot like the same post twice
        with self.assertRaises(IntegrityError):
            Like.objects.create(
                user=self.user2,
                content_type=post_ct,
                object_id=self.post.id
            )

    def test_bookmark(self):
        bookmark = Bookmark.objects.create(user=self.user2, post=self.post)
        self.assertEqual(bookmark.user, self.user2)
        self.assertEqual(bookmark.post, self.post)

        # Unique constraint test
        with self.assertRaises(IntegrityError):
            Bookmark.objects.create(user=self.user2, post=self.post)

    def test_share_and_views(self):
        # Share
        share = PostShare.objects.create(user=self.user2, post=self.post)
        self.assertEqual(share.user, self.user2)
        self.assertEqual(share.post, self.post)

        # View
        view = PostView.objects.create(user=self.user2, post=self.post)
        self.assertEqual(view.user, self.user2)
        self.assertEqual(view.post, self.post)

from rest_framework.test import APIClient
from accounts.models import Follow, BlockedUser

class PostsAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="charlie",
            email="charlie@example.com",
            password="Password123!",
            is_active=True
        )
        self.client.force_authenticate(user=self.user)

        self.private_user = User.objects.create_user(
            username="privateuser",
            email="private@example.com",
            password="Password123!",
            is_active=True,
            is_private=True
        )

    def test_post_creation_and_hashtag_extraction(self):
        post_data = {
            "content": "Hello, this is a test post #first #test",
            "privacy": "public",
            "post_type": "text"
        }
        res = self.client.post("/api/v1/posts/", post_data, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["content"], "Hello, this is a test post #first #test")
        self.assertEqual(len(res.data["hashtags"]), 2)
        self.assertIn("first", res.data["hashtags"])
        self.assertIn("test", res.data["hashtags"])

        # Check signals updated user post count
        self.user.refresh_from_db()
        self.assertEqual(self.user.post_count, 1)

    def test_post_edit_and_hashtag_recalculation(self):
        # Create initial post
        post = Post.objects.create(author=self.user, content="Hello #first", post_type="text")
        
        # Verify initial hashtag
        res = self.client.get(f"/api/v1/posts/{post.id}/")
        self.assertEqual(len(res.data["hashtags"]), 1)

        # Update post to have different hashtags
        update_data = {"content": "Hello #second #third"}
        res = self.client.patch(f"/api/v1/posts/{post.id}/update/", update_data, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["hashtags"]), 2)
        self.assertNotIn("first", res.data["hashtags"])
        self.assertIn("second", res.data["hashtags"])

    def test_post_soft_deletion(self):
        post = Post.objects.create(author=self.user, content="To be deleted", post_type="text")
        self.user.refresh_from_db()
        self.assertEqual(self.user.post_count, 1)

        # Delete post
        res = self.client.delete(f"/api/v1/posts/{post.id}/delete/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["message"], "Post successfully deleted.")

        # Verify soft deleted in DB
        post.refresh_from_db()
        self.assertTrue(post.is_deleted)

        # Verify signals decremented post count
        self.user.refresh_from_db()
        self.assertEqual(self.user.post_count, 0)

        # Verify detail view returns 404
        res = self.client.get(f"/api/v1/posts/{post.id}/")
        self.assertEqual(res.status_code, 404)

    def test_private_profile_feed_privacy(self):
        # Create private user post
        post = Post.objects.create(author=self.private_user, content="Private post", post_type="text")

        # Requester is not following private user -> returns 403 Forbidden
        res = self.client.get(f"/api/v1/posts/{post.id}/")
        self.assertEqual(res.status_code, 403)

        res = self.client.get(f"/api/v1/users/{self.private_user.id}/posts/")
        self.assertEqual(res.status_code, 403)

        # Add follow relationship
        Follow.objects.create(follower=self.user, following=self.private_user)

        res = self.client.get(f"/api/v1/posts/{post.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["content"], "Private post")


from unittest.mock import patch
from django.core.files.uploadedfile import SimpleUploadedFile

class PostMediaUploadTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="uploader",
            email="uploader@example.com",
            password="Password123!",
            is_active=True
        )
        self.client.force_authenticate(user=self.user)

    @patch('cloudinary.uploader.upload')
    def test_single_image_upload_success(self, mock_upload):
        # Setup mock return value
        mock_upload.return_value = {
            "secure_url": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
            "public_id": "sample_image_id",
            "resource_type": "image"
        }

        # Create a small valid mock image file
        image_file = SimpleUploadedFile(
            "test_image.png",
            b"fake_image_binary_data",
            content_type="image/png"
        )

        res = self.client.post(
            "/api/v1/posts/upload-media/",
            {"files": [image_file]},
            format="multipart"
        )

        self.assertEqual(res.status_code, 201)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["media_url"], "https://res.cloudinary.com/demo/image/upload/sample.jpg")
        self.assertEqual(res.data[0]["media_type"], "image")
        self.assertEqual(res.data[0]["public_id"], "sample_image_id")
        self.assertIsNone(res.data[0]["thumbnail_url"])

    @patch('cloudinary.uploader.upload')
    def test_multiple_media_and_video_upload_success(self, mock_upload):
        # Configure side effect for multiple uploads (1 image, 1 video)
        mock_upload.side_effect = [
            {
                "secure_url": "https://res.cloudinary.com/demo/image/upload/sample2.jpg",
                "public_id": "sample_image_id_2",
                "resource_type": "image"
            },
            {
                "secure_url": "https://res.cloudinary.com/demo/video/upload/sample_video.mp4",
                "public_id": "sample_video_id",
                "resource_type": "video"
            }
        ]

        image_file = SimpleUploadedFile("pic.jpg", b"imagebytes", content_type="image/jpeg")
        video_file = SimpleUploadedFile("movie.mp4", b"videobytes", content_type="video/mp4")

        res = self.client.post(
            "/api/v1/posts/upload-media/",
            {"files": [image_file, video_file]},
            format="multipart"
        )

        self.assertEqual(res.status_code, 201)
        self.assertEqual(len(res.data), 2)
        
        # Verify first item (image)
        self.assertEqual(res.data[0]["media_type"], "image")
        self.assertEqual(res.data[0]["public_id"], "sample_image_id_2")

        # Verify second item (video with auto-generated thumbnail)
        self.assertEqual(res.data[1]["media_type"], "video")
        self.assertEqual(res.data[1]["public_id"], "sample_video_id")
        self.assertIsNotNone(res.data[1]["thumbnail_url"])
        self.assertIn("sample_video_id.jpg", res.data[1]["thumbnail_url"])

    def test_image_size_limit_exceeded(self):
        # Create a mock image file that exceeds 10MB limit (e.g. 11MB)
        large_bytes = b"0" * (11 * 1024 * 1024)
        large_file = SimpleUploadedFile("huge.png", large_bytes, content_type="image/png")

        res = self.client.post(
            "/api/v1/posts/upload-media/",
            {"files": [large_file]},
            format="multipart"
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("size exceeds", res.data["error"])

    def test_unsupported_file_format(self):
        # Create a mock text file
        text_file = SimpleUploadedFile("doc.txt", b"plain text", content_type="text/plain")

        res = self.client.post(
            "/api/v1/posts/upload-media/",
            {"files": [text_file]},
            format="multipart"
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Unsupported file type", res.data["error"])


class PostLikesAndBookmarksAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="liker",
            email="liker@example.com",
            password="Password123!",
            is_active=True
        )
        self.client.force_authenticate(user=self.user)

        self.post_author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="Password123!",
            is_active=True
        )

        self.post = Post.objects.create(
            author=self.post_author,
            content="This post will be liked #test",
            post_type="text"
        )

        self.comment = Comment.objects.create(
            post=self.post,
            author=self.post_author,
            content="This is a comment to like"
        )

    def test_toggle_like_post_and_signals(self):
        # Like the post
        res = self.client.post(f"/api/v1/posts/like/{self.post.id}/", {"type": "post"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["liked"])
        self.assertEqual(res.data["like_count"], 1)

        # Check Post's cache like count
        self.post.refresh_from_db()
        self.assertEqual(self.post.like_count, 1)

        # Unlike the post
        res = self.client.post(f"/api/v1/posts/like/{self.post.id}/", {"type": "post"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data["liked"])
        self.assertEqual(res.data["like_count"], 0)

        # Check Post's cache like count
        self.post.refresh_from_db()
        self.assertEqual(self.post.like_count, 0)

    def test_toggle_like_comment_and_signals(self):
        # Like the comment via CommentLikeView
        res = self.client.post(f"/api/v1/posts/comment-like/{self.comment.id}/", format="json")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["liked"])
        self.assertEqual(res.data["like_count"], 1)

        # Check Comment's cache like count
        self.comment.refresh_from_db()
        self.assertEqual(self.comment.like_count, 1)

        # Like the comment via LikeView with type parameter
        res = self.client.post(f"/api/v1/posts/like/{self.comment.id}/", {"type": "comment"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data["liked"])
        self.assertEqual(res.data["like_count"], 0)

        # Check Comment's cache like count
        self.comment.refresh_from_db()
        self.assertEqual(self.comment.like_count, 0)

    def test_toggle_bookmark_and_list(self):
        # Bookmark post
        res = self.client.post(f"/api/v1/posts/bookmark/{self.post.id}/", format="json")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["bookmarked"])

        # Check cache bookmark_count on Post
        self.post.refresh_from_db()
        self.assertEqual(self.post.bookmark_count, 1)

        # Retrieve bookmarks list
        res = self.client.get("/api/v1/posts/bookmarks/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 1)
        self.assertEqual(res.data["results"][0]["id"], str(self.post.id))

        # Unbookmark post
        res = self.client.post(f"/api/v1/posts/bookmark/{self.post.id}/", format="json")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data["bookmarked"])

        # Check cache bookmark_count on Post
        self.post.refresh_from_db()
        self.assertEqual(self.post.bookmark_count, 0)

    def test_post_likers_list(self):
        # Like the post
        Like.objects.create(
            user=self.user,
            content_type=ContentType.objects.get_for_model(Post),
            object_id=self.post.id
        )

        res = self.client.get(f"/api/v1/posts/{self.post.id}/likers/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 1)
        self.assertEqual(res.data["results"][0]["username"], "liker")

    def test_rate_limiting_on_likes(self):
        # Trigger rate limit (scope is 30/minute)
        for i in range(30):
            res = self.client.post(f"/api/v1/posts/like/{self.post.id}/", {"type": "post"}, format="json")
            self.assertEqual(res.status_code, 200)

        # The 31st request must trigger 429
        res = self.client.post(f"/api/v1/posts/like/{self.post.id}/", {"type": "post"}, format="json")
        self.assertEqual(res.status_code, 429)


from notifications.models import Notification

class PostCommentsAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="commenter",
            email="commenter@example.com",
            password="Password123!",
            is_active=True
        )
        self.client.force_authenticate(user=self.user)

        self.post_author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="Password123!",
            is_active=True
        )

        self.other_user = User.objects.create_user(
            username="other",
            email="other@example.com",
            password="Password123!",
            is_active=True
        )

        self.post = Post.objects.create(
            author=self.post_author,
            content="Base post for commenting",
            post_type="text"
        )

    def test_comment_creation_and_post_count_signal(self):
        # Post comment
        comment_data = {"content": "This is a root comment"}
        res = self.client.post(f"/api/v1/posts/{self.post.id}/comments/", comment_data, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["content"], "This is a root comment")
        self.assertIsNone(res.data["parent"])
        self.assertEqual(res.data["reply_count"], 0)

        # Check Post's comment count updated to 1
        self.post.refresh_from_db()
        self.assertEqual(self.post.comment_count, 1)

    def test_nested_comments_and_reply_count_signals(self):
        # 1. Create root comment
        root = Comment.objects.create(
            post=self.post,
            author=self.post_author,
            content="Root comment"
        )
        self.post.refresh_from_db()
        self.assertEqual(self.post.comment_count, 1)

        # 2. Create Level 1 reply (nested level 1)
        reply_data_1 = {
            "content": "Level 1 reply to @author",
            "parent": root.id
        }
        res = self.client.post(f"/api/v1/posts/{self.post.id}/comments/", reply_data_1, format="json")
        self.assertEqual(res.status_code, 201)
        reply_1_id = res.data["id"]

        # Check parent's reply_count is updated to 1
        root.refresh_from_db()
        self.assertEqual(root.reply_count, 1)

        # Check Post's comment count is updated to 2
        self.post.refresh_from_db()
        self.assertEqual(self.post.comment_count, 2)

        # 3. Create Level 2 reply (nested level 2 - child of reply 1)
        reply_data_2 = {
            "content": "Level 2 reply to Level 1 reply",
            "parent": reply_1_id
        }
        res = self.client.post(f"/api/v1/posts/{self.post.id}/comments/", reply_data_2, format="json")
        self.assertEqual(res.status_code, 201)
        
        # Check reply_1's reply_count is updated to 1
        reply_1 = Comment.objects.get(id=reply_1_id)
        self.assertEqual(reply_1.reply_count, 1)

        # Check Post's comment count is updated to 3
        self.post.refresh_from_db()
        self.assertEqual(self.post.comment_count, 3)

    def test_comment_validation_across_different_posts(self):
        other_post = Post.objects.create(
            author=self.post_author,
            content="Another post",
            post_type="text"
        )
        root = Comment.objects.create(
            post=self.post,
            author=self.post_author,
            content="Root comment on post 1"
        )
        # Attempt to reply to root comment but on post 2 -> should fail validation
        reply_data = {
            "content": "Invalid reply",
            "parent": root.id
        }
        res = self.client.post(f"/api/v1/posts/{other_post.id}/comments/", reply_data, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("non_field_errors", res.data)

    def test_comments_and_replies_retrieval(self):
        # Create root comments
        c1 = Comment.objects.create(post=self.post, author=self.user, content="Comment 1")
        c2 = Comment.objects.create(post=self.post, author=self.user, content="Comment 2")
        
        # Create a reply to c1
        r1 = Comment.objects.create(post=self.post, author=self.user, parent=c1, content="Reply to 1")

        # Get comment list for post
        res = self.client.get(f"/api/v1/posts/{self.post.id}/comments/")
        self.assertEqual(res.status_code, 200)
        # Should only list top-level comments (c1, c2), not r1
        self.assertEqual(res.data["count"], 2)
        self.assertEqual(res.data["results"][0]["content"], "Comment 2")
        self.assertEqual(res.data["results"][1]["content"], "Comment 1")

        # Get replies for c1
        res = self.client.get(f"/api/v1/posts/comments/{c1.id}/replies/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 1)
        self.assertEqual(res.data["results"][0]["content"], "Reply to 1")

    def test_comment_update_permissions(self):
        comment = Comment.objects.create(post=self.post, author=self.post_author, content="Edit me")

        # commenter attempts to edit author's comment -> 403 Forbidden
        res = self.client.patch(f"/api/v1/posts/comments/{comment.id}/", {"content": "Hacked content"})
        self.assertEqual(res.status_code, 403)

        # Authenticate as author and edit
        self.client.force_authenticate(user=self.post_author)
        res = self.client.patch(f"/api/v1/posts/comments/{comment.id}/", {"content": "Updated content"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["content"], "Updated content")

    def test_comment_soft_delete_and_signals(self):
        comment = Comment.objects.create(post=self.post, author=self.user, content="Delete me")
        self.post.refresh_from_db()
        self.assertEqual(self.post.comment_count, 1)

        # Soft delete comment
        res = self.client.delete(f"/api/v1/posts/comments/{comment.id}/delete/")
        self.assertEqual(res.status_code, 200)
        
        # Verify is_deleted is true in DB
        comment.refresh_from_db()
        self.assertTrue(comment.is_deleted)

        # Check comment_count on Post decremented to 0
        self.post.refresh_from_db()
        self.assertEqual(self.post.comment_count, 0)

    def test_mention_parsing_and_notifications(self):
        # Create comment mentioning "@author" and "@other" and "@nonexistent"
        comment_data = {
            "content": "Hello @author and @other, check this out! Also @nonexistent."
        }
        res = self.client.post(f"/api/v1/posts/{self.post.id}/comments/", comment_data, format="json")
        self.assertEqual(res.status_code, 201)

        # Verify notification created for "author"
        author_notifications = Notification.objects.filter(recipient=self.post_author, notification_type='mention')
        self.assertEqual(author_notifications.count(), 1)
        self.assertEqual(author_notifications.first().sender, self.user)
        self.assertEqual(author_notifications.first().related_post, self.post)

        # Verify notification created for "other"
        other_notifications = Notification.objects.filter(recipient=self.other_user, notification_type='mention')
        self.assertEqual(other_notifications.count(), 1)

        # Verify no notification for nonexistent user
        self.assertFalse(Notification.objects.filter(recipient__username="nonexistent").exists())

    def test_mention_parsing_with_blocks_excluded(self):
        # Block: other user blocks commenter
        BlockedUser.objects.create(blocker=self.other_user, blocked=self.user)

        comment_data = {
            "content": "Hey @author and @other!"
        }
        res = self.client.post(f"/api/v1/posts/{self.post.id}/comments/", comment_data, format="json")
        self.assertEqual(res.status_code, 201)

        # Notification for author should be created
        self.assertTrue(Notification.objects.filter(recipient=self.post_author, notification_type='mention').exists())

        # Notification for other should NOT be created due to block
        self.assertFalse(Notification.objects.filter(recipient=self.other_user, notification_type='mention').exists())


class NewsFeedAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="feed_user",
            email="feed@example.com",
            password="Password123!",
            is_active=True
        )
        self.client.force_authenticate(user=self.user)

        self.followed_1 = User.objects.create_user(
            username="followed1",
            email="f1@example.com",
            password="Password123!",
            is_active=True
        )
        Follow.objects.create(follower=self.user, following=self.followed_1)

        self.followed_2 = User.objects.create_user(
            username="followed2",
            email="f2@example.com",
            password="Password123!",
            is_active=True
        )
        Follow.objects.create(follower=self.user, following=self.followed_2)

        self.unfollowed = User.objects.create_user(
            username="unfollowed",
            email="unfollowed@example.com",
            password="Password123!",
            is_active=True
        )

        self.post_public = Post.objects.create(
            author=self.followed_1,
            content="Followed1 Public Post",
            privacy="public",
            post_type="text"
        )
        self.post_followers = Post.objects.create(
            author=self.followed_1,
            content="Followed1 Followers-only Post",
            privacy="followers",
            post_type="text"
        )
        self.post_private = Post.objects.create(
            author=self.followed_1,
            content="Followed1 Private Post",
            privacy="private",
            post_type="text"
        )

        self.post_f2_public = Post.objects.create(
            author=self.followed_2,
            content="Followed2 Public Post",
            privacy="public",
            post_type="text"
        )

        self.post_unfollowed = Post.objects.create(
            author=self.unfollowed,
            content="Unfollowed Public Post",
            privacy="public",
            post_type="text"
        )

    def test_chronological_feed_privacy_and_graph(self):
        res = self.client.get("/api/v1/posts/feed/?feed_type=chronological")
        self.assertEqual(res.status_code, 200)

        self.assertIn("results", res.data)
        posts_data = res.data["results"]

        self.assertEqual(len(posts_data), 3)

        self.assertEqual(posts_data[0]["id"], str(self.post_f2_public.id))
        self.assertEqual(posts_data[1]["id"], str(self.post_followers.id))
        self.assertEqual(posts_data[2]["id"], str(self.post_public.id))

    def test_feed_block_exclusions(self):
        BlockedUser.objects.create(blocker=self.followed_2, blocked=self.user)

        res = self.client.get("/api/v1/posts/feed/?feed_type=chronological")
        self.assertEqual(res.status_code, 200)
        posts_data = res.data["results"]

        self.assertEqual(len(posts_data), 2)
        self.assertNotIn(str(self.post_f2_public.id), [p["id"] for p in posts_data])

    def test_ranked_feed_and_cache_refresh(self):
        self.post_public.like_count = 10
        self.post_public.comment_count = 5
        self.post_public.save()

        res = self.client.get("/api/v1/posts/feed/?feed_type=ranked")
        self.assertEqual(res.status_code, 200)
        posts_data = res.data["results"]

        self.assertEqual(posts_data[0]["id"], str(self.post_public.id))

        self.post_followers.like_count = 100
        self.post_followers.save()

        res = self.client.get("/api/v1/posts/feed/?feed_type=ranked")
        self.assertEqual(res.data["results"][0]["id"], str(self.post_public.id))

        res = self.client.get("/api/v1/posts/feed/?feed_type=ranked&refresh=true")
        self.assertEqual(res.data["results"][0]["id"], str(self.post_followers.id))






