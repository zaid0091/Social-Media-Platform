import json
from django.core.serializers.json import DjangoJSONEncoder
from channels.generic.websocket import AsyncWebsocketConsumer
from urllib.parse import parse_qs
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from django.db.models import Q
from channels.db import database_sync_to_async

from .models import Conversation, DirectMessage
from .serializers import MessageSerializer
from accounts.models import BlockedUser

User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        params = parse_qs(query_string)
        token = params.get('token', [None])[0]

        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']

        if not token:
            await self.close()
            return

        try:
            # Validate SimpleJWT token
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            
            # Fetch user asynchronously
            user = await database_sync_to_async(User.objects.get)(id=user_id)
            self.user = user

            # Verify that the user is a participant of the conversation
            is_member = await database_sync_to_async(self.verify_membership)()
            if not is_member:
                await self.close()
                return

            self.group_name = f"chat_conversation_{self.conversation_id}"

            # Join channel group
            await self.channel_layer.group_add(
                self.group_name,
                self.channel_name
            )
            await self.accept()
        except Exception:
            await self.close()

    def verify_membership(self):
        return Conversation.objects.filter(id=self.conversation_id, participants=self.user).exists()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            action = data.get('type')  # type of action: 'message', 'typing', 'read_receipt'
            
            if action == 'message':
                content = data.get('content', '')
                media_url = data.get('media_url', '')
                message_type = data.get('message_type', 'text')

                # Verify blocker validations before saving
                is_blocked = await database_sync_to_async(self.check_blocks)()
                if is_blocked:
                    await self.send(text_data=json.dumps({
                        "status": "error",
                        "message": "Cannot send message due to a block relationship."
                    }, cls=DjangoJSONEncoder))
                    return

                # Save message & update last message
                message = await database_sync_to_async(self.save_message)(content, media_url, message_type)
                
                # Serialize and broadcast
                message_data = await database_sync_to_async(self.serialize_message)(message)

                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "chat_message",
                        "message": message_data
                    }
                )

            elif action == 'typing':
                is_typing = data.get('is_typing', False)
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "chat_typing",
                        "sender_id": str(self.user.id),
                        "username": self.user.username,
                        "is_typing": is_typing
                    }
                )

            elif action == 'read_receipt':
                await database_sync_to_async(self.mark_messages_read)()
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "chat_read_receipt",
                        "reader_id": str(self.user.id),
                        "username": self.user.username
                    }
                )
        except Exception as e:
            await self.send(text_data=json.dumps({
                "status": "error",
                "message": str(e)
            }, cls=DjangoJSONEncoder))

    def check_blocks(self):
        conversation = Conversation.objects.get(id=self.conversation_id)
        participants = conversation.participants.exclude(id=self.user.id)
        for participant in participants:
            if BlockedUser.objects.filter(
                Q(blocker=self.user, blocked=participant) |
                Q(blocker=participant, blocked=self.user)
            ).exists():
                return True
        return False

    def save_message(self, content, media_url, message_type):
        conversation = Conversation.objects.get(id=self.conversation_id)
        message = DirectMessage.objects.create(
            sender=self.user,
            conversation=conversation,
            content=content,
            media_url=media_url,
            message_type=message_type
        )
        conversation.last_message = message
        conversation.save()
        return message

    def serialize_message(self, message):
        return MessageSerializer(message).data

    def mark_messages_read(self):
        DirectMessage.objects.filter(
            conversation_id=self.conversation_id,
            is_read=False
        ).exclude(sender=self.user).update(is_read=True)

    # Broadcast event handlers
    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "type": "message",
            "message": event["message"]
        }, cls=DjangoJSONEncoder))

    async def chat_typing(self, event):
        if event["sender_id"] != str(self.user.id):
            await self.send(text_data=json.dumps({
                "type": "typing",
                "sender_id": event["sender_id"],
                "username": event["username"],
                "is_typing": event["is_typing"]
            }, cls=DjangoJSONEncoder))

    async def chat_read_receipt(self, event):
        if event["reader_id"] != str(self.user.id):
            await self.send(text_data=json.dumps({
                "type": "read_receipt",
                "reader_id": event["reader_id"],
                "username": event["username"]
            }, cls=DjangoJSONEncoder))
