import uuid
from django.contrib.auth import get_user_model
from django.db import models
from posts.models import Post, Comment
from stories.models import Story

User = get_user_model()

class Report(models.Model):
    REASON_CHOICES = (
        ('spam', 'Spam'),
        ('hate_speech', 'Hate Speech'),
        ('nudity', 'Nudity'),
        ('harassment', 'Harassment'),
        ('false_information', 'False Information'),
        ('other', 'Other'),
    )
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('resolved', 'Resolved'),
        ('dismissed', 'Dismissed'),
        ('needs_review', 'Needs Review'),
    )
    ACTION_CHOICES = (
        ('no_action', 'No Action'),
        ('warning_issued', 'Warning Issued'),
        ('content_removed', 'Content Removed'),
        ('user_suspended', 'User Suspended'),
        ('user_banned', 'User Banned'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='filed_reports', null=True, blank=True)
    
    # Optional foreign keys depending on report target
    reported_user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='reports_received')
    reported_post = models.ForeignKey(Post, on_delete=models.CASCADE, null=True, blank=True, related_name='reports_received')
    reported_comment = models.ForeignKey(Comment, on_delete=models.CASCADE, null=True, blank=True, related_name='reports_received')
    reported_story = models.ForeignKey(Story, on_delete=models.CASCADE, null=True, blank=True, related_name='reports_received')
    
    reason = models.CharField(max_length=20, choices=REASON_CHOICES)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    action_taken = models.CharField(max_length=30, choices=ACTION_CHOICES, null=True, blank=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_reports')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        target = "Unknown"
        if self.reported_user:
            target = f"User {self.reported_user.username}"
        elif self.reported_post:
            target = f"Post {self.reported_post.id}"
        elif self.reported_comment:
            target = f"Comment {self.reported_comment.id}"
        elif self.reported_story:
            target = f"Story {self.reported_story.id}"
        return f"Report ({self.reason}) by {self.reporter.username if self.reporter else 'System'} on {target}"
