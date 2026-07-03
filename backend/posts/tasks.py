from celery import shared_task
from django.contrib.auth import get_user_model
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from accounts.models import Follow
from .models import Post
from .serializers import PostSerializer

User = get_user_model()

@shared_task
def fanout_new_post(post_id, author_id):
    # Retrieve all follower user IDs
    follower_ids = list(Follow.objects.filter(following_id=author_id).values_list('follower_id', flat=True))
    
    # Process in batches of 1000 to manage backpressure
    CHUNK_SIZE = 1000
    for i in range(0, len(follower_ids), CHUNK_SIZE):
        chunk = follower_ids[i:i+CHUNK_SIZE]
        broadcast_post_to_feed_group_chunk.delay(post_id, chunk)

@shared_task
def broadcast_post_to_feed_group_chunk(post_id, follower_ids_chunk):
    try:
        post = Post.objects.get(id=post_id)
    except Post.DoesNotExist:
        return

    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    # Serialize post data
    post_data = PostSerializer(post).data
    
    for follower_id in follower_ids_chunk:
        group_name = f"feed_user_{follower_id}"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "feed_new_post",
                "post": post_data
            }
        )
