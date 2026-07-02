from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from accounts.serializers import UserFollowDetailsSerializer
from accounts.models import Follow
from .models import Post, PostMedia, Like, Bookmark

User = get_user_model()

class PostMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostMedia
        fields = ('id', 'media_url', 'media_type', 'order', 'thumbnail_url', 'duration')

class PostSerializer(serializers.ModelSerializer):
    author = UserFollowDetailsSerializer(read_only=True)
    media = PostMediaSerializer(many=True, read_only=True)
    hashtags = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    is_following_author = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = (
            'id', 'author', 'content', 'post_type', 'privacy',
            'media', 'hashtags', 'like_count', 'comment_count',
            'share_count', 'bookmark_count', 'view_count',
            'is_liked', 'is_bookmarked', 'is_following_author',
            'created_at', 'updated_at'
        )

    def get_hashtags(self, obj):
        return list(obj.hashtag_associations.values_list('hashtag__name', flat=True))

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        post_ct = ContentType.objects.get_for_model(Post)
        return Like.objects.filter(
            user=request.user,
            content_type=post_ct,
            object_id=obj.id
        ).exists()

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return Bookmark.objects.filter(user=request.user, post=obj).exists()

    def get_is_following_author(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        if request.user == obj.author:
            return False
        return Follow.objects.filter(follower=request.user, following=obj.author).exists()

class PostCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ('content', 'privacy', 'post_type')
        extra_kwargs = {
            'content': {'required': False, 'allow_blank': True},
            'privacy': {'required': False},
            'post_type': {'required': False}
        }
