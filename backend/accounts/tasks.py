from celery import shared_task
from django.contrib.auth import get_user_model
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from accounts.models import Follow
from messaging.models import Conversation

User = get_user_model()

@shared_task
def broadcast_presence_change(user_id, status):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    # 1. Notify followers
    follower_ids = list(Follow.objects.filter(following_id=user_id).values_list('follower_id', flat=True))
    for fid in follower_ids:
        async_to_sync(channel_layer.group_send)(
            f"presence_user_{fid}",
            {
                "type": "presence_update",
                "user_id": user_id,
                "status": status
            }
        )

    # 2. Notify active chat conversations
    conversations = Conversation.objects.filter(participants__id=user_id)
    for conversation in conversations:
        async_to_sync(channel_layer.group_send)(
            f"chat_conversation_{conversation.id}",
            {
                "type": "chat_presence_update",
                "user_id": user_id,
                "status": status
            }
        )
