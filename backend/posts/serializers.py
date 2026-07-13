from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from accounts.serializers import UserFollowDetailsSerializer
from accounts.models import Follow
from .models import Post, PostMedia, Like, Bookmark, Comment, Collection

User = get_user_model()

class PostMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostMedia
        fields = ('id', 'media_url', 'media_type', 'order', 'thumbnail_url', 'duration', 'blur_hash')

class RepostedPostSerializer(serializers.ModelSerializer):
    author = UserFollowDetailsSerializer(read_only=True)
    media = PostMediaSerializer(many=True, read_only=True)
    hashtags = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = (
            'id', 'author', 'content', 'post_type', 'privacy',
            'media', 'hashtags', 'like_count', 'comment_count',
            'share_count', 'bookmark_count', 'repost_count', 'view_count',
            'created_at', 'updated_at'
        )

    def get_hashtags(self, obj):
        return list(obj.hashtag_associations.values_list('hashtag__name', flat=True))

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        from django.core.cache import cache
        cache_key = f"post_engagement:{instance.id}"
        
        def get_engagement_data():
            return {
                'like_count': instance.like_count,
                'comment_count': instance.comment_count,
                'share_count': instance.share_count,
                'bookmark_count': instance.bookmark_count,
                'repost_count': instance.repost_count,
                'view_count': instance.view_count,
            }
            
        engagement = cache.get_or_set(cache_key, get_engagement_data, timeout=60)
        ret.update(engagement)
        return ret


class PostSerializer(serializers.ModelSerializer):
    author = UserFollowDetailsSerializer(read_only=True)
    media = PostMediaSerializer(many=True, read_only=True)
    hashtags = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    is_following_author = serializers.SerializerMethodField()
    repost_of = RepostedPostSerializer(read_only=True)
    is_reposted = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = (
            'id', 'author', 'content', 'post_type', 'privacy',
            'media', 'hashtags', 'like_count', 'comment_count',
            'share_count', 'bookmark_count', 'repost_count', 'view_count',
            'is_liked', 'is_bookmarked', 'is_following_author',
            'repost_of', 'is_reposted', 'created_at', 'updated_at'
        )

    def get_hashtags(self, obj):
        return list(obj.hashtag_associations.values_list('hashtag__name', flat=True))

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        from django.core.cache import cache
        cache_key = f"post_engagement:{instance.id}"
        
        def get_engagement_data():
            return {
                'like_count': instance.like_count,
                'comment_count': instance.comment_count,
                'share_count': instance.share_count,
                'bookmark_count': instance.bookmark_count,
                'repost_count': instance.repost_count,
                'view_count': instance.view_count,
            }
            
        engagement = cache.get_or_set(cache_key, get_engagement_data, timeout=60)
        ret.update(engagement)
        return ret

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

    def get_is_reposted(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return Post.objects.filter(author=request.user, repost_of=obj, post_type='repost').exists()

    def get_is_following_author(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        if request.user == obj.author:
            return False
        return Follow.objects.filter(follower=request.user, following=obj.author).exists()

class PostCreateSerializer(serializers.ModelSerializer):
    media = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        write_only=True
    )

    class Meta:
        model = Post
        fields = ('content', 'privacy', 'post_type', 'media')
        extra_kwargs = {
            'content': {'required': False, 'allow_blank': True},
            'privacy': {'required': False},
            'post_type': {'required': False}
        }

    def create(self, validated_data):
        media_data = validated_data.pop('media', [])
        
        # Determine post type automatically if media is provided
        if media_data:
            types = {item.get('media_type', 'image') for item in media_data}
            if len(types) > 1:
                validated_data['post_type'] = 'mixed'
            elif 'video' in types:
                validated_data['post_type'] = 'video'
            else:
                validated_data['post_type'] = 'image'
        else:
            validated_data['post_type'] = 'text'

        post = super().create(validated_data)

        for index, item in enumerate(media_data):
            PostMedia.objects.create(
                post=post,
                media_url=item.get('media_url'),
                media_type=item.get('media_type', 'image'),
                order=item.get('order', index),
                thumbnail_url=item.get('thumbnail_url'),
                duration=item.get('duration'),
                blur_hash=item.get('blur_hash')
            )
        return post

    def update(self, instance, validated_data):
        media_data = validated_data.pop('media', None)
        
        # Determine post type automatically if media is provided
        if media_data is not None:
            if media_data:
                types = {item.get('media_type', 'image') for item in media_data}
                if len(types) > 1:
                    validated_data['post_type'] = 'mixed'
                elif 'video' in types:
                    validated_data['post_type'] = 'video'
                else:
                    validated_data['post_type'] = 'image'
            else:
                validated_data['post_type'] = 'text'

        post = super().update(instance, validated_data)

        if media_data is not None:
            # Recreate media associations
            instance.media.all().delete()
            for index, item in enumerate(media_data):
                PostMedia.objects.create(
                    post=post,
                    media_url=item.get('media_url'),
                    media_type=item.get('media_type', 'image'),
                    order=item.get('order', index),
                    thumbnail_url=item.get('thumbnail_url'),
                    duration=item.get('duration'),
                    blur_hash=item.get('blur_hash')
                )
        return post

class CommentSerializer(serializers.ModelSerializer):
    author = UserFollowDetailsSerializer(read_only=True)
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ('id', 'post', 'author', 'parent', 'content', 'like_count', 'reply_count', 'is_liked', 'created_at')

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        comment_ct = ContentType.objects.get_for_model(Comment)
        return Like.objects.filter(
            user=request.user,
            content_type=comment_ct,
            object_id=obj.id
        ).exists()

class CommentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ('post', 'content', 'parent')

    def validate(self, attrs):
        parent = attrs.get('parent')
        post = attrs.get('post')
        if parent and parent.post != post:
            raise serializers.ValidationError("Parent comment must belong to the same post.")
        return attrs


class CollectionSerializer(serializers.ModelSerializer):
    post_count = serializers.IntegerField(source='posts.count', read_only=True)
    post_ids = serializers.PrimaryKeyRelatedField(many=True, read_only=True, source='posts')
    cover_image = serializers.SerializerMethodField()

    class Meta:
        model = Collection
        fields = ('id', 'name', 'post_count', 'post_ids', 'cover_image', 'created_at')
        read_only_fields = ('id', 'created_at')

    def get_cover_image(self, obj):
        first_post = obj.posts.prefetch_related('media').first()
        if first_post:
            first_media = first_post.media.first()
            if first_media:
                return first_media.media_url
        return None


class CollectionDetailSerializer(serializers.ModelSerializer):
    posts = PostSerializer(many=True, read_only=True)

    class Meta:
        model = Collection
        fields = ('id', 'name', 'posts', 'created_at')
        read_only_fields = ('id', 'created_at')

