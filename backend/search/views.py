from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.contrib.auth import get_user_model
from django.db.models import Q, Value
from django.db.models.functions import Coalesce
from django.contrib.postgres.search import TrigramSimilarity
from django_redis import get_redis_connection
import time

from accounts.models import BlockedUser, Follow
from posts.models import Post
from hashtags.models import Hashtag
from hashtags.serializers import HashtagSerializer
from accounts.serializers import UserFollowDetailsSerializer
from posts.serializers import PostSerializer

User = get_user_model()

def add_search_query(user, query):
    if not query:
        return
    try:
        r = get_redis_connection("default")
        key = f"search_history:{user.id}"
        # ZADD to store query with current timestamp as score
        r.zadd(key, {query: time.time()})
        # Keep only the last 15 queries
        r.zremrangebyrank(key, 0, -16)
        # Set 30 days expiration (30 * 24 * 3600 = 2592000 seconds)
        r.expire(key, 2592000)
    except Exception:
        pass

class UserSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({"results": []}, status=status.HTTP_200_OK)

        add_search_query(request.user, query)

        # Exclude blocked users
        blocked_users = BlockedUser.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
        blockers = BlockedUser.objects.filter(blocked=request.user).values_list('blocker_id', flat=True)
        all_blocked = set(list(blocked_users) + list(blockers))

        similarity = (
            TrigramSimilarity('username', query) +
            TrigramSimilarity('full_name', query) +
            TrigramSimilarity(Coalesce('bio', Value('')), query)
        )

        users = User.objects.annotate(
            similarity=similarity
        ).filter(
            Q(similarity__gt=0.05) |
            Q(username__icontains=query) |
            Q(full_name__icontains=query)
        ).exclude(
            id__in=all_blocked
        ).order_by('-similarity', '-follower_count')

        paginator = PageNumberPagination()
        paginator.page_size = 10
        result_page = paginator.paginate_queryset(users, request)
        serializer = UserFollowDetailsSerializer(result_page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

class PostSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({"results": []}, status=status.HTTP_200_OK)

        add_search_query(request.user, query)

        # Blocks and privacy exclusions
        blocked_users = BlockedUser.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
        blockers = BlockedUser.objects.filter(blocked=request.user).values_list('blocker_id', flat=True)
        all_blocked = set(list(blocked_users) + list(blockers))

        followed_ids = list(Follow.objects.filter(follower=request.user).values_list('following_id', flat=True))

        clean_query = query.lstrip('#')
        posts = Post.objects.filter(
            Q(content__icontains=query) |
            Q(hashtag_associations__hashtag__name__icontains=clean_query),
            is_deleted=False
        ).exclude(
            author_id__in=all_blocked
        ).filter(
            Q(privacy='public') |
            Q(author=request.user) |
            Q(privacy='followers', author_id__in=followed_ids)
        ).order_by('-created_at').distinct()

        paginator = PageNumberPagination()
        paginator.page_size = 10
        result_page = paginator.paginate_queryset(posts, request)
        serializer = PostSerializer(result_page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

class HashtagSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({"results": []}, status=status.HTTP_200_OK)

        add_search_query(request.user, query)

        clean_query = query.lstrip('#')
        hashtags = Hashtag.objects.filter(name__icontains=clean_query).order_by('-post_count')

        paginator = PageNumberPagination()
        paginator.page_size = 10
        result_page = paginator.paginate_queryset(hashtags, request)
        serializer = HashtagSerializer(result_page, many=True)
        return paginator.get_paginated_response(serializer.data)

class GlobalSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({"users": [], "hashtags": []}, status=status.HTTP_200_OK)

        add_search_query(request.user, query)

        # 1. Search Users (Top 5)
        blocked_users = BlockedUser.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
        blockers = BlockedUser.objects.filter(blocked=request.user).values_list('blocker_id', flat=True)
        all_blocked = set(list(blocked_users) + list(blockers))

        similarity = (
            TrigramSimilarity('username', query) +
            TrigramSimilarity('full_name', query) +
            TrigramSimilarity(Coalesce('bio', Value('')), query)
        )

        users = User.objects.annotate(
            similarity=similarity
        ).filter(
            Q(similarity__gt=0.05) |
            Q(username__icontains=query) |
            Q(full_name__icontains=query)
        ).exclude(
            id__in=all_blocked
        ).order_by('-similarity', '-follower_count')[:5]

        # 2. Search Hashtags (Top 5)
        clean_query = query.lstrip('#')
        hashtags = Hashtag.objects.filter(name__icontains=clean_query).order_by('-post_count')[:5]

        return Response({
            "users": UserFollowDetailsSerializer(users, many=True, context={'request': request}).data,
            "hashtags": HashtagSerializer(hashtags, many=True).data
        }, status=status.HTTP_200_OK)

class RecentSearchListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        try:
            r = get_redis_connection("default")
            key = f"search_history:{request.user.id}"
            searches = r.zrevrange(key, 0, -1)
            searches_str = [q.decode('utf-8') for q in searches]
        except Exception:
            searches_str = []
        return Response({"recent_searches": searches_str}, status=status.HTTP_200_OK)

class ClearSearchHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        try:
            r = get_redis_connection("default")
            key = f"search_history:{request.user.id}"
            r.delete(key)
        except Exception:
            pass
        return Response({"message": "Search history cleared."}, status=status.HTTP_200_OK)

class SuggestedSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # Top 5 popular hashtags
        popular_hashtags = Hashtag.objects.order_by('-post_count')[:5]

        # Top 5 popular users (excluding blocks and self)
        blocked_users = BlockedUser.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
        blockers = BlockedUser.objects.filter(blocked=request.user).values_list('blocker_id', flat=True)
        all_blocked = set(list(blocked_users) + list(blockers))

        popular_users = User.objects.exclude(
            id__in=all_blocked
        ).exclude(
            id=request.user.id
        ).order_by('-follower_count')[:5]

        return Response({
            "suggested_hashtags": HashtagSerializer(popular_hashtags, many=True).data,
            "suggested_users": UserFollowDetailsSerializer(popular_users, many=True, context={'request': request}).data
        }, status=status.HTTP_200_OK)
