def create_notification(recipient, sender, notification_type, related_post=None, related_comment=None, related_story=None):
    from .tasks import send_async_notification
    send_async_notification.delay(
        recipient_id=str(recipient.id),
        sender_id=str(sender.id),
        notification_type=notification_type,
        related_post_id=str(related_post.id) if related_post else None,
        related_comment_id=str(related_comment.id) if related_comment else None,
        related_story_id=str(related_story.id) if related_story else None
    )
