from rest_framework import serializers
from django.utils import timezone
from accounts.serializers import UserFollowDetailsSerializer
from .models import Story, StoryView, StoryHighlight

class StorySerializer(serializers.ModelSerializer):
    author = UserFollowDetailsSerializer(read_only=True)
    time_remaining = serializers.SerializerMethodField()
    is_viewed_by_me = serializers.SerializerMethodField()

    class Meta:
        model = Story
        fields = (
            'id', 'author', 'media_url', 'media_type', 'caption', 
            'duration', 'view_count', 'expires_at', 'is_expired', 
            'created_at', 'time_remaining', 'is_viewed_by_me'
        )

    def get_time_remaining(self, obj):
        now = timezone.now()
        if obj.expires_at > now:
            return max(0, int((obj.expires_at - now).total_seconds()))
        return 0

    def get_is_viewed_by_me(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return StoryView.objects.filter(story=obj, viewer=request.user).exists()
        return False

class StoryHighlightSerializer(serializers.ModelSerializer):
    author = UserFollowDetailsSerializer(read_only=True)
    stories = StorySerializer(many=True, read_only=True)

    class Meta:
        model = StoryHighlight
        fields = ('id', 'author', 'title', 'cover_image', 'stories')

class StoryHighlightCreateSerializer(serializers.ModelSerializer):
    stories = serializers.PrimaryKeyRelatedField(
        many=True, 
        queryset=Story.objects.all()
    )

    class Meta:
        model = StoryHighlight
        fields = ('title', 'cover_image', 'stories')

    def validate_stories(self, value):
        user = self.context['request'].user
        # Verify that all stories belong to the user
        for story in value:
            if story.author != user:
                raise serializers.ValidationError("You can only add your own stories to highlights.")
        return value

class StoryViewSerializer(serializers.ModelSerializer):
    viewer = UserFollowDetailsSerializer(read_only=True)

    class Meta:
        model = StoryView
        fields = ('id', 'viewer', 'viewed_at')
