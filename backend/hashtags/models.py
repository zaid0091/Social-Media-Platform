import uuid
from django.db import models
from posts.models import Post

class Hashtag(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    post_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"#{self.name}"

class PostHashtag(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='hashtag_associations')
    hashtag = models.ForeignKey(Hashtag, on_delete=models.CASCADE, related_name='post_associations')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['post', 'hashtag'], name='unique_post_hashtags')
        ]

    def __str__(self):
        return f"Post {self.post.id} tagged with #{self.hashtag.name}"

