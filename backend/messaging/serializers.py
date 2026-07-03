from rest_framework import serializers
from django.contrib.auth import get_user_model
from accounts.serializers import UserFollowDetailsSerializer
from .models import Conversation, DirectMessage

User = get_user_model()

class MessageSerializer(serializers.ModelSerializer):
    sender = UserFollowDetailsSerializer(read_only=True)
    conversation = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = DirectMessage
        fields = (
            'id', 'sender', 'conversation', 'content', 
            'media_url', 'message_type', 'is_read', 'created_at'
        )
        read_only_fields = ('id', 'sender', 'conversation', 'is_read', 'created_at')

class ConversationSerializer(serializers.ModelSerializer):
    participants = UserFollowDetailsSerializer(many=True, read_only=True)
    created_by = UserFollowDetailsSerializer(read_only=True)
    last_message = MessageSerializer(read_only=True)
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = (
            'id', 'participants', 'is_group', 'group_name', 
            'group_avatar', 'created_by', 'created_at', 
            'last_message', 'unread_count'
        )
        read_only_fields = ('id', 'participants', 'is_group', 'created_by', 'created_at', 'last_message')

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            # Unread messages in the conversation that are not sent by the requesting user
            return obj.messages.filter(is_read=False).exclude(sender=request.user).count()
        return 0
