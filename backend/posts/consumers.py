import json
from django.core.serializers.json import DjangoJSONEncoder
from channels.generic.websocket import AsyncWebsocketConsumer
from urllib.parse import parse_qs
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async

User = get_user_model()

class FeedConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        params = parse_qs(query_string)
        token = params.get('token', [None])[0]

        if not token:
            await self.close()
            return

        try:
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            
            # Fetch user asynchronously
            user = await database_sync_to_async(User.objects.get)(id=user_id)
            self.user = user

            self.group_name = f"feed_user_{self.user.id}"

            # Join feed channel group
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
        pass

    # Broadcast event handler
    async def feed_new_post(self, event):
        await self.send(text_data=json.dumps({
            "type": "new_post",
            "post": event["post"]
        }, cls=DjangoJSONEncoder))


class PostEngagementConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.post_id = self.scope['url_route']['kwargs']['post_id']
        self.group_name = f"post_engagement_{self.post_id}"

        # Join post engagement group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        pass

    # Broadcast event handler
    async def engagement_update(self, event):
        await self.send(text_data=json.dumps({
            "type": "engagement_update",
            "likes_count": event["likes_count"],
            "comments_count": event["comments_count"]
        }, cls=DjangoJSONEncoder))
