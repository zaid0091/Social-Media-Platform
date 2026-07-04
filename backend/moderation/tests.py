from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from django.core import mail

from posts.models import Post, Comment
from stories.models import Story
from .models import Report
from notifications.models import Notification

User = get_user_model()

class ModerationWorkflowsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(username="admin", email="admin@example.com", password="Password123!")
        self.reporter = User.objects.create_user(username="reporter", email="reporter@example.com", password="Password123!")
        self.reported_user = User.objects.create_user(username="offender", email="offender@example.com", password="Password123!")
        
        self.post = Post.objects.create(author=self.reported_user, content="Normal content", post_type="text")
        self.comment = Comment.objects.create(post=self.post, author=self.reported_user, content="Normal comment")
        self.story = Story.objects.create(author=self.reported_user, media_url="http://example.com/story.jpg", media_type="image", caption="Normal caption")

    def test_report_creation_and_validation(self):
        self.client.force_authenticate(user=self.reporter)

        # 1. Report Post
        res = self.client.post("/api/v1/moderation/reports/create/", {
            "reported_post": str(self.post.id),
            "reason": "harassment",
            "description": "Harassing post description"
        }, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["reason"], "harassment")
        self.assertEqual(str(res.data["reported_post"]), str(self.post.id))

        # 2. Invalid Target Report (no targets specified)
        res = self.client.post("/api/v1/moderation/reports/create/", {
            "reason": "spam",
            "description": "No targets"
        }, format="json")
        self.assertEqual(res.status_code, 400)

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    def test_admin_resolve_warning(self):
        report = Report.objects.create(
            reporter=self.reporter,
            reported_user=self.reported_user,
            reason="hate_speech",
            description="offender is using slurs"
        )
        self.client.force_authenticate(user=self.admin)

        # Resolve with warning
        res = self.client.post(f"/api/v1/moderation/admin/reports/{report.id}/resolve/", {
            "status": "resolved",
            "action_taken": "warning_issued"
        }, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "resolved")
        self.assertEqual(res.data["action_taken"], "warning_issued")

        # Verify warning notification created
        self.assertTrue(Notification.objects.filter(recipient=self.reported_user, notification_type="warning").exists())

    def test_admin_resolve_content_removed(self):
        report = Report.objects.create(
            reporter=self.reporter,
            reported_post=self.post,
            reason="nudity",
            description="Nude content"
        )
        self.client.force_authenticate(user=self.admin)

        # Resolve with content removal
        res = self.client.post(f"/api/v1/moderation/admin/reports/{report.id}/resolve/", {
            "status": "resolved",
            "action_taken": "content_removed"
        }, format="json")
        self.assertEqual(res.status_code, 200)

        # Verify post is hidden
        self.post.refresh_from_db()
        self.assertTrue(self.post.is_hidden)

    def test_admin_resolve_suspension(self):
        report = Report.objects.create(
            reporter=self.reporter,
            reported_user=self.reported_user,
            reason="spam",
            description="Spamming groups"
        )
        self.client.force_authenticate(user=self.admin)

        # Resolve with suspension
        res = self.client.post(f"/api/v1/moderation/admin/reports/{report.id}/resolve/", {
            "status": "resolved",
            "action_taken": "user_suspended",
            "duration_days": 5
        }, format="json")
        self.assertEqual(res.status_code, 200)

        self.reported_user.refresh_from_db()
        self.assertTrue(self.reported_user.is_suspended)
        self.assertIsNotNone(self.reported_user.suspension_expires_at)

    def test_admin_resolve_ban(self):
        report = Report.objects.create(
            reporter=self.reporter,
            reported_user=self.reported_user,
            reason="harassment",
            description="Stalking"
        )
        self.client.force_authenticate(user=self.admin)

        # Resolve with ban
        res = self.client.post(f"/api/v1/moderation/admin/reports/{report.id}/resolve/", {
            "status": "resolved",
            "action_taken": "user_banned"
        }, format="json")
        self.assertEqual(res.status_code, 200)

        self.reported_user.refresh_from_db()
        self.assertTrue(self.reported_user.is_banned)

    def test_content_hide_view(self):
        self.client.force_authenticate(user=self.admin)

        # Hide post
        res = self.client.post("/api/v1/moderation/admin/content/hide/", {
            "post_id": str(self.post.id),
            "is_hidden": True
        }, format="json")
        self.assertEqual(res.status_code, 200)
        self.post.refresh_from_db()
        self.assertTrue(self.post.is_hidden)

        # Hide comment
        res = self.client.post("/api/v1/moderation/admin/content/hide/", {
            "comment_id": str(self.comment.id),
            "is_hidden": True
        }, format="json")
        self.assertEqual(res.status_code, 200)
        self.comment.refresh_from_db()
        self.assertTrue(self.comment.is_hidden)

    def test_user_suspend_ban_warn_views(self):
        self.client.force_authenticate(user=self.admin)

        # 1. Suspend User
        res = self.client.post("/api/v1/moderation/admin/users/suspend/", {
            "user_id": str(self.reported_user.id),
            "duration_days": 3
        }, format="json")
        self.assertEqual(res.status_code, 200)
        self.reported_user.refresh_from_db()
        self.assertTrue(self.reported_user.is_suspended)

        # 2. Ban User
        res = self.client.post("/api/v1/moderation/admin/users/ban/", {
            "user_id": str(self.reported_user.id)
        }, format="json")
        self.assertEqual(res.status_code, 200)
        self.reported_user.refresh_from_db()
        self.assertTrue(self.reported_user.is_banned)

        # 3. Warn User
        res = self.client.post("/api/v1/moderation/admin/users/warn/", {
            "user_id": str(self.reported_user.id)
        }, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(Notification.objects.filter(recipient=self.reported_user, notification_type="warning").exists())

    def test_automated_content_flagging(self):
        # Create a post containing flagged keywords
        flagged_post = Post.objects.create(
            author=self.reported_user,
            content="Click here for prize money and buy cheap deals!",
            post_type="text"
        )
        # Verify it was auto-flagged and report generated
        self.assertTrue(flagged_post.needs_review)
        self.assertTrue(Report.objects.filter(reported_post=flagged_post, status="needs_review").exists())

    def test_banned_suspended_login_restrictions(self):
        # 1. Banned User Login rejected
        self.reported_user.is_banned = True
        self.reported_user.save()

        res = self.client.post("/api/v1/auth/login/", {
            "username": "offender",
            "password": "Password123!"
        }, format="json")
        self.assertEqual(res.status_code, 403)
        self.assertIn("permanently banned", res.data["error"])

        # 2. Suspended User Login rejected
        self.reported_user.is_banned = False
        self.reported_user.is_suspended = True
        self.reported_user.suspension_expires_at = timezone.now() + timedelta(days=2)
        self.reported_user.save()

        res = self.client.post("/api/v1/auth/login/", {
            "username": "offender",
            "password": "Password123!"
        }, format="json")
        self.assertEqual(res.status_code, 403)
        self.assertIn("suspended until", res.data["error"])

        # 3. Expired Suspension login lifts it automatically
        self.reported_user.suspension_expires_at = timezone.now() - timedelta(days=1)
        self.reported_user.save()

        # Mock Email sending since device login will trigger alert email
        with override_settings(CELERY_TASK_ALWAYS_EAGER=True):
            res = self.client.post("/api/v1/auth/login/", {
                "username": "offender",
                "password": "Password123!"
            }, format="json")
        self.assertEqual(res.status_code, 200)
        self.reported_user.refresh_from_db()
        self.assertFalse(self.reported_user.is_suspended)
