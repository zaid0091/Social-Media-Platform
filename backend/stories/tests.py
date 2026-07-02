from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from .models import Story, StoryView, StoryHighlight

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
        # Assert expires_at is roughly 24 hours from now
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

