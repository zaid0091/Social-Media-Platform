from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from unittest.mock import patch
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import Follow, BlockedUser
from .models import Story, StoryView, StoryHighlight
from .tasks import mark_and_cleanup_expired_stories

User = get_user_model()

class StoriesModelTests(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(username="alice", email="alice@example.com", password="password123")
        self.user2 = User.objects.create_user(username="bob", email="bob@example.com", password="password456")

    def test_story_creation_and_expiration(self):
        story = Story.objects.create(
            author=self.user1,
            media_url="https://res.cloudinary.com/demo/image/upload/sample.jpg",
            media_type="image"
        )
        self.assertEqual(story.author, self.user1)
        self.assertEqual(story.media_type, "image")
        self.assertAlmostEqual(
            story.expires_at,
            timezone.now() + timedelta(hours=24),
            delta=timedelta(seconds=10)
        )

    def test_story_view(self):
        story = Story.objects.create(
            author=self.user1,
            media_url="https://res.cloudinary.com/demo/image/upload/sample.jpg",
            media_type="image"
        )
        view = StoryView.objects.create(story=story, viewer=self.user2)
        self.assertEqual(view.story, story)
        self.assertEqual(view.viewer, self.user2)

class StoriesAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="story_creator",
            email="creator@example.com",
            password="Password123!",
            is_active=True
        )
        self.client.force_authenticate(user=self.user)

        self.viewer = User.objects.create_user(
            username="story_viewer",
            email="viewer@example.com",
            password="Password123!",
            is_active=True
        )

        Follow.objects.create(follower=self.viewer, following=self.user)

    @patch('stories.views.upload_file_to_cloudinary')
    def test_story_creation_and_30_limit(self, mock_upload):
        mock_upload.return_value = {
            "secure_url": "https://res.cloudinary.com/demo/image/upload/story.jpg",
            "resource_type": "image"
        }

        # Create valid mock image file
        img_file = SimpleUploadedFile("story.jpg", b"image_binary", content_type="image/jpeg")

        # Test single creation
        res = self.client.post(
            "/api/v1/stories/create/",
            {"media": img_file, "caption": "Morning vibe"},
            format="multipart"
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["caption"], "Morning vibe")
        self.assertEqual(res.data["media_type"], "image")

        # Mocking 29 more active stories to reach the limit of 30
        for i in range(29):
            Story.objects.create(
                author=self.user,
                media_url=f"https://res.cloudinary.com/demo/image/upload/story_{i}.jpg",
                media_type="image"
            )

        # Attempt to create the 31st active story -> should fail with 400
        res = self.client.post(
            "/api/v1/stories/create/",
            {"media": img_file, "caption": "31st story"},
            format="multipart"
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("cannot have more than 30 active stories", res.data["error"])

    def test_stories_list_grouped_by_author(self):
        # Create active story
        story = Story.objects.create(
            author=self.user,
            media_url="https://res.cloudinary.com/demo/image/upload/story.jpg",
            media_type="image",
            caption="Creator's active story"
        )

        # Retrieve stories list as viewer
        self.client.force_authenticate(user=self.viewer)
        res = self.client.get("/api/v1/stories/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["author"]["username"], "story_creator")
        self.assertEqual(res.data[0]["stories"][0]["id"], str(story.id))

        # Test block exclusion
        BlockedUser.objects.create(blocker=self.user, blocked=self.viewer)
        res = self.client.get("/api/v1/stories/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 0)

    def test_story_view_records_and_viewer_list(self):
        story = Story.objects.create(
            author=self.user,
            media_url="https://res.cloudinary.com/demo/image/upload/story.jpg",
            media_type="image"
        )

        # Authenticate as viewer and record view
        self.client.force_authenticate(user=self.viewer)
        res = self.client.post(f"/api/v1/stories/{story.id}/view/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["viewed"])
        self.assertEqual(res.data["view_count"], 1)

        # Authenticate as creator and view viewers list
        self.client.force_authenticate(user=self.user)
        res = self.client.get(f"/api/v1/stories/{story.id}/viewers/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 1)
        self.assertEqual(res.data["results"][0]["username"], "story_viewer")

    def test_story_highlight_crud(self):
        story = Story.objects.create(
            author=self.user,
            media_url="https://res.cloudinary.com/demo/image/upload/story.jpg",
            media_type="image"
        )

        # Create Highlight
        highlight_data = {
            "title": "Summer Vibe",
            "stories": [str(story.id)]
        }
        res = self.client.post("/api/v1/stories/highlights/create/", highlight_data, format="json")
        self.assertEqual(res.status_code, 201)
        highlight_id = res.data["id"]

        # Update Highlight
        update_data = {
            "title": "Summer Vibe 2026"
        }
        res = self.client.patch(f"/api/v1/stories/highlights/{highlight_id}/update/", update_data, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["title"], "Summer Vibe 2026")

        # Detail Highlight
        res = self.client.get(f"/api/v1/stories/highlights/{highlight_id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["title"], "Summer Vibe 2026")

        # Delete Highlight
        res = self.client.delete(f"/api/v1/stories/highlights/{highlight_id}/delete/")
        self.assertEqual(res.status_code, 200)

    def test_hourly_expiry_celery_task(self):
        # Create story that expires in the past
        story = Story.objects.create(
            author=self.user,
            media_url="https://res.cloudinary.com/demo/image/upload/story.jpg",
            media_type="image"
        )
        story.expires_at = timezone.now() - timedelta(minutes=10)
        story.save()

        # Run task
        res = mark_and_cleanup_expired_stories()
        self.assertIn("Successfully processed 1", res)

        # Check DB updated
        story.refresh_from_db()
        self.assertTrue(story.is_expired)
