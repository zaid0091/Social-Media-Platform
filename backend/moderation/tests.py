from django.test import TestCase
from django.contrib.auth import get_user_model
from posts.models import Post
from .models import Report

User = get_user_model()

class ModerationModelTests(TestCase):
    def setUp(self):
        self.reporter = User.objects.create_user(username="alice", email="alice@example.com", password="password123")
        self.reported_user = User.objects.create_user(username="bob", email="bob@example.com", password="password456")
        self.post = Post.objects.create(author=self.reported_user, content="Bad content", post_type="text")

    def test_report_creation(self):
        report = Report.objects.create(
            reporter=self.reporter,
            reported_post=self.post,
            reason="harassment",
            description="Bob is posting harassment content"
        )
        self.assertEqual(report.reporter, self.reporter)
        self.assertEqual(report.reported_post, self.post)
        self.assertEqual(report.reason, "harassment")
        self.assertEqual(report.status, "pending")
