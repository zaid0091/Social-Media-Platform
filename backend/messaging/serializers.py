from rest_framework import serializers
from django.contrib.auth import get_user_model
from accounts.serializers import UserFollowDetailsSerializer
from .models import Conversation, DirectMessage, MessageReaction

User = get_user_model()

class MessageReactionSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = MessageReaction
        fields = ('user_id', 'username', 'emoji')

class SimplifiedMessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)

    class Meta:
        model = DirectMessage
        fields = ('id', 'content', 'media_url', 'message_type', 'sender_username')

class MessageSerializer(serializers.ModelSerializer):
    sender = UserFollowDetailsSerializer(read_only=True)
    conversation = serializers.PrimaryKeyRelatedField(read_only=True)
    replied_to = SimplifiedMessageSerializer(read_only=True)
    reactions = MessageReactionSerializer(many=True, read_only=True)

    class Meta:
        model = DirectMessage
        fields = (
            'id', 'sender', 'conversation', 'content', 
            'media_url', 'message_type', 'is_read', 'created_at',
            'replied_to', 'reactions'
        )
        read_only_fields = ('id', 'sender', 'conversation', 'is_read', 'created_at', 'replied_to', 'reactions')

class ConversationSerializer(serializers.ModelSerializer):
    participants = UserFollowDetailsSerializer(many=True, read_only=True)
    admins = UserFollowDetailsSerializer(many=True, read_only=True)
    created_by = UserFollowDetailsSerializer(read_only=True)
    last_message = MessageSerializer(read_only=True)
    unread_count = serializers.SerializerMethodField()
    is_muted = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = (
            'id', 'participants', 'admins', 'is_group', 'group_name', 
            'group_avatar', 'created_by', 'created_at', 
            'last_message', 'unread_count', 'is_muted'
        )
        read_only_fields = ('id', 'participants', 'admins', 'is_group', 'created_by', 'created_at', 'last_message')

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.messages.filter(is_read=False).exclude(sender=request.user).count()
        return 0

    def get_is_muted(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.muted_by.filter(id=request.user.id).exists()
        return False
