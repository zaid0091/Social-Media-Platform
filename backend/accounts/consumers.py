import json
from django.core.serializers.json import DjangoJSONEncoder
from channels.generic.websocket import AsyncWebsocketConsumer
from urllib.parse import parse_qs
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from django.utils import timezone
from channels.db import database_sync_to_async
from django_redis import get_redis_connection
from .tasks import broadcast_presence_change

User = get_user_model()

class PresenceConsumer(AsyncWebsocketConsumer):
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
            
            user = await database_sync_to_async(User.objects.get)(id=user_id)
            self.user = user
            self.group_name = f"presence_user_{self.user.id}"

            # Join user's presence group to receive updates
            await self.channel_layer.group_add(
                self.group_name,
                self.channel_name
            )

            # Update Redis online status
            await self.redis_set_online()

            # Broadcast online status asynchronously
            await database_sync_to_async(self.trigger_fanout)("online")

            await self.accept()
        except Exception:
            await self.close()

    async def disconnect(self, close_code):
        if hasattr(self, 'user'):
            # Update last seen timestamp in DB
            await self.update_last_seen()

            # Update Redis status
            await self.redis_set_offline()

            # Leave group
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

            # Broadcast offline status
            await database_sync_to_async(self.trigger_fanout)("offline")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            if data.get('type') == 'ping':
                await self.redis_refresh_ttl()
                await self.send(text_data=json.dumps({'type': 'pong'}))
        except Exception:
            pass

    async def presence_update(self, event):
        await self.send(text_data=json.dumps({
            "type": "presence_update",
            "user_id": event["user_id"],
            "status": event["status"]
        }))

    # Helper operations for Redis/DB
    async def redis_set_online(self):
        redis_client = get_redis_connection("default")
        user_key = f"presence_user_{self.user.id}"
        redis_client.setex(user_key, 30, "online")
        redis_client.sadd("online_users", str(self.user.id))

    async def redis_set_offline(self):
        redis_client = get_redis_connection("default")
        user_key = f"presence_user_{self.user.id}"
        redis_client.delete(user_key)
        redis_client.srem("online_users", str(self.user.id))

    async def redis_refresh_ttl(self):
        redis_client = get_redis_connection("default")
        user_key = f"presence_user_{self.user.id}"
        redis_client.expire(user_key, 30)

    @database_sync_to_async
    def update_last_seen(self):
        self.user.last_seen = timezone.now()
        self.user.save(update_fields=['last_seen'])

    def trigger_fanout(self, status):
        broadcast_presence_change.delay(str(self.user.id), status)
