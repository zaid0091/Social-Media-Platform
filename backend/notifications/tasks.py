from celery import shared_task
from django.contrib.auth import get_user_model
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
    return f"Created notification {notification.id} of type {notification_type}"
