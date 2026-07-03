import json
from django.core.serializers.json import DjangoJSONEncoder
from channels.generic.websocket import AsyncWebsocketConsumer
from urllib.parse import parse_qs
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from django.db.models import Q
from channels.db import database_sync_to_async

from .models import Conversation, DirectMessage, MessageReaction
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
            action = data.get('type')  # type of action: 'message', 'typing', 'read_receipt', 'reaction', etc.
            
            if action == 'message':
                content = data.get('content', '')
                media_url = data.get('media_url', '')
                message_type = data.get('message_type', 'text')
                replied_to_id = data.get('replied_to_id')

                # Verify blocker validations before saving
                is_blocked = await database_sync_to_async(self.check_blocks)()
                if is_blocked:
                    await self.send(text_data=json.dumps({
                        "status": "error",
                        "message": "Cannot send message due to a block relationship."
                    }, cls=DjangoJSONEncoder))
                    return

                # Save message & update last message
                message = await database_sync_to_async(self.save_message)(content, media_url, message_type, replied_to_id)
                
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
                
                from django_redis import get_redis_connection
                try:
                    redis_client = get_redis_connection("default")
                    typing_key = f"typing_user_{self.user.id}_{self.conversation_id}"
                    if is_typing:
                        redis_client.setex(typing_key, 5, "true")
                    else:
                        redis_client.delete(typing_key)
                except Exception:
                    pass

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

            elif action == 'reaction':
                message_id = data.get('message_id')
                emoji = data.get('emoji')
                if not message_id or not emoji:
                    raise Exception("message_id and emoji are required for reaction.")

                res = await database_sync_to_async(self.toggle_reaction)(message_id, emoji)
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "chat_reaction",
                        "message_id": message_id,
                        "user_id": str(self.user.id),
                        "username": self.user.username,
                        "emoji": emoji,
                        "action": res
                    }
                )

            elif action == 'add_participant':
                user_id = data.get('user_id')
                if not user_id:
                    raise Exception("user_id is required.")

                username = await database_sync_to_async(self.db_add_participant)(user_id)
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "chat_participant_added",
                        "user_id": user_id,
                        "username": username
                    }
                )

            elif action == 'remove_participant':
                user_id = data.get('user_id')
                if not user_id:
                    raise Exception("user_id is required.")

                await database_sync_to_async(self.db_remove_participant)(user_id)
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "chat_participant_removed",
                        "user_id": user_id
                    }
                )

            elif action == 'admin_action':
                user_id = data.get('user_id')
                role_action = data.get('action') # 'promote' or 'demote'
                if not user_id or not role_action:
                    raise Exception("user_id and action are required.")

                await database_sync_to_async(self.db_admin_action)(user_id, role_action)
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "chat_admin_action",
                        "user_id": user_id,
                        "action": role_action
                    }
                )

            elif action == 'leave_group':
                await database_sync_to_async(self.db_leave_group)()
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "chat_participant_left",
                        "user_id": str(self.user.id)
                    }
                )

            elif action == 'forward':
                message_id = data.get('message_id')
                target_conversation_id = data.get('target_conversation_id')
                if not message_id or not target_conversation_id:
                    raise Exception("message_id and target_conversation_id are required.")

                forwarded_msg = await database_sync_to_async(self.db_forward_message)(message_id, target_conversation_id)
                forwarded_data = await database_sync_to_async(self.serialize_message)(forwarded_msg)

                # Send to target group
                target_group = f"chat_conversation_{target_conversation_id}"
                await self.channel_layer.group_send(
                    target_group,
                    {
                        "type": "chat_message",
                        "message": forwarded_data
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

    def save_message(self, content, media_url, message_type, replied_to_id=None):
        conversation = Conversation.objects.get(id=self.conversation_id)
        replied_to = None
        if replied_to_id:
            try:
                replied_to = DirectMessage.objects.get(id=replied_to_id, conversation=conversation)
            except DirectMessage.DoesNotExist:
                pass

        message = DirectMessage.objects.create(
            sender=self.user,
            conversation=conversation,
            content=content,
            media_url=media_url,
            message_type=message_type,
            replied_to=replied_to
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

    def get_replied_message(self, replied_to_id):
        try:
            return DirectMessage.objects.get(id=replied_to_id, conversation_id=self.conversation_id)
        except DirectMessage.DoesNotExist:
            return None

    def toggle_reaction(self, message_id, emoji):
        message = DirectMessage.objects.get(id=message_id, conversation_id=self.conversation_id)
        reaction, created = MessageReaction.objects.get_or_create(
            message=message,
            user=self.user,
            defaults={'emoji': emoji}
        )
        if not created:
            if reaction.emoji == emoji:
                reaction.delete()
                return 'removed'
            else:
                reaction.emoji = emoji
                reaction.save()
                return 'added'
        return 'added'

    def db_add_participant(self, user_id):
        conv = Conversation.objects.get(id=self.conversation_id)
        if not conv.is_group:
            raise Exception("Not a group conversation.")
        if not conv.admins.filter(id=self.user.id).exists():
            raise Exception("Only admins can add participants.")
        new_participant = User.objects.get(id=user_id)
        if BlockedUser.objects.filter(
            Q(blocker=self.user, blocked=new_participant) |
            Q(blocker=new_participant, blocked=self.user)
        ).exists():
            raise Exception("Cannot add participant due to block relationship.")
        conv.participants.add(new_participant)
        return new_participant.username

    def db_remove_participant(self, user_id):
        conv = Conversation.objects.get(id=self.conversation_id)
        if not conv.is_group:
            raise Exception("Not a group conversation.")
        if not conv.admins.filter(id=self.user.id).exists():
            raise Exception("Only admins can remove participants.")
        target_user = User.objects.get(id=user_id)
        conv.participants.remove(target_user)
        conv.admins.remove(target_user)

    def db_admin_action(self, user_id, action):
        conv = Conversation.objects.get(id=self.conversation_id)
        if not conv.is_group:
            raise Exception("Not a group conversation.")
        if not conv.admins.filter(id=self.user.id).exists():
            raise Exception("Only admins can perform admin actions.")
        target_user = User.objects.get(id=user_id)
        if not conv.participants.filter(id=target_user.id).exists():
            raise Exception("User is not in the group.")
        if action == 'promote':
            conv.admins.add(target_user)
        elif action == 'demote':
            if target_user == conv.created_by:
                raise Exception("Cannot demote group creator.")
            conv.admins.remove(target_user)

    def db_leave_group(self):
        conv = Conversation.objects.get(id=self.conversation_id)
        if not conv.is_group:
            raise Exception("Not a group conversation.")
        conv.participants.remove(self.user)
        conv.admins.remove(self.user)
        if conv.participants.exists() and not conv.admins.exists():
            next_admin = conv.participants.first()
            conv.admins.add(next_admin)

    def db_forward_message(self, message_id, target_conversation_id):
        msg = DirectMessage.objects.get(id=message_id)
        target_conv = Conversation.objects.get(id=target_conversation_id, participants=self.user)
        participants = target_conv.participants.exclude(id=self.user.id)
        for p in participants:
            if BlockedUser.objects.filter(
                Q(blocker=self.user, blocked=p) |
                Q(blocker=p, blocked=self.user)
            ).exists():
                raise Exception("Cannot forward message due to block relationship.")
        forwarded_msg = DirectMessage.objects.create(
            sender=self.user,
            conversation=target_conv,
            content=f"[Forwarded] {msg.content}" if msg.content else "[Forwarded Media]",
            media_url=msg.media_url,
            message_type=msg.message_type
        )
        target_conv.last_message = forwarded_msg
        target_conv.save()
        return forwarded_msg

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

    async def chat_reaction(self, event):
        await self.send(text_data=json.dumps({
            "type": "reaction",
            "message_id": event["message_id"],
            "user_id": event["user_id"],
            "username": event["username"],
            "emoji": event["emoji"],
            "action": event["action"]
        }, cls=DjangoJSONEncoder))

    async def chat_participant_added(self, event):
        await self.send(text_data=json.dumps({
            "type": "participant_added",
            "user_id": event["user_id"],
            "username": event["username"]
        }, cls=DjangoJSONEncoder))

    async def chat_participant_removed(self, event):
        await self.send(text_data=json.dumps({
            "type": "participant_removed",
            "user_id": event["user_id"]
        }, cls=DjangoJSONEncoder))

    async def chat_admin_action(self, event):
        await self.send(text_data=json.dumps({
            "type": "admin_action",
            "user_id": event["user_id"],
            "action": event["action"]
        }, cls=DjangoJSONEncoder))

    async def chat_participant_left(self, event):
        await self.send(text_data=json.dumps({
            "type": "participant_left",
            "user_id": event["user_id"]
        }, cls=DjangoJSONEncoder))

    async def chat_presence_update(self, event):
        await self.send(text_data=json.dumps({
            "type": "presence_update",
            "user_id": event["user_id"],
            "status": event["status"]
        }, cls=DjangoJSONEncoder))
