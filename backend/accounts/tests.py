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

        # Verify blocked user profile returns 404
        res = self.client.get(f"/api/v1/users/profile/{self.public_user.username}/")
        self.assertEqual(res.status_code, 404)

        # Authenticate as blocked user to try and view blocker profile -> returns 404
        self.client.force_authenticate(user=self.public_user)
        res = self.client.get(f"/api/v1/users/profile/{self.user.username}/")
        self.assertEqual(res.status_code, 404)




