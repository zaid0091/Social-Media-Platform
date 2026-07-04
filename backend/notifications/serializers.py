from rest_framework import serializers
from django.contrib.auth import get_user_model
from accounts.serializers import UserFollowDetailsSerializer
from posts.models import Post, Comment
from stories.models import Story
from .models import Notification

class NotificationPostSerializer(serializers.ModelSerializer):
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ('id', 'content', 'post_type', 'thumbnail_url')

    def get_thumbnail_url(self, obj):
        first_media = obj.media.first()
        if first_media:
            return first_media.thumbnail_url or first_media.media_url
        return None

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
    follow_request_id = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            'id', 'recipient', 'sender', 'notification_type', 
            'related_post', 'related_comment', 'related_story', 
            'is_read', 'created_at', 'follow_request_id'
        )

    def get_follow_request_id(self, obj):
        if obj.notification_type == 'follow':
            from accounts.models import FollowRequest
            freq = FollowRequest.objects.filter(
                requester=obj.sender, 
                receiver=obj.recipient, 
                status='pending'
            ).first()
            if freq:
                return freq.id
        return None


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


class EmailPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserNotificationPreference
        fields = ('email_digest_enabled', 'email_likes', 'email_comments', 'email_follows', 'email_messages')


