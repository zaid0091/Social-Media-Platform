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

