from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.contenttypes.models import ContentType
from posts.models import Post, Comment, Like
from accounts.models import Follow, FollowRequest
from .utils import create_notification

@receiver(post_save, sender=Like)
def notify_post_like(sender, instance, created, **kwargs):
    if created:
        content_type = instance.content_type
        if content_type.model == 'post':
            try:
                post = content_type.model_class().objects.get(id=instance.object_id)
                create_notification(
                    recipient=post.author,
                    sender=instance.user,
                    notification_type='like',
                    related_post=post
                )
            except Exception:
                pass

@receiver(post_save, sender=Comment)
def notify_comment(sender, instance, created, **kwargs):
    if created and not instance.is_deleted:
        post = instance.post
        if instance.parent:
            # Comment reply
            parent = instance.parent
            create_notification(
                recipient=parent.author,
                sender=instance.author,
                notification_type='comment',
                related_post=post,
                related_comment=instance
            )
        else:
            # Top-level comment
            create_notification(
                recipient=post.author,
                sender=instance.author,
                notification_type='comment',
                related_post=post,
                related_comment=instance
            )

@receiver(post_save, sender=Follow)
def notify_follow(sender, instance, created, **kwargs):
    if created:
        create_notification(
            recipient=instance.following,
            sender=instance.follower,
            notification_type='follow'
        )

@receiver(post_save, sender=FollowRequest)
def notify_follow_request(sender, instance, created, **kwargs):
    if created and instance.status == 'pending':
        create_notification(
            recipient=instance.receiver,
            sender=instance.requester,
            notification_type='follow'
        )
