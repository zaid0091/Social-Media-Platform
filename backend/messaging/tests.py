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

    async def test_chat_websocket_replies_and_reactions(self):
        alice_comm = WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conv.id}/?token={self.alice_token}",
            headers=[(b"origin", b"http://localhost")]
        )
        await alice_comm.connect()

        bob_comm = WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conv.id}/?token={self.bob_token}",
            headers=[(b"origin", b"http://localhost")]
        )
        await bob_comm.connect()

        # Alice sends message
        await alice_comm.send_json_to({
            "type": "message",
            "content": "Original message"
        })

        res_msg = await alice_comm.receive_json_from()
        msg_id = res_msg["message"]["id"]

        # Bob receives original message
        res_bob_msg = await bob_comm.receive_json_from()
        self.assertEqual(res_bob_msg["message"]["id"], msg_id)

        # Bob replies to Alice's message
        await bob_comm.send_json_to({
            "type": "message",
            "content": "This is a reply!",
            "replied_to_id": msg_id
        })

        # Alice receives reply
        res_reply = await alice_comm.receive_json_from()
        self.assertEqual(res_reply["message"]["content"], "This is a reply!")
        self.assertEqual(res_reply["message"]["replied_to"]["id"], msg_id)

        # Bob sends reaction
        await bob_comm.send_json_to({
            "type": "reaction",
            "message_id": msg_id,
            "emoji": "😂"
        })

        # Alice receives reaction
        res_react = await alice_comm.receive_json_from()
        self.assertEqual(res_react["type"], "reaction")
        self.assertEqual(res_react["message_id"], msg_id)
        self.assertEqual(res_react["emoji"], "😂")
        self.assertEqual(res_react["action"], "added")

        await alice_comm.disconnect()
        await bob_comm.disconnect()

    async def test_chat_websocket_group_management(self):
        # Create group conversation
        group = await database_sync_to_async(Conversation.objects.create)(
            is_group=True,
            group_name="WebSocket Group",
            created_by=self.alice
        )
        await database_sync_to_async(group.participants.add)(self.alice, self.bob)
        await database_sync_to_async(group.admins.add)(self.alice)

        alice_comm = WebsocketCommunicator(
            application,
            f"/ws/chat/{group.id}/?token={self.alice_token}",
            headers=[(b"origin", b"http://localhost")]
        )
        await alice_comm.connect()

        bob_comm = WebsocketCommunicator(
            application,
            f"/ws/chat/{group.id}/?token={self.bob_token}",
            headers=[(b"origin", b"http://localhost")]
        )
        await bob_comm.connect()

        # Alice adds Charlie
        await alice_comm.send_json_to({
            "type": "add_participant",
            "user_id": str(self.charlie.id)
        })

        # Bob receives participant added broadcast
        res_add = await bob_comm.receive_json_from()
        self.assertEqual(res_add["type"], "participant_added")
        self.assertEqual(res_add["user_id"], str(self.charlie.id))

        # Alice also receives participant added in her own queue, drain it
        await alice_comm.receive_json_from()

        # Alice promotes Bob
        await alice_comm.send_json_to({
            "type": "admin_action",
            "user_id": str(self.bob.id),
            "action": "promote"
        })

        res_promo = await bob_comm.receive_json_from()
        self.assertEqual(res_promo["type"], "admin_action")
        self.assertEqual(res_promo["user_id"], str(self.bob.id))
        self.assertEqual(res_promo["action"], "promote")

        # Alice also receives admin action in her own queue, drain it
        await alice_comm.receive_json_from()

        # Bob leaves group
        await bob_comm.send_json_to({
            "type": "leave_group"
        })

        res_leave = await alice_comm.receive_json_from()
        self.assertEqual(res_leave["type"], "participant_left")
        self.assertEqual(res_leave["user_id"], str(self.bob.id))

        await alice_comm.disconnect()
        await bob_comm.disconnect()


from unittest.mock import patch
import tempfile

class MessagingPhase25RestTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.alice = User.objects.create_user(username="alice", email="alice@example.com", password="Password123!", is_active=True)
        self.bob = User.objects.create_user(username="bob", email="bob@example.com", password="Password123!", is_active=True)
        self.charlie = User.objects.create_user(username="charlie", email="charlie@example.com", password="Password123!", is_active=True)
        self.client.force_authenticate(user=self.alice)

    @patch('messaging.views.upload_file_to_cloudinary')
    def test_message_media_upload(self, mock_upload):
        mock_upload.return_value = {
            "secure_url": "https://res.cloudinary.com/demo/image/upload/chat.jpg",
            "resource_type": "image",
            "public_id": "chat_file",
            "thumbnail_url": ""
        }
        with tempfile.NamedTemporaryFile(suffix=".jpg") as temp_file:
            temp_file.write(b"dummy image data")
            temp_file.seek(0)
            res = self.client.post("/api/v1/messaging/messages/upload-media/", {"file": temp_file}, format="multipart")
            self.assertEqual(res.status_code, status.HTTP_201_CREATED)
            self.assertEqual(res.data["media_url"], "https://res.cloudinary.com/demo/image/upload/chat.jpg")

    def test_message_replies_and_reactions(self):
        conv = Conversation.objects.create(is_group=False)
        conv.participants.add(self.alice, self.bob)

        # Alice posts a message
        msg1 = DirectMessage.objects.create(sender=self.alice, conversation=conv, content="Hello Bob!")

        # Bob replies to Alice
        self.client.force_authenticate(user=self.bob)
        res_reply = self.client.post("/api/v1/messaging/messages/", {
            "conversation_id": str(conv.id),
            "content": "Hi Alice! This is a reply",
            "replied_to_id": str(msg1.id)
        }, format="json")
        self.assertEqual(res_reply.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_reply.data["replied_to"]["id"], str(msg1.id))

        # Bob reacts to Alice's message
        res_react1 = self.client.post(f"/api/v1/messaging/messages/{msg1.id}/reaction/", {"emoji": "🔥"}, format="json")
        self.assertEqual(res_react1.status_code, status.HTTP_200_OK)
        self.assertEqual(res_react1.data["status"], "added")

        # Bob toggles reaction off
        res_react2 = self.client.post(f"/api/v1/messaging/messages/{msg1.id}/reaction/", {"emoji": "🔥"}, format="json")
        self.assertEqual(res_react2.status_code, status.HTTP_200_OK)
        self.assertEqual(res_react2.data["status"], "removed")

    def test_group_conversation_participant_and_admin_management(self):
        # Alice creates group
        conv = Conversation.objects.create(is_group=True, group_name="REST Group", created_by=self.alice)
        conv.participants.add(self.alice, self.bob)
        conv.admins.add(self.alice)

        # Alice adds Charlie
        res_add = self.client.post(f"/api/v1/messaging/conversations/{conv.id}/add-participant/", {"user_id": str(self.charlie.id)}, format="json")
        self.assertEqual(res_add.status_code, status.HTTP_200_OK)
        self.assertTrue(conv.participants.filter(id=self.charlie.id).exists())

        # Bob (non-admin) tries to add someone (should fail)
        self.client.force_authenticate(user=self.bob)
        res_add_fail = self.client.post(f"/api/v1/messaging/conversations/{conv.id}/add-participant/", {"user_id": str(self.alice.id)}, format="json")
        self.assertEqual(res_add_fail.status_code, status.HTTP_403_FORBIDDEN)

        # Alice promotes Bob to admin
        self.client.force_authenticate(user=self.alice)
        res_promo = self.client.post(f"/api/v1/messaging/conversations/{conv.id}/admin-action/", {"user_id": str(self.bob.id), "action": "promote"}, format="json")
        self.assertEqual(res_promo.status_code, status.HTTP_200_OK)
        self.assertTrue(conv.admins.filter(id=self.bob.id).exists())

        # Alice demotes Bob
        res_demo = self.client.post(f"/api/v1/messaging/conversations/{conv.id}/admin-action/", {"user_id": str(self.bob.id), "action": "demote"}, format="json")
        self.assertEqual(res_demo.status_code, status.HTTP_200_OK)
        self.assertFalse(conv.admins.filter(id=self.bob.id).exists())

        # Alice removes Bob
        res_remove = self.client.post(f"/api/v1/messaging/conversations/{conv.id}/remove-participant/", {"user_id": str(self.bob.id)}, format="json")
        self.assertEqual(res_remove.status_code, status.HTTP_200_OK)
        self.assertFalse(conv.participants.filter(id=self.bob.id).exists())

        # Charlie leaves
        self.client.force_authenticate(user=self.charlie)
        res_leave = self.client.post(f"/api/v1/messaging/conversations/{conv.id}/leave/", format="json")
        self.assertEqual(res_leave.status_code, status.HTTP_200_OK)
        self.assertFalse(conv.participants.filter(id=self.charlie.id).exists())

    def test_conversation_mute_and_message_forward(self):
        conv1 = Conversation.objects.create(is_group=False)
        conv1.participants.add(self.alice, self.bob)

        conv2 = Conversation.objects.create(is_group=False)
        conv2.participants.add(self.alice, self.charlie)

        msg = DirectMessage.objects.create(sender=self.alice, conversation=conv1, content="Forward me!")

        # Mute conv1
        res_mute = self.client.post(f"/api/v1/messaging/conversations/{conv1.id}/mute/", format="json")
        self.assertEqual(res_mute.status_code, status.HTTP_200_OK)
        self.assertTrue(res_mute.data["is_muted"])

        # Forward message to conv2
        res_fwd = self.client.post(f"/api/v1/messaging/messages/{msg.id}/forward/", {"target_conversation_id": str(conv2.id)}, format="json")
        self.assertEqual(res_fwd.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_fwd.data["content"], "[Forwarded] Forward me!")

    def test_conversation_message_search(self):
        conv = Conversation.objects.create(is_group=False)
        conv.participants.add(self.alice, self.bob)

        DirectMessage.objects.create(sender=self.alice, conversation=conv, content="Hello Bob")
        DirectMessage.objects.create(sender=self.alice, conversation=conv, content="Top Secret Key")
        DirectMessage.objects.create(sender=self.alice, conversation=conv, content="Goodbye Bob")

        res = self.client.get(f"/api/v1/messaging/conversations/{conv.id}/search/?q=Secret")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data["results"]), 1)
        self.assertEqual(res.data["results"][0]["content"], "Top Secret Key")


