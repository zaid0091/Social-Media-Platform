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


from .models import DeviceToken, UserNotificationPreference

class DeviceTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceToken
        fields = ('id', 'user', 'token', 'device_type', 'created_at')
        read_only_fields = ('id', 'user', 'created_at')
        extra_kwargs = {
            'token': {
                'validators': []
            }
        }

    def create(self, validated_data):
        user = self.context['request'].user
        token = validated_data['token']
        device_type = validated_data.get('device_type', 'web')
        # Use get_or_create or update existing token's user ownership
        device_token, created = DeviceToken.objects.update_or_create(
            token=token,
            defaults={'user': user, 'device_type': device_type}
        )
        return device_token


class UserNotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserNotificationPreference
        fields = ('push_likes', 'push_comments', 'push_follows', 'push_messages')

