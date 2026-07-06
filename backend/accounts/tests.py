from django.db import IntegrityError
from django.test import TestCase
from django.contrib.auth import get_user_model
from .models import Follow, FollowRequest, BlockedUser

User = get_user_model()

class AccountsModelTests(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            username="alice",
            email="alice@example.com",
            password="password123",
            full_name="Alice Smith"
        )
        self.user2 = User.objects.create_user(
            username="bob",
            email="bob@example.com",
            password="password456",
            full_name="Bob Jones"
        )

    def test_user_creation(self):
        self.assertEqual(self.user1.username, "alice")
        self.assertEqual(self.user1.email, "alice@example.com")
        self.assertEqual(self.user1.full_name, "Alice Smith")
        self.assertFalse(self.user1.is_verified)
        self.assertFalse(self.user1.is_private)
        self.assertEqual(self.user1.account_type, "personal")

    def test_follow_creation_and_uniqueness(self):
        # Alice follows Bob
        follow = Follow.objects.create(follower=self.user1, following=self.user2)
        self.assertEqual(follow.follower, self.user1)
        self.assertEqual(follow.following, self.user2)

        # Alice cannot follow Bob again due to unique constraint
        with self.assertRaises(IntegrityError):
            Follow.objects.create(follower=self.user1, following=self.user2)

    def test_follow_request_creation_and_uniqueness(self):
        # Alice requests to follow Bob
        req = FollowRequest.objects.create(
            requester=self.user1,
            receiver=self.user2,
            status="pending"
        )
        self.assertEqual(req.status, "pending")

        # Alice cannot request again due to unique constraint
        with self.assertRaises(IntegrityError):
            FollowRequest.objects.create(
                requester=self.user1,
                receiver=self.user2
            )

    def test_block_creation_and_uniqueness(self):
        # Alice blocks Bob
        block = BlockedUser.objects.create(blocker=self.user1, blocked=self.user2)
        self.assertEqual(block.blocker, self.user1)
        self.assertEqual(block.blocked, self.user2)

        # Alice cannot block Bob again due to unique constraint
        with self.assertRaises(IntegrityError):
            BlockedUser.objects.create(blocker=self.user1, blocked=self.user2)

from rest_framework.test import APIClient
from django.core.signing import TimestampSigner

class AccountsAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_data = {
            "username": "charlie",
            "email": "charlie@example.com",
            "password": "Password123!",
            "password_confirm": "Password123!",
            "full_name": "Charlie Chaplin"
        }

    def test_registration_and_email_verification(self):
        # 1. Register user
        res = self.client.post("/api/v1/auth/register/", self.register_data, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertIn("registered successfully", res.data["message"])

        # Fetch inactive user
        user = User.objects.get(username="charlie")
        self.assertFalse(user.is_active)

        # 2. Verify Email
        signer = TimestampSigner()
        token = signer.sign(user.email)
        res = self.client.get(f"/api/v1/auth/verify-email/?token={token}")
        self.assertEqual(res.status_code, 200)
        self.assertIn("verified successfully", res.data["message"])

        user.refresh_from_db()
        self.assertTrue(user.is_active)

    def test_failed_registration(self):
        # Weak password
        data = self.register_data.copy()
        data["password"] = "123"
        data["password_confirm"] = "123"
        res = self.client.post("/api/v1/auth/register/", data, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("password", res.data)

        # Mismatch confirm
        data = self.register_data.copy()
        data["password_confirm"] = "Different123!"
        res = self.client.post("/api/v1/auth/register/", data, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("password_confirm", res.data)

    def test_login_logout_refresh_flows(self):
        # Create active user
        user = User.objects.create_user(
            username="charlie",
            email="charlie@example.com",
            password="Password123!",
            is_active=True
        )

        # 1. Login
        login_data = {"username": "charlie", "password": "Password123!"}
        res = self.client.post("/api/v1/auth/login/", login_data, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertIn("access_token", res.data)
        
        # Verify HttpOnly Cookie
        self.assertIn("refresh_token", self.client.cookies)
        refresh_cookie = self.client.cookies["refresh_token"]
        self.assertTrue(refresh_cookie["httponly"])

        # 2. Token Refresh
        res = self.client.post("/api/v1/auth/token/refresh/", format="json")
        self.assertEqual(res.status_code, 200)
        self.assertIn("access_token", res.data)

        # 3. Logout
        res = self.client.post("/api/v1/auth/logout/", format="json")
        self.assertEqual(res.status_code, 200)
        
        # Cookie should be deleted/expired
        self.assertEqual(self.client.cookies["refresh_token"].value, "")

from django.core.files.uploadedfile import SimpleUploadedFile

class AccountsManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="charlie",
            email="charlie@example.com",
            password="Password123!",
            is_active=True
        )
        self.client.force_authenticate(user=self.user)
        
        self.other_user = User.objects.create_user(
            username="david",
            email="david@example.com",
            password="Password123!",
            is_active=True,
            full_name="David Copperfield",
            location="New York"
        )

    def test_get_and_update_profile(self):
        # GET own profile
        res = self.client.get("/api/v1/users/profile/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["username"], "charlie")

        # PATCH own profile
        update_data = {"bio": "Just a new bio", "location": "London"}
        res = self.client.patch("/api/v1/users/profile/", update_data, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["bio"], "Just a new bio")
        self.assertEqual(res.data["location"], "London")

    def test_upload_profile_picture(self):
        small_gif = (
            b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x00\x00\x00\x21\xf9\x04'
            b'\x01\x0a\x00\x01\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02'
            b'\x02\x4c\x01\x00\x3b'
        )
        profile_pic = SimpleUploadedFile('profile.gif', small_gif, content_type='image/gif')
        
        res = self.client.patch(
            "/api/v1/users/profile/", 
            {"profile_picture": profile_pic}, 
            format="multipart"
        )
        self.assertEqual(res.status_code, 200)
        self.assertIsNotNone(res.data["profile_picture"])

    def test_public_profile_privacy(self):
        # Make david account private
        self.other_user.is_private = True
        self.other_user.save()

        # Retrieve profile of private user without following
        res = self.client.get(f"/api/v1/users/profile/{self.other_user.username}/")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data["is_accessible"])
        self.assertIsNone(res.data["location"])  # Location should be stripped

        # Follow david
        Follow.objects.create(follower=self.user, following=self.other_user)
        res = self.client.get(f"/api/v1/users/profile/{self.other_user.username}/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["is_accessible"])
        self.assertEqual(res.data["location"], "New York")

    def test_change_password(self):
        pwd_data = {
            "old_password": "Password123!",
            "new_password": "NewPassword123!",
            "new_password_confirm": "NewPassword123!"
        }
        res = self.client.post("/api/v1/users/change-password/", pwd_data, format="json")
        self.assertEqual(res.status_code, 200)

        # Verify new password
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewPassword123!"))

    def test_delete_account(self):
        res = self.client.post("/api/v1/users/delete-account/")
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

    def test_search_and_suggestions(self):
        # Search
        res = self.client.get("/api/v1/users/search/?q=david")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["username"], "david")

        # Suggestions
        res = self.client.get("/api/v1/users/suggestions/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["username"], "david")


class AccountsFollowSystemTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="charlie",
            email="charlie@example.com",
            password="Password123!",
            is_active=True
        )
        self.client.force_authenticate(user=self.user)

        self.public_user = User.objects.create_user(
            username="publicuser",
            email="public@example.com",
            password="Password123!",
            is_active=True,
            is_private=False
        )

        self.private_user = User.objects.create_user(
            username="privateuser",
            email="private@example.com",
            password="Password123!",
            is_active=True,
            is_private=True
        )

    def test_follow_unfollow_public_user_and_signals(self):
        # Follow public user
        res = self.client.post(f"/api/v1/users/follow/{self.public_user.id}/")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["message"], "Successfully followed user.")

        # Check signals updated cache counts
        self.user.refresh_from_db()
        self.public_user.refresh_from_db()
        self.assertEqual(self.user.following_count, 1)
        self.assertEqual(self.public_user.follower_count, 1)

        # Unfollow
        res = self.client.post(f"/api/v1/users/unfollow/{self.public_user.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["message"], "Successfully unfollowed user.")

        # Check signals decremented counts
        self.user.refresh_from_db()
        self.public_user.refresh_from_db()
        self.assertEqual(self.user.following_count, 0)
        self.assertEqual(self.public_user.follower_count, 0)

    def test_follow_request_flow(self):
        # Follow private user -> creates follow request
        res = self.client.post(f"/api/v1/users/follow/{self.private_user.id}/")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["message"], "Follow request sent.")

        req = FollowRequest.objects.get(requester=self.user, receiver=self.private_user)
        self.assertEqual(req.status, "pending")

        # Accept request
        # We need to authenticate as the receiver (private_user)
        self.client.force_authenticate(user=self.private_user)
        res = self.client.post(f"/api/v1/users/follow-requests/{req.id}/accept/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["message"], "Follow request accepted.")

        # Verify Follow was created
        self.assertTrue(Follow.objects.filter(follower=self.user, following=self.private_user).exists())
        self.assertFalse(FollowRequest.objects.filter(id=req.id).exists())

        # Verify counts caches updated via signals
        self.user.refresh_from_db()
        self.private_user.refresh_from_db()
        self.assertEqual(self.user.following_count, 1)
        self.assertEqual(self.private_user.follower_count, 1)

    def test_block_unblock_and_profile_restriction(self):
        # Establish follow first
        Follow.objects.create(follower=self.user, following=self.public_user)
        Follow.objects.create(follower=self.public_user, following=self.user)

        self.user.refresh_from_db()
        self.public_user.refresh_from_db()
        self.assertEqual(self.user.following_count, 1)
        self.assertEqual(self.user.follower_count, 1)

        # Block public user
        res = self.client.post(f"/api/v1/users/block/{self.public_user.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["message"], "User blocked successfully.")

        # Verify block is created
        self.assertTrue(BlockedUser.objects.filter(blocker=self.user, blocked=self.public_user).exists())

        # Verify follows deleted both ways and counts updated
        self.assertFalse(Follow.objects.filter(follower=self.user, following=self.public_user).exists())
        self.assertFalse(Follow.objects.filter(follower=self.public_user, following=self.user).exists())

        self.user.refresh_from_db()
        self.public_user.refresh_from_db()
        self.assertEqual(self.user.following_count, 0)
        self.assertEqual(self.user.follower_count, 0)

        # Verify blocker (self.user) visiting blocked user (self.public_user) can view, but marked is_blocked
        res = self.client.get(f"/api/v1/users/profile/{self.public_user.username}/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["is_blocked"])
        self.assertFalse(res.data["is_accessible"])

        # Authenticate as blocked user to try and view blocker profile -> returns 404
        self.client.force_authenticate(user=self.public_user)
        res = self.client.get(f"/api/v1/users/profile/{self.user.username}/")
        self.assertEqual(res.status_code, 404)

        # Authenticate back as blocker
        self.client.force_authenticate(user=self.user)

        # Unblock
        res = self.client.post(f"/api/v1/users/unblock/{self.public_user.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["message"], "User unblocked successfully.")

        # Now test Restrict User
        res = self.client.post(f"/api/v1/users/restrict/{self.public_user.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["message"], "User restricted successfully.")

        # Verify restrict status on profile
        res = self.client.get(f"/api/v1/users/profile/{self.public_user.username}/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["is_restricted"])

        # Test comment restriction visibility logic
        from posts.models import Post, Comment
        # 1. Self.user creates a post
        post = Post.objects.create(author=self.user, content="Block/Restrict post", post_type="text")
        
        # 2. Restricted user (public_user) comments on it
        self.client.force_authenticate(user=self.public_user)
        comment_res = self.client.post(f"/api/v1/posts/{post.id}/comments/", {"content": "Hello restricted comment"})
        self.assertEqual(comment_res.status_code, 201)
        comment_id = comment_res.data["id"]

        # List comments as restricted user -> should see own comment
        res = self.client.get(f"/api/v1/posts/{post.id}/comments/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 1)
        self.assertEqual(res.data["results"][0]["id"], comment_id)

        # List comments as post author (self.user) -> should see restricted user's comment
        self.client.force_authenticate(user=self.user)
        res = self.client.get(f"/api/v1/posts/{post.id}/comments/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 1)
        self.assertEqual(res.data["results"][0]["id"], comment_id)

        # Create a third unrelated user
        other_user = User.objects.create_user(
            username="otheruser",
            email="other@example.com",
            password="Password123!",
            is_active=True
        )
        self.client.force_authenticate(user=other_user)
        # List comments as third user -> should NOT see the restricted user's comment!
        res = self.client.get(f"/api/v1/posts/{post.id}/comments/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 0)

        # Unrestrict the user
        self.client.force_authenticate(user=self.user)
        res = self.client.post(f"/api/v1/users/unrestrict/{self.public_user.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["message"], "User unrestricted successfully.")

        # Verify comment is now visible to the third user
        self.client.force_authenticate(user=other_user)
        res = self.client.get(f"/api/v1/posts/{post.id}/comments/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 1)


from django.test import TransactionTestCase, override_settings
from channels.testing import WebsocketCommunicator
from core.asgi import application
from rest_framework_simplejwt.tokens import AccessToken
from channels.db import database_sync_to_async
from django_redis import get_redis_connection
from rest_framework.test import APIClient
from messaging.models import Conversation

@override_settings(
    CHANNEL_LAYERS={
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }
)
class PresenceWebSocketTests(TransactionTestCase):
    def setUp(self):
        self.client = APIClient()
        self.alice = User.objects.create_user(username="alice", email="alice@example.com", password="Password123!", is_active=True)
        self.bob = User.objects.create_user(username="bob", email="bob@example.com", password="Password123!", is_active=True)
        
        Follow.objects.create(follower=self.bob, following=self.alice)

        self.alice_token = str(AccessToken.for_user(self.alice))
        self.bob_token = str(AccessToken.for_user(self.bob))
        
        self.client.force_authenticate(user=self.alice)

    async def test_presence_flow_and_heartbeat(self):
        redis_client = get_redis_connection("default")
        redis_client.delete(f"presence_user_{self.alice.id}")
        redis_client.srem("online_users", str(self.alice.id))

        comm = WebsocketCommunicator(
            application,
            f"/ws/presence/?token={self.alice_token}",
            headers=[(b"origin", b"http://localhost")]
        )
        connected, _ = await comm.connect()
        self.assertTrue(connected)

        is_online_key = await database_sync_to_async(redis_client.exists)(f"presence_user_{self.alice.id}")
        self.assertTrue(is_online_key)
        
        is_in_set = await database_sync_to_async(redis_client.sismember)("online_users", str(self.alice.id))
        self.assertTrue(is_in_set)

        await comm.send_json_to({"type": "ping"})
        response = await comm.receive_json_from()
        self.assertEqual(response["type"], "pong")

        res = await database_sync_to_async(self.client.get)(f"/api/v1/users/presence/{self.alice.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["is_online"])

        await comm.disconnect()

        is_online_key_after = await database_sync_to_async(redis_client.exists)(f"presence_user_{self.alice.id}")
        self.assertFalse(is_online_key_after)

        is_in_set_after = await database_sync_to_async(redis_client.sismember)("online_users", str(self.alice.id))
        self.assertFalse(is_in_set_after)

        await database_sync_to_async(self.alice.refresh_from_db)()
        self.assertIsNotNone(self.alice.last_seen)

    async def test_presence_broadcaster_to_followers_and_chat(self):
        bob_comm = WebsocketCommunicator(
            application,
            f"/ws/presence/?token={self.bob_token}",
            headers=[(b"origin", b"http://localhost")]
        )
        connected, _ = await bob_comm.connect()
        self.assertTrue(connected)

        conv = await database_sync_to_async(Conversation.objects.create)()
        await database_sync_to_async(conv.participants.add)(self.alice, self.bob)

        bob_chat_comm = WebsocketCommunicator(
            application,
            f"/ws/chat/{conv.id}/?token={self.bob_token}",
            headers=[(b"origin", b"http://localhost")]
        )
        connected_chat, _ = await bob_chat_comm.connect()
        self.assertTrue(connected_chat)

        alice_comm = WebsocketCommunicator(
            application,
            f"/ws/presence/?token={self.alice_token}",
            headers=[(b"origin", b"http://localhost")]
        )
        connected_alice, _ = await alice_comm.connect()
        self.assertTrue(connected_alice)

        from accounts.tasks import broadcast_presence_change
        await database_sync_to_async(broadcast_presence_change)(str(self.alice.id), "online")

        event = await bob_comm.receive_json_from()
        self.assertEqual(event["type"], "presence_update")
        self.assertEqual(event["user_id"], str(self.alice.id))
        self.assertEqual(event["status"], "online")

        chat_event = await bob_chat_comm.receive_json_from()
        self.assertEqual(chat_event["type"], "presence_update")
        self.assertEqual(chat_event["user_id"], str(self.alice.id))
        self.assertEqual(chat_event["status"], "online")

        redis_client = get_redis_connection("default")
        typing_key = f"typing_user_{self.alice.id}_{conv.id}"
        await database_sync_to_async(redis_client.setex)(typing_key, 5, "true")

        self.client.force_authenticate(user=self.bob)
        res = await database_sync_to_async(self.client.get)(f"/api/v1/messaging/conversations/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["results"][0]["is_typing"])

        await database_sync_to_async(redis_client.delete)(typing_key)
        await bob_comm.disconnect()
        await bob_chat_comm.disconnect()
        await alice_comm.disconnect()


from django.core import mail
from accounts.models import UserDevice

class EmailSystemTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_data = {
            "username": "tester",
            "email": "tester@example.com",
            "password": "Password123!",
            "password_confirm": "Password123!",
            "full_name": "Test User"
        }

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    def test_registration_and_verification_emails(self):
        # 1. Register -> verification email enqueued and sent
        mail.outbox = []
        res = self.client.post("/api/v1/auth/register/", self.register_data, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Verify Your Social Media Platform Account", mail.outbox[0].subject)
        self.assertEqual(mail.outbox[0].to, ["tester@example.com"])
        self.assertIn("verify-email", mail.outbox[0].alternatives[0][0])

        # Extract token
        from django.core.signing import TimestampSigner
        user = User.objects.get(username="tester")
        signer = TimestampSigner()
        token = signer.sign(user.email)

        # 2. Verify -> welcome email sent
        mail.outbox = []
        res = self.client.get(f"/api/v1/auth/verify-email/?token={token}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Welcome to Social Media Platform!", mail.outbox[0].subject)

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    def test_password_reset_flow(self):
        user = User.objects.create_user(
            username="reset_user",
            email="reset@example.com",
            password="OldPassword123!",
            is_active=True
        )

        # 1. Request Reset -> reset email sent
        mail.outbox = []
        res = self.client.post("/api/v1/auth/password-reset/", {"email": "reset@example.com"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Password Reset Request", mail.outbox[0].subject)

        # Retrieve link from email to get uidb64 and token
        body = mail.outbox[0].alternatives[0][0]
        import re
        uidb64_match = re.search(r'uidb64=([^&"\s]+)', body)
        token_match = re.search(r'token=([^&"\s]+)', body)
        self.assertIsNotNone(uidb64_match)
        self.assertIsNotNone(token_match)
        uidb64 = uidb64_match.group(1)
        token = token_match.group(1)

        # 2. Confirm Reset
        res = self.client.post("/api/v1/auth/password-reset/confirm/", {
            "uidb64": uidb64,
            "token": token,
            "new_password": "NewPassword123!"
        }, format="json")
        self.assertEqual(res.status_code, 200)

        # Verify password updated
        from django.contrib.auth import authenticate
        authenticated_user = authenticate(username="reset_user", password="NewPassword123!")
        self.assertIsNotNone(authenticated_user)

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    def test_unrecognized_device_login_alert(self):
        user = User.objects.create_user(
            username="device_user",
            email="device@example.com",
            password="Password123!",
            is_active=True
        )

        # 1. Login with a user agent
        mail.outbox = []
        headers = {
            "HTTP_USER_AGENT": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "REMOTE_ADDR": "192.168.1.50"
        }
        res = self.client.post("/api/v1/auth/login/", {
            "username": "device_user",
            "password": "Password123!"
        }, format="json", **headers)
        self.assertEqual(res.status_code, 200)
        
        # Verify device record created and email sent
        self.assertTrue(UserDevice.objects.filter(user=user, user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)").exists())
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Security Alert", mail.outbox[0].subject)

        # 2. Login again with same user agent -> no new email sent
        mail.outbox = []
        res = self.client.post("/api/v1/auth/login/", {
            "username": "device_user",
            "password": "Password123!"
        }, format="json", **headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)






