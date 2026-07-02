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

