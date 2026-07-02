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


