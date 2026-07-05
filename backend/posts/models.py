import uuid
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

User = get_user_model()

class Post(models.Model):
    POST_TYPE_CHOICES = (
        ('text', 'Text'),
        ('image', 'Image'),
        ('video', 'Video'),
        ('mixed', 'Mixed'),
    )
    PRIVACY_CHOICES = (
        ('public', 'Public'),
        ('followers', 'Followers Only'),
        ('private', 'Private'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
    content = models.TextField(max_length=2200, blank=True)
    post_type = models.CharField(max_length=10, choices=POST_TYPE_CHOICES, default='text')
    privacy = models.CharField(max_length=10, choices=PRIVACY_CHOICES, default='public')
    
    # Caches for performance optimization
    like_count = models.IntegerField(default=0)
    comment_count = models.IntegerField(default=0)
    share_count = models.IntegerField(default=0)
    bookmark_count = models.IntegerField(default=0)
    view_count = models.IntegerField(default=0)
    
    is_deleted = models.BooleanField(default=False)
    is_hidden = models.BooleanField(default=False)
    needs_review = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Post by {self.author.username} ({self.id})"

class PostMedia(models.Model):
    MEDIA_TYPE_CHOICES = (
        ('image', 'Image'),
        ('video', 'Video'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='media')
    media_url = models.URLField()
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPE_CHOICES)
    order = models.PositiveIntegerField(default=0)
    thumbnail_url = models.URLField(blank=True, null=True)
    duration = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True) # in seconds for video

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"Media {self.order} ({self.media_type}) for Post {self.post.id}"

class Comment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='comments')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    content = models.TextField(max_length=1000)
    like_count = models.IntegerField(default=0)
    reply_count = models.IntegerField(default=0)
    is_deleted = models.BooleanField(default=False)
    is_hidden = models.BooleanField(default=False)
    needs_review = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Comment by {self.author.username} on Post {self.post.id}"

class Like(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='likes')
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField()
    content_object = GenericForeignKey('content_type', 'object_id')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'content_type', 'object_id'], name='unique_likes')
        ]

    def __str__(self):
        return f"Like by {self.user.username} on {self.content_type.model} {self.object_id}"

class Bookmark(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookmarks')
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='bookmarks')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'post'], name='unique_bookmarks')
        ]

    def __str__(self):
        return f"Bookmark by {self.user.username} of Post {self.post.id}"

class PostShare(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shares')
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='shares')
    shared_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Share by {self.user.username} of Post {self.post.id}"

class PostView(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='views') # null if anonymous view
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='views')
    viewed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"View of Post {self.post.id} (user: {self.user.username if self.user else 'Anonymous'})"


class Collection(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='collections')
    name = models.CharField(max_length=100)
    posts = models.ManyToManyField(Post, related_name='collections')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'name'], name='unique_user_collections')
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"Collection {self.name} by {self.user.username}"

