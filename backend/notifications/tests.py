from django.test import TestCase
from django.contrib.auth import get_user_model
from .models import Notification

User = get_user_model()

class NotificationsModelTests(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(username="alice", email="alice@example.com", password="password123")
        self.user2 = User.objects.create_user(username="bob", email="bob@example.com", password="password456")

    def test_notification_creation(self):
        notif = Notification.objects.create(
            recipient=self.user1,
            sender=self.user2,
            notification_type="follow"
        )
        self.assertEqual(notif.recipient, self.user1)
        self.assertEqual(notif.sender, self.user2)
        self.assertEqual(notif.notification_type, "follow")
        self.assertFalse(notif.is_read)
