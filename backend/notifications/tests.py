from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from rest_framework.test import APIClient
from rest_framework import status
from posts.models import Post, Comment, Like
from accounts.models import Follow, FollowRequest
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

@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class NotificationsAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="notified_user",
            email="notified@example.com",
            password="Password123!",
            is_active=True
        )
        self.client.force_authenticate(user=self.user)

        self.actor = User.objects.create_user(
            username="actor_user",
            email="actor@example.com",
            password="Password123!",
            is_active=True
        )

        self.post = Post.objects.create(
            author=self.user,
            content="My awesome post",
            post_type="text"
        )

    def test_post_liked_notification_trigger(self):
        post_type = ContentType.objects.get_for_model(Post)
        Like.objects.create(
            user=self.actor,
            content_type=post_type,
            object_id=self.post.id
        )

        notif = Notification.objects.filter(recipient=self.user, notification_type='like').first()
        self.assertIsNotNone(notif)
        self.assertEqual(notif.sender, self.actor)
        self.assertEqual(notif.related_post, self.post)

    def test_comment_and_reply_notification_trigger(self):
        comment = Comment.objects.create(
            author=self.actor,
            post=self.post,
            content="Great post!"
        )

        notif = Notification.objects.filter(recipient=self.user, notification_type='comment').first()
        self.assertIsNotNone(notif)
        self.assertEqual(notif.sender, self.actor)
        self.assertEqual(notif.related_comment, comment)

        reply = Comment.objects.create(
            author=self.user,
            post=self.post,
            parent=comment,
            content="Thanks!"
        )

        reply_notif = Notification.objects.filter(recipient=self.actor, notification_type='comment').first()
        self.assertIsNotNone(reply_notif)
        self.assertEqual(reply_notif.sender, self.user)
        self.assertEqual(reply_notif.related_comment, reply)

    def test_follow_and_follow_request_notification_trigger(self):
        Follow.objects.create(
            follower=self.actor,
            following=self.user
        )

        notif = Notification.objects.filter(recipient=self.user, notification_type='follow').first()
        self.assertIsNotNone(notif)
        self.assertEqual(notif.sender, self.actor)

        FollowRequest.objects.create(
            requester=self.actor,
            receiver=self.user,
            status='pending'
        )

        notifs = Notification.objects.filter(recipient=self.user, notification_type='follow')
        self.assertEqual(notifs.count(), 2)

    def test_user_mention_notification_trigger(self):
        self.client.force_authenticate(user=self.actor)
        comment_data = {
            "content": "Check this out @notified_user"
        }
        res = self.client.post(f"/api/v1/posts/{self.post.id}/comments/", comment_data, format="json")
        self.assertEqual(res.status_code, 201)

        notif = Notification.objects.filter(recipient=self.user, notification_type='mention').first()
        self.assertIsNotNone(notif)
        self.assertEqual(notif.sender, self.actor)

    def test_notifications_list_read_delete_unread_count(self):
        notif1 = Notification.objects.create(
            recipient=self.user,
            sender=self.actor,
            notification_type="follow"
        )
        notif2 = Notification.objects.create(
            recipient=self.user,
            sender=self.actor,
            notification_type="like",
            related_post=self.post
        )

        res = self.client.get("/api/v1/notifications/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 2)

        res = self.client.get("/api/v1/notifications/unread-count/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["unread_count"], 2)

        res = self.client.post(f"/api/v1/notifications/{notif1.id}/read/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["is_read"])

        res = self.client.get("/api/v1/notifications/unread-count/")
        self.assertEqual(res.data["unread_count"], 1)

        res = self.client.post("/api/v1/notifications/mark-all-read/")
        self.assertEqual(res.status_code, 200)

        res = self.client.get("/api/v1/notifications/unread-count/")
        self.assertEqual(res.data["unread_count"], 0)

        res = self.client.delete(f"/api/v1/notifications/{notif2.id}/delete/")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(Notification.objects.filter(id=notif2.id).exists())

from django.test import TransactionTestCase
from channels.testing import WebsocketCommunicator
from core.asgi import application
from rest_framework_simplejwt.tokens import AccessToken
from channels.db import database_sync_to_async

@override_settings(
    CHANNEL_LAYERS={
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }
)
class NotificationsWebSocketTests(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="ws_user",
            email="ws@example.com",
            password="Password123!",
            is_active=True
        )
        self.actor = User.objects.create_user(
            username="ws_actor",
            email="actorws@example.com",
            password="Password123!",
            is_active=True
        )
        self.token = str(AccessToken.for_user(self.user))

    async def test_websocket_connect_authenticated(self):
        communicator = WebsocketCommunicator(
            application, 
            f"/ws/notifications/?token={self.token}",
            headers=[(b"origin", b"http://localhost")]
        )
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        
        from notifications.models import Notification
        notif = await database_sync_to_async(Notification.objects.create)(
            recipient=self.user,
            sender=self.actor,
            notification_type="follow"
        )

        await communicator.send_json_to({
            "action": "mark_read",
            "notification_id": str(notif.id)
        })
        
        response = await communicator.receive_json_from()
        self.assertEqual(response["status"], "success")
        
        updated_notif = await database_sync_to_async(Notification.objects.get)(id=notif.id)
        self.assertTrue(updated_notif.is_read)

        await communicator.disconnect()

    async def test_websocket_notification_delivery(self):
        communicator = WebsocketCommunicator(
            application, 
            f"/ws/notifications/?token={self.token}",
            headers=[(b"origin", b"http://localhost")]
        )
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)

        # Trigger notification creation task
        from notifications.tasks import send_async_notification
        await database_sync_to_async(send_async_notification)(
            recipient_id=str(self.user.id),
            sender_id=str(self.actor.id),
            notification_type="like"
        )

        response = await communicator.receive_json_from()
        self.assertEqual(response["type"], "notification")
        self.assertEqual(response["notification"]["notification_type"], "like")
        self.assertEqual(response["notification"]["sender"]["username"], "ws_actor")

        await communicator.disconnect()

    async def test_websocket_connect_anonymous_fails(self):
        communicator = WebsocketCommunicator(
            application, 
            "/ws/notifications/?token=invalid_token",
            headers=[(b"origin", b"http://localhost")]
        )
        connected, subprotocol = await communicator.connect()
        self.assertFalse(connected)

