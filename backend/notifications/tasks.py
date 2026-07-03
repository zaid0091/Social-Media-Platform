from celery import shared_task
from django.contrib.auth import get_user_model
from django_redis import get_redis_connection
from posts.models import Post, Comment
from stories.models import Story
from .models import Notification

User = get_user_model()

@shared_task
def send_async_notification(recipient_id, sender_id, notification_type, related_post_id=None, related_comment_id=None, related_story_id=None):
    try:
        recipient = User.objects.get(id=recipient_id)
        sender = User.objects.get(id=sender_id)
    except User.DoesNotExist:
        return "Users not found"

    # Avoid notifying oneself
    if recipient == sender:
        return "Self-notification skipped"

    # Verify Block relationship
    from accounts.models import BlockedUser
    from django.db.models import Q
    if BlockedUser.objects.filter(
        Q(blocker=recipient, blocked=sender) |
        Q(blocker=sender, blocked=recipient)
    ).exists():
        return "Notification blocked due to block relationship"

    related_post = None
    if related_post_id:
        try:
            related_post = Post.objects.get(id=related_post_id)
        except Post.DoesNotExist:
            pass

    related_comment = None
    if related_comment_id:
        try:
            related_comment = Comment.objects.get(id=related_comment_id)
        except Comment.DoesNotExist:
            pass

    related_story = None
    if related_story_id:
        try:
            related_story = Story.objects.get(id=related_story_id)
        except Story.DoesNotExist:
            pass

    notification = Notification.objects.create(
        recipient=recipient,
        sender=sender,
        notification_type=notification_type,
        related_post=related_post,
        related_comment=related_comment,
        related_story=related_story
    )

    # Broadcast notification to group layer
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync
    from .serializers import NotificationSerializer

    channel_layer = get_channel_layer()
    if channel_layer:
        try:
            serializer = NotificationSerializer(notification)
            async_to_sync(channel_layer.group_send)(
                f"notifications_user_{recipient.id}",
                {
                    "type": "notification_message",
                    "notification": serializer.data
                }
            )
        except Exception:
            pass

    # Phase 28: Check recipient presence and trigger FCM push notification if offline
    is_online = False
    try:
        redis_client = get_redis_connection("default")
        is_online = redis_client.exists(f"presence_user_{recipient.id}") > 0
    except Exception:
        pass

    if not is_online:
        send_async_push_notification.delay(str(notification.id))

    return f"Created notification {notification.id} of type {notification_type}"


@shared_task
def send_async_push_notification(notification_id):
    try:
        from .models import UserNotificationPreference
        from .utils_fcm import send_push_notification

        notification = Notification.objects.get(id=notification_id)
        recipient = notification.recipient

        # Check preferences
        pref, _ = UserNotificationPreference.objects.get_or_create(user=recipient)

        should_send = False
        nt = notification.notification_type
        if nt == 'like' and pref.push_likes:
            should_send = True
        elif nt == 'comment' and pref.push_comments:
            should_send = True
        elif nt == 'follow' and pref.push_follows:
            should_send = True
        elif nt == 'message' and pref.push_messages:
            should_send = True
        elif nt == 'mention':
            should_send = True

        if not should_send:
            return "Push notification skipped due to user preference settings"

        tokens = recipient.device_tokens.all()
        if not tokens.exists():
            return "No registered device tokens for recipient"

        sender_name = notification.sender.username if notification.sender else "Someone"
        title = "New Alert"
        body = f"You received a new {nt}."

        if nt == 'like':
            title = "New Like"
            body = f"{sender_name} liked your post."
        elif nt == 'comment':
            title = "New Comment"
            body = f"{sender_name} commented on your post."
        elif nt == 'follow':
            title = "New Follower"
            body = f"{sender_name} started following you."
        elif nt == 'message':
            title = "New Message"
            body = f"{sender_name} sent you a message."
        elif nt == 'mention':
            title = "New Mention"
            body = f"{sender_name} mentioned you in a post."

        data = {
            "notification_id": str(notification.id),
            "notification_type": nt
        }

        sent_count = 0
        for t in tokens:
            res = send_push_notification(t.token, title, body, data)
            if res:
                sent_count += 1

        return f"Successfully sent push to {sent_count} of {tokens.count()} devices"
    except Exception as e:
        return f"Error sending push: {e}"
