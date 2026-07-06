from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from posts.models import Post
from accounts.models import BlockedUser
from .models import Hashtag, PostHashtag
from .tasks import recalculate_trending_hashtags

User = get_user_model()

class HashtagsModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="alice", email="alice@example.com", password="password123")
        self.post = Post.objects.create(author=self.user, content="This is an awesome post #tech", post_type="text")

    def test_hashtag_creation(self):
        hashtag = Hashtag.objects.create(name="tech2")
        self.assertEqual(hashtag.name, "tech2")
        self.assertEqual(hashtag.post_count, 0)

        association = PostHashtag.objects.create(post=self.post, hashtag=hashtag)
        self.assertEqual(association.post, self.post)
        self.assertEqual(association.hashtag, hashtag)

class HashtagsAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="tagger",
            email="tagger@example.com",
            password="Password123!",
            is_active=True
        )
        self.client.force_authenticate(user=self.user)

        self.other_user = User.objects.create_user(
            username="blockeduser",
            email="blockeduser@example.com",
            password="Password123!",
            is_active=True
        )

        # Create hashtags and posts
        self.tag_news = Hashtag.objects.create(name="news")
        self.tag_nature = Hashtag.objects.create(name="nature")

        self.post1 = Post.objects.create(
            author=self.user,
            content="Today's top #news update",
            post_type="text"
        )

        self.post2 = Post.objects.create(
            author=self.other_user,
            content="Beautiful #nature picture",
            post_type="text"
        )

    def test_hashtag_prefix_search(self):
        # Search starting with 'ne' -> returns 'news', not 'nature'
        res = self.client.get("/api/v1/hashtags/search/?q=ne")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["name"], "news")

        # Empty search query -> returns []
        res = self.client.get("/api/v1/hashtags/search/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, [])

    def test_hashtag_detail_and_blocking_exclusions(self):
        # Retrieve detail for #nature
        res = self.client.get(f"/api/v1/hashtags/nature/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["hashtag"]["name"], "nature")
        self.assertEqual(res.data["posts"]["count"], 1)

        # block other_user who created the #nature post
        BlockedUser.objects.create(blocker=self.user, blocked=self.other_user)

        res = self.client.get(f"/api/v1/hashtags/nature/")
        self.assertEqual(res.status_code, 200)
        # Should now be empty because the author is blocked
        self.assertEqual(res.data["posts"]["count"], 0)

    def test_trending_hashtags_caching_and_aggregation(self):
        # Verify Celery task runs and populates the cache
        result = recalculate_trending_hashtags()
        self.assertTrue(len(result) > 0)

        # GET trending endpoint
        res = self.client.get("/api/v1/hashtags/trending/")
        self.assertEqual(res.status_code, 200)
        # Verify new dictionary structure is returned
        self.assertIn("hashtags", res.data)
        self.assertIn("topics", res.data)
        self.assertIn("country", res.data)
        self.assertTrue(len(res.data["hashtags"]) >= 2)

    def test_discover_suggestions_api(self):
        res = self.client.get("/api/v1/users/suggestions/discover/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("popular", res.data)
        self.assertIn("new_users", res.data)
        self.assertIn("network", res.data)

    def test_hard_deletion_signals_sync_counts(self):
        # Initial post_count of #news is 1
        self.tag_news.refresh_from_db()
        self.assertEqual(self.tag_news.post_count, 1)

        # Hard delete post1
        self.post1.delete()

        # Count should drop to 0
        self.tag_news.refresh_from_db()
        self.assertEqual(self.tag_news.post_count, 0)
