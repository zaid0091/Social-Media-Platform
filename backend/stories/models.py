import uuid
from django.contrib.auth import get_user_model
from django.db import models
from datetime import timedelta

User = get_user_model()

class Story(models.Model):
    MEDIA_TYPE_CHOICES = (
        ('image', 'Image'),
        ('video', 'Video'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='stories')
    media_url = models.URLField()
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPE_CHOICES)
    caption = models.CharField(max_length=200, blank=True)
    duration = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True) # in seconds for video
    view_count = models.IntegerField(default=0)
    expires_at = models.DateTimeField(blank=True)
    is_expired = models.BooleanField(default=False)
    is_hidden = models.BooleanField(default=False)
    needs_review = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.expires_at:
            from django.utils import timezone
            self.expires_at = timezone.now() + timedelta(hours=24)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Story by {self.author.username} ({self.id})"

class StoryView(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='views')
    viewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='story_views')
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['story', 'viewer'], name='unique_story_views')
        ]

    def __str__(self):
        return f"{self.viewer.username} viewed Story {self.story.id}"

class StoryHighlight(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='story_highlights')
    title = models.CharField(max_length=100)
    cover_image = models.URLField(blank=True, null=True)
    stories = models.ManyToManyField(Story, related_name='highlights')

    def __str__(self):
        return f"Highlight '{self.title}' by {self.author.username}"

