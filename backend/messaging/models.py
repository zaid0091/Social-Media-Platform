import uuid
from django.contrib.auth import get_user_model
from django.db import models

User = get_user_model()

class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    participants = models.ManyToManyField(User, related_name='conversations')
    is_group = models.BooleanField(default=False)
    group_name = models.CharField(max_length=100, null=True, blank=True)
    group_avatar = models.URLField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_groups')
    created_at = models.DateTimeField(auto_now_add=True)
    last_message = models.ForeignKey('DirectMessage', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    def __str__(self):
        if self.is_group and self.group_name:
            return f"Group: {self.group_name} ({self.id})"
        return f"DM Conversation ({self.id})"

class DirectMessage(models.Model):
    MESSAGE_TYPE_CHOICES = (
        ('text', 'Text'),
        ('image', 'Image'),
        ('video', 'Video'),
        ('mixed', 'Mixed'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    content = models.TextField(blank=True)
    media_url = models.URLField(null=True, blank=True)
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPE_CHOICES, default='text')
    is_read = models.BooleanField(default=False)
    is_deleted_for_sender = models.BooleanField(default=False)
    is_deleted_for_receiver = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Message by {self.sender.username} in Conv {self.conversation.id}"

