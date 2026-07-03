from django.test import TestCase
from django.contrib.auth import get_user_model
from django.db import models
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import BlockedUser
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


class MessagingAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.alice = User.objects.create_user(username="alice", email="alice@example.com", password="Password123!", is_active=True)
        self.bob = User.objects.create_user(username="bob", email="bob@example.com", password="Password123!", is_active=True)
        self.charlie = User.objects.create_user(username="charlie", email="charlie@example.com", password="Password123!", is_active=True)
        
        # Authenticate Alice by default
        self.client.force_authenticate(user=self.alice)

    def test_conversation_create_one_to_one(self):
        # Alice creates conversation with Bob
        res = self.client.post("/api/v1/messaging/conversations/create/", {"recipient_id": str(self.bob.id)}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        conv_id = res.data["id"]

        # Alice creates conversation with Bob again (should return same conversation)
        res2 = self.client.post("/api/v1/messaging/conversations/create/", {"recipient_id": str(self.bob.id)}, format="json")
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res2.data["id"], conv_id)

    def test_conversation_create_blocked(self):
        # Bob blocks Alice
        BlockedUser.objects.create(blocker=self.bob, blocked=self.alice)

        # Alice tries to create conversation with Bob (should fail)
        res = self.client.post("/api/v1/messaging/conversations/create/", {"recipient_id": str(self.bob.id)}, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_group_conversation_create_and_update(self):
        # Alice creates group conversation with Bob and Charlie
        data = {
            "group_name": "Coding Club",
            "participant_ids": [str(self.bob.id), str(self.charlie.id)],
            "group_avatar": "http://example.com/avatar.png"
        }
        res = self.client.post("/api/v1/messaging/conversations/group/", data, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data["is_group"])
        self.assertEqual(res.data["group_name"], "Coding Club")
        conv_id = res.data["id"]

        # Alice updates group metadata
        update_data = {
            "group_name": "Antigravity Devs",
            "group_avatar": "http://example.com/new_avatar.png"
        }
        res2 = self.client.patch(f"/api/v1/messaging/conversations/group/{conv_id}/", update_data, format="json")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data["group_name"], "Antigravity Devs")
        self.assertEqual(res2.data["group_avatar"], "http://example.com/new_avatar.png")

    def test_conversation_list_ordering(self):
        # Create two conversations
        conv1 = Conversation.objects.create(is_group=False)
        conv1.participants.add(self.alice, self.bob)

        conv2 = Conversation.objects.create(is_group=False)
        conv2.participants.add(self.alice, self.charlie)

        # Send message in conv1 first, then conv2
        msg1 = DirectMessage.objects.create(sender=self.alice, conversation=conv1, content="Msg 1")
        conv1.last_message = msg1
        conv1.save()

        msg2 = DirectMessage.objects.create(sender=self.alice, conversation=conv2, content="Msg 2")
        conv2.last_message = msg2
        conv2.save()

        # Listing conversations should return conv2 first (since its last message is newer)
        res = self.client.get("/api/v1/messaging/conversations/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["results"][0]["id"], str(conv2.id))
        self.assertEqual(res.data["results"][1]["id"], str(conv1.id))

    def test_message_create_read_and_unread_counts(self):
        conv = Conversation.objects.create(is_group=False)
        conv.participants.add(self.alice, self.bob)

        # Alice sends message
        msg_data = {
            "conversation_id": str(conv.id),
            "content": "Hello Bob!",
            "message_type": "text"
        }
        res = self.client.post("/api/v1/messaging/messages/", msg_data, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        msg_id = res.data["id"]

        # Alice checks unread count (should be 0 because she is the sender)
        res_alice = self.client.get(f"/api/v1/messaging/conversations/{conv.id}/")
        self.assertEqual(res_alice.data["conversation"]["unread_count"], 0)

        # Bob logs in and checks unread count (should be 1)
        self.client.force_authenticate(user=self.bob)
        res_bob = self.client.get(f"/api/v1/messaging/conversations/{conv.id}/")
        self.assertEqual(res_bob.data["conversation"]["unread_count"], 1)

        # Bob marks the message as read
        res_read = self.client.post(f"/api/v1/messaging/messages/{msg_id}/read/")
        self.assertEqual(res_read.status_code, status.HTTP_200_OK)
        self.assertTrue(res_read.data["is_read"])

        # Bob checks unread count again (should be 0)
        res_bob2 = self.client.get(f"/api/v1/messaging/conversations/{conv.id}/")
        self.assertEqual(res_bob2.data["conversation"]["unread_count"], 0)

    def test_message_delete_soft(self):
        conv = Conversation.objects.create(is_group=False)
        conv.participants.add(self.alice, self.bob)

        msg = DirectMessage.objects.create(sender=self.alice, conversation=conv, content="Secret message")

        # Alice soft-deletes the message
        res = self.client.delete(f"/api/v1/messaging/messages/{msg.id}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

        # Alice fetches conversation details (message should NOT be visible)
        res_alice = self.client.get(f"/api/v1/messaging/conversations/{conv.id}/")
        self.assertEqual(len(res_alice.data["messages"]["results"]), 0)

        # Bob fetches conversation details (message SHOULD still be visible)
        self.client.force_authenticate(user=self.bob)
        res_bob = self.client.get(f"/api/v1/messaging/conversations/{conv.id}/")
        self.assertEqual(len(res_bob.data["messages"]["results"]), 1)
        self.assertEqual(res_bob.data["messages"]["results"][0]["content"], "Secret message")

    def test_conversation_detail_cursor_pagination(self):
        conv = Conversation.objects.create(is_group=False)
        conv.participants.add(self.alice, self.bob)

        # Create 25 messages
        for i in range(25):
            DirectMessage.objects.create(sender=self.alice, conversation=conv, content=f"Msg {i}")

        # Fetch detail (should return first page with 20 messages and a 'next' cursor url)
        res = self.client.get(f"/api/v1/messaging/conversations/{conv.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data["messages"]["results"]), 20)
        self.assertIsNotNone(res.data["messages"]["next"])


from django.test import TransactionTestCase, override_settings
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
class MessagingWebSocketTests(TransactionTestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username="alice", email="alice@example.com", password="Password123!", is_active=True)
        self.bob = User.objects.create_user(username="bob", email="bob@example.com", password="Password123!", is_active=True)
        self.charlie = User.objects.create_user(username="charlie", email="charlie@example.com", password="Password123!", is_active=True)

        self.conv = Conversation.objects.create(is_group=False)
        self.conv.participants.add(self.alice, self.bob)

        self.alice_token = str(AccessToken.for_user(self.alice))
        self.bob_token = str(AccessToken.for_user(self.bob))
        self.charlie_token = str(AccessToken.for_user(self.charlie))

    async def test_chat_websocket_connect_auth_and_membership(self):
        communicator = WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conv.id}/?token={self.alice_token}",
            headers=[(b"origin", b"http://localhost")]
        )
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        await communicator.disconnect()

        charlie_comm = WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conv.id}/?token={self.charlie_token}",
            headers=[(b"origin", b"http://localhost")]
        )
        charlie_connected, _ = await charlie_comm.connect()
        self.assertFalse(charlie_connected)

    async def test_chat_websocket_send_message_and_persistence(self):
        communicator = WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conv.id}/?token={self.alice_token}",
            headers=[(b"origin", b"http://localhost")]
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_json_to({
            "type": "message",
            "content": "Hi Bob over WebSocket!",
            "message_type": "text"
        })

        response = await communicator.receive_json_from()
        self.assertEqual(response["type"], "message")
        self.assertEqual(response["message"]["content"], "Hi Bob over WebSocket!")
        self.assertEqual(response["message"]["sender"]["username"], "alice")

        from messaging.models import DirectMessage
        msg_exists = await database_sync_to_async(
            DirectMessage.objects.filter(conversation=self.conv, content="Hi Bob over WebSocket!").exists
        )()
        self.assertTrue(msg_exists)

        await communicator.disconnect()

    async def test_chat_websocket_typing_and_read_receipts(self):
        alice_comm = WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conv.id}/?token={self.alice_token}",
            headers=[(b"origin", b"http://localhost")]
        )
        connected1, _ = await alice_comm.connect()
        self.assertTrue(connected1)

        bob_comm = WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conv.id}/?token={self.bob_token}",
            headers=[(b"origin", b"http://localhost")]
        )
        connected2, _ = await bob_comm.connect()
        self.assertTrue(connected2)

        await alice_comm.send_json_to({
            "type": "typing",
            "is_typing": True
        })

        bob_typing_res = await bob_comm.receive_json_from()
        self.assertEqual(bob_typing_res["type"], "typing")
        self.assertEqual(bob_typing_res["sender_id"], str(self.alice.id))
        self.assertTrue(bob_typing_res["is_typing"])

        await bob_comm.send_json_to({
            "type": "read_receipt"
        })

        alice_read_res = await alice_comm.receive_json_from()
        self.assertEqual(alice_read_res["type"], "read_receipt")
        self.assertEqual(alice_read_res["reader_id"], str(self.bob.id))

        await alice_comm.disconnect()
        await bob_comm.disconnect()

