from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Report
from posts.models import Post, Comment
from stories.models import Story

User = get_user_model()

class ReportSerializer(serializers.ModelSerializer):
    reporter_username = serializers.CharField(source='reporter.username', read_only=True, default='System')
    reported_user_username = serializers.CharField(source='reported_user.username', read_only=True)
    reviewed_by_username = serializers.CharField(source='reviewed_by.username', read_only=True)

    class Meta:
        model = Report
        fields = (
            'id', 'reporter', 'reporter_username', 'reported_user', 'reported_user_username',
            'reported_post', 'reported_comment', 'reported_story',
            'reason', 'description', 'status', 'action_taken',
            'reviewed_by', 'reviewed_by_username', 'created_at'
        )
        read_only_fields = ('id', 'status', 'action_taken', 'reviewed_by', 'created_at')

class ReportCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ('reported_user', 'reported_post', 'reported_comment', 'reported_story', 'reason', 'description')

    def validate(self, data):
        # Enforce that at least one target is specified
        targets = [
            data.get('reported_user'),
            data.get('reported_post'),
            data.get('reported_comment'),
            data.get('reported_story')
        ]
        if not any(targets):
            raise serializers.ValidationError("You must report a user, post, comment, or story.")
        return data
