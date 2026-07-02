from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q, Count
from django.utils import timezone
from django.core.cache import cache
from datetime import timedelta

from accounts.models import BlockedUser
from posts.models import Post
from .models import Hashtag, PostHashtag
from .serializers import HashtagSerializer

class HashtagDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, name, *args, **kwargs):
        try:
            hashtag = Hashtag.objects.get(name=name.lower())
        except Hashtag.DoesNotExist:
            return Response({"error": "Hashtag not found."}, status=status.HTTP_404_NOT_FOUND)

        # Get associated posts
        post_ids = PostHashtag.objects.filter(hashtag=hashtag).values_list('post_id', flat=True)
        posts = Post.objects.filter(id__in=post_ids, is_deleted=False).order_by('-created_at')

        # Filter out posts from blocked users
        blocked_users = BlockedUser.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
        blockers = BlockedUser.objects.filter(blocked=request.user).values_list('blocker_id', flat=True)
        all_blocked = set(list(blocked_users) + list(blockers))
        posts = posts.exclude(author_id__in=all_blocked)

        # Paginate posts list
        paginator = PageNumberPagination()
        paginator.page_size = 10
        result_page = paginator.paginate_queryset(posts, request)
        
        from posts.serializers import PostSerializer
        post_serializer = PostSerializer(result_page, many=True, context={'request': request})

        return Response({
            "hashtag": HashtagSerializer(hashtag).data,
            "posts": paginator.get_paginated_response(post_serializer.data).data
        }, status=status.HTTP_200_OK)

class TrendingHashtagsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # Retrieve from cache
        cached_trending = cache.get("trending_hashtags")
        if cached_trending is not None:
            return Response(cached_trending, status=status.HTTP_200_OK)

        # Recalculate on cache miss
        time_threshold = timezone.now() - timedelta(hours=24)
        trending_qs = Hashtag.objects.filter(
            post_associations__created_at__gte=time_threshold,
            post_associations__post__is_deleted=False
        ).annotate(
            recent_post_count=Count('post_associations')
        ).order_by('-recent_post_count', '-post_count')[:10]

        if not trending_qs.exists():
            trending_qs = Hashtag.objects.filter(post_count__gt=0).order_by('-post_count')[:10]

        serializer = HashtagSerializer(trending_qs, many=True)
        # Store in Cache for 15 minutes
        cache.set("trending_hashtags", serializer.data, timeout=900)
        return Response(serializer.data, status=status.HTTP_200_OK)

class HashtagSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response([], status=status.HTTP_200_OK)

        # Prefix search case-insensitive
        hashtags = Hashtag.objects.filter(name__istartswith=query).order_by('-post_count')[:10]
        serializer = HashtagSerializer(hashtags, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
