import uuid
from django.contrib.auth import get_user_model
from django.db import models
from posts.models import Post, Comment
from stories.models import Story

User = get_user_model()

class Notification(models.Model):
    NOTIFICATION_TYPE_CHOICES = (
        ('like', 'Like'),
        ('comment', 'Comment'),
        ('follow', 'Follow'),
        ('mention', 'Mention'),
        ('message', 'Message'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_notifications')
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPE_CHOICES)
    
    # Optional links depending on target type
    related_post = models.ForeignKey(Post, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    related_comment = models.ForeignKey(Comment, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    related_story = models.ForeignKey(Story, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification ({self.notification_type}) from {self.sender.username} to {self.recipient.username}"


class DeviceToken(models.Model):
    DEVICE_TYPE_CHOICES = (
        ('web', 'Web'),
        ('android', 'Android'),
        ('ios', 'iOS'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='device_tokens')
    token = models.CharField(max_length=500, unique=True)
    device_type = models.CharField(max_length=10, choices=DEVICE_TYPE_CHOICES, default='web')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.device_type} token"


class UserNotificationPreference(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='notification_preferences')
    push_likes = models.BooleanField(default=True)
    push_comments = models.BooleanField(default=True)
    push_follows = models.BooleanField(default=True)
    push_messages = models.BooleanField(default=True)

    # Email preferences
    email_digest_enabled = models.BooleanField(default=True)
    email_likes = models.BooleanField(default=False)
    email_comments = models.BooleanField(default=False)
    email_follows = models.BooleanField(default=False)
    email_messages = models.BooleanField(default=False)

    def __str__(self):
        return f"Notification Preferences for {self.user.username}"

