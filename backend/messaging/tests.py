from django.test import TestCase
from django.contrib.auth import get_user_model
from .models import Conversation, DirectMessage

User = get_user_model()

class MessagingModelTests(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(username="alice", email="alice@example.com", password="password123")
        self.user2 = User.objects.create_user(username="bob", email="bob@example.com", password="password456")

    def test_conversation_and_message_creation(self):
        conv = Conversation.objects.create()
        conv.participants.add(self.user1, self.user2)
        
        self.assertIn(self.user1, conv.participants.all())
        self.assertIn(self.user2, conv.participants.all())

        msg = DirectMessage.objects.create(
            sender=self.user1,
            conversation=conv,
            content="Hi Bob!",
            message_type="text"
        )
        self.assertEqual(msg.sender, self.user1)
        self.assertEqual(msg.content, "Hi Bob!")
        self.assertEqual(msg.conversation, conv)
        self.assertFalse(msg.is_read)
