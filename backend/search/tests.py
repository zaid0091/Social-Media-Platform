from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from django_redis import get_redis_connection

from accounts.models import BlockedUser, Follow
from posts.models import Post
from hashtags.models import Hashtag

User = get_user_model()

class SearchSystemAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="searcher",
            email="searcher@example.com",
            password="Password123!",
            is_active=True
        )
        self.client.force_authenticate(user=self.user)

        self.target_1 = User.objects.create_user(
            username="john_doe",
            full_name="John Doe",
            bio="Python developer and Django fan",
            email="doe@example.com",
            password="Password123!",
            follower_count=100
        )

        self.target_2 = User.objects.create_user(
            username="johnny_smith",
            full_name="Johnny Smith",
            bio="Writer and foodie",
            email="johnny@example.com",
            password="Password123!",
            follower_count=50
        )

        self.target_blocked = User.objects.create_user(
            username="john_blocked",
            full_name="John Blocked",
            bio="Blocked user",
            email="blocked@example.com",
            password="Password123!",
            follower_count=10
        )
        BlockedUser.objects.create(blocker=self.user, blocked=self.target_blocked)

        self.tag_django = Hashtag.objects.create(name="django", post_count=20)
        self.tag_python = Hashtag.objects.create(name="python", post_count=50)

        self.post_public = Post.objects.create(
            author=self.target_1,
            content="Building a search engine with #python and #django",
            privacy="public"
        )
        Hashtag.objects.filter(name="python").update(post_count=50)
        Hashtag.objects.filter(name="django").update(post_count=20)

        self.post_followers = Post.objects.create(
            author=self.target_2,
            content="Enjoying some food in the city",
            privacy="followers"
        )

        self.post_private = Post.objects.create(
            author=self.target_2,
            content="Secret thoughts",
            privacy="private"
        )

        r = get_redis_connection("default")
        r.delete(f"search_history:{self.user.id}")

    def tearDown(self):
        r = get_redis_connection("default")
        r.delete(f"search_history:{self.user.id}")

    def test_user_search_trigram_and_blocks(self):
        res = self.client.get("/api/v1/search/users/?q=john")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 2)

        self.assertEqual(res.data["results"][0]["username"], "john_doe")
        self.assertEqual(res.data["results"][1]["username"], "johnny_smith")

        self.assertNotIn("john_blocked", [u["username"] for u in res.data["results"]])

    def test_post_search_privacy_and_blocks(self):
        res = self.client.get("/api/v1/search/posts/?q=python")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 1)
        self.assertEqual(res.data["results"][0]["id"], str(self.post_public.id))

        res = self.client.get("/api/v1/search/posts/?q=food")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 0)

        Follow.objects.create(follower=self.user, following=self.target_2)
        res = self.client.get("/api/v1/search/posts/?q=food")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 1)

        res = self.client.get("/api/v1/search/posts/?q=secret")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 0)

    def test_hashtag_search_and_ranking(self):
        res = self.client.get("/api/v1/search/hashtags/?q=py")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 1)
        self.assertEqual(res.data["results"][0]["name"], "python")

    def test_global_search(self):
        res = self.client.get("/api/v1/search/global/?q=django")
        self.assertEqual(res.status_code, 200)
        self.assertIn("users", res.data)
        self.assertIn("hashtags", res.data)
        self.assertEqual(len(res.data["users"]), 1)
        self.assertEqual(len(res.data["hashtags"]), 1)

    def test_search_history_redis(self):
        import time
        self.client.get("/api/v1/search/users/?q=python")
        time.sleep(0.05)
        self.client.get("/api/v1/search/users/?q=django")

        res = self.client.get("/api/v1/search/recent/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["recent_searches"], ["django", "python"])

        res = self.client.post("/api/v1/search/clear/")
        self.assertEqual(res.status_code, 200)

        res = self.client.get("/api/v1/search/recent/")
        self.assertEqual(res.data["recent_searches"], [])

    def test_suggested_search(self):
        res = self.client.get("/api/v1/search/suggested/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("suggested_hashtags", res.data)
        self.assertIn("suggested_users", res.data)
        self.assertEqual(res.data["suggested_hashtags"][0]["name"], "python")
        self.assertEqual(res.data["suggested_hashtags"][1]["name"], "django")
        self.assertEqual(res.data["suggested_users"][0]["username"], "john_doe")
