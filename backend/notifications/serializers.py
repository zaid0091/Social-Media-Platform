from rest_framework import serializers
from django.contrib.auth import get_user_model
from accounts.serializers import UserFollowDetailsSerializer
from posts.models import Post, Comment
from stories.models import Story
from .models import Notification

class NotificationPostSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ('id', 'content', 'post_type')

class NotificationCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ('id', 'content')

class NotificationStorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Story
        fields = ('id', 'media_url', 'media_type', 'caption')

class NotificationSerializer(serializers.ModelSerializer):
    sender = UserFollowDetailsSerializer(read_only=True)
    recipient = UserFollowDetailsSerializer(read_only=True)
    related_post = NotificationPostSerializer(read_only=True)
    related_comment = NotificationCommentSerializer(read_only=True)
    related_story = NotificationStorySerializer(read_only=True)

    class Meta:
        model = Notification
        fields = (
            'id', 'recipient', 'sender', 'notification_type', 
            'related_post', 'related_comment', 'related_story', 
            'is_read', 'created_at'
        )
