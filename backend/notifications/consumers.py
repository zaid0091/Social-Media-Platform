import json
from channels.generic.websocket import AsyncWebsocketConsumer
from urllib.parse import parse_qs
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async

User = get_user_model()

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        params = parse_qs(query_string)
        token = params.get('token', [None])[0]

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
            self.group_name = f"notifications_user_{self.user.id}"

            # Join channel group
            await self.channel_layer.group_add(
                self.group_name,
                self.channel_name
            )
            await self.accept()
        except Exception:
            await self.close()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            action = data.get('action')
            if action == 'mark_read':
                notification_id = data.get('notification_id')
                if notification_id:
                    await database_sync_to_async(self.mark_notification_read)(notification_id)
                    await self.send(text_data=json.dumps({
                        "status": "success",
                        "message": f"Notification {notification_id} marked as read"
                    }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                "status": "error",
                "message": str(e)
            }))

    def mark_notification_read(self, notification_id):
        from notifications.models import Notification
        Notification.objects.filter(id=notification_id, recipient=self.user).update(is_read=True)

    async def notification_message(self, event):
        notification = event.get('notification')
        await self.send(text_data=json.dumps({
            "type": "notification",
            "notification": notification
        }))
