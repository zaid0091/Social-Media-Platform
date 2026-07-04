import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ACCOUNT_TYPE_CHOICES = (
        ('personal', 'Personal'),
        ('creator', 'Creator'),
        ('business', 'Business'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True) # Unique and required
    full_name = models.CharField(max_length=150, blank=True)
    bio = models.TextField(max_length=500, blank=True)
    profile_picture = models.ImageField(upload_to='profile_pics/', blank=True, null=True)
    cover_photo = models.ImageField(upload_to='cover_photos/', blank=True, null=True)
    website = models.URLField(max_length=200, blank=True, null=True)
    location = models.CharField(max_length=100, blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    
    is_verified = models.BooleanField(default=False)
    is_private = models.BooleanField(default=False)
    account_type = models.CharField(
        max_length=20,
        choices=ACCOUNT_TYPE_CHOICES,
        default='personal'
    )
    
    # Caches for counts
    follower_count = models.IntegerField(default=0)
    following_count = models.IntegerField(default=0)
    post_count = models.IntegerField(default=0)
    last_seen = models.DateTimeField(null=True, blank=True)
    
    # Moderation fields
    is_suspended = models.BooleanField(default=False)
    suspension_expires_at = models.DateTimeField(null=True, blank=True)
    is_banned = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.username

class Follow(models.Model):
    follower = models.ForeignKey(User, on_delete=models.CASCADE, related_name='following_relations')
    following = models.ForeignKey(User, on_delete=models.CASCADE, related_name='follower_relations')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['follower', 'following'], name='unique_followers')
        ]

    def __str__(self):
        return f"{self.follower} follows {self.following}"

class FollowRequest(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    )
    requester = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_follow_requests')
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_follow_requests')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['requester', 'receiver'], name='unique_follow_requests')
        ]

    def __str__(self):
        return f"{self.requester} wants to follow {self.receiver} ({self.status})"

class BlockedUser(models.Model):
    blocker = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocking_relations')
    blocked = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocked_relations')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['blocker', 'blocked'], name='unique_blocks')
        ]

    def __str__(self):
        return f"{self.blocker} blocked {self.blocked}"


class UserDevice(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='devices')
    user_agent = models.TextField()
    ip_address = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} device login from {self.ip_address}"


