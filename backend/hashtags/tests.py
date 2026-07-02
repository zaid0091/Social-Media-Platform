from django.test import TestCase
from django.contrib.auth import get_user_model
from posts.models import Post
from .models import Hashtag, PostHashtag

User = get_user_model()

class HashtagsModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="alice", email="alice@example.com", password="password123")
        self.post = Post.objects.create(author=self.user, content="This is an awesome post #tech", post_type="text")

    def test_hashtag_creation(self):
        hashtag = Hashtag.objects.create(name="tech")
        self.assertEqual(hashtag.name, "tech")
        self.assertEqual(hashtag.post_count, 0)

        association = PostHashtag.objects.create(post=self.post, hashtag=hashtag)
        self.assertEqual(association.post, self.post)
        self.assertEqual(association.hashtag, hashtag)
