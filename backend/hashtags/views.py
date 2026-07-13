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
        posts = Post.objects.filter(id__in=post_ids, is_deleted=False, is_hidden=False, needs_review=False).order_by('-created_at')

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

import urllib.request
import json
import string

def get_country_from_ip(ip):
    if not ip or ip in ('127.0.0.1', 'localhost', '::1'):
        return None
    cache_key = f"ip_country:{ip}"
    country = cache.get(cache_key)
    if country is not None:
        return country
        
    try:
        url = f"http://ip-api.com/json/{ip}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=1.0) as response:
            data = json.loads(response.read().decode())
            country = data.get('country')
            if country:
                cache.set(cache_key, country, timeout=86400) # cache for 1 day
                return country
    except Exception:
        pass
    return None

class TrendingHashtagsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # 1. Get client IP and country
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
            
        ip_country = get_country_from_ip(ip)
        country = request.query_params.get('country') or ip_country or request.user.location
        
        # 2. Build Cache Key based on country
        cache_key = f"trending_data:{country or 'global'}"

        def fetch_trending_data():
            # 3. Setup Conditional Aggregations for 7-day sparkline
            now = timezone.now()
            aggregations = {}
            for i in range(7):
                day_start = now - timedelta(days=6-i)
                day_start = day_start.replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = day_start + timedelta(days=1)
                aggregations[f'day_{i}'] = Count(
                    'post_associations',
                    filter=Q(
                        post_associations__created_at__range=(day_start, day_end),
                        post_associations__post__is_deleted=False
                    )
                )

            # 4. Query Trending Hashtags filtered by country if specified
            time_threshold = timezone.now() - timedelta(hours=24)
            
            # Base hashtag query
            hashtag_filter = Q(
                post_associations__created_at__gte=time_threshold,
                post_associations__post__is_deleted=False
            )
            if country:
                hashtag_filter &= Q(post_associations__post__author__location__icontains=country)
                
            trending_qs = Hashtag.objects.filter(
                hashtag_filter
            ).annotate(
                recent_post_count=Count('post_associations'),
                **aggregations
            ).order_by('-recent_post_count', '-post_count')[:10]

            # Fallback if no trends in country or recent hours
            if not trending_qs.exists():
                fallback_filter = Q(post_count__gt=0)
                if country:
                    fallback_filter &= Q(post_associations__post__author__location__icontains=country)
                
                trending_qs = Hashtag.objects.filter(
                    fallback_filter
                ).annotate(
                    recent_post_count=Count('post_associations', filter=Q(post_associations__post__is_deleted=False)),
                    **aggregations
                ).order_by('-post_count')[:10]
                
                # If still empty, fall back to global popular
                if not trending_qs.exists() and country:
                    trending_qs = Hashtag.objects.filter(
                        post_count__gt=0
                    ).annotate(
                        recent_post_count=Count('post_associations', filter=Q(post_associations__post__is_deleted=False)),
                        **aggregations
                    ).order_by('-post_count')[:10]

            # Construct Hashtag items
            hashtags_list = []
            for h in trending_qs:
                activity = [
                    getattr(h, 'day_0', 0),
                    getattr(h, 'day_1', 0),
                    getattr(h, 'day_2', 0),
                    getattr(h, 'day_3', 0),
                    getattr(h, 'day_4', 0),
                    getattr(h, 'day_5', 0),
                    getattr(h, 'day_6', 0)
                ]
                hashtags_list.append({
                    "id": str(h.id),
                    "name": h.name,
                    "post_count": h.post_count,
                    "recent_activity": activity
                })

            # 5. Extract Non-Hashtag Trending Topics (Top 5 common words)
            post_filter = Q(
                created_at__gte=time_threshold,
                is_deleted=False,
                needs_review=False
            )
            if country:
                post_filter &= Q(author__location__icontains=country)
                
            posts_content = Post.objects.filter(post_filter).values_list('content', flat=True)
            if not posts_content.exists() and country:
                # Fallback to global
                posts_content = Post.objects.filter(
                    created_at__gte=time_threshold,
                    is_deleted=False,
                    needs_review=False
                ).values_list('content', flat=True)

            stop_words = {
                'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
                'to', 'for', 'in', 'on', 'at', 'with', 'this', 'that', 'it', 'of',
                'my', 'your', 'his', 'her', 'their', 'our', 'me', 'you', 'he', 'she',
                'they', 'we', 'i', 'have', 'has', 'had', 'do', 'does', 'did', 'about',
                'be', 'been', 'being', 'from', 'by', 'as', 'at', 'so', 'if', 'out',
                'up', 'down', 'about', 'just', 'like', 'how', 'what', 'when', 'where',
                'who', 'why', 'can', 'will', 'would', 'should', 'could', 'some', 'any',
                'more', 'most', 'other', 'them', 'us', 'there', 'their', 'then', 'than'
            }
            
            word_counts = {}
            for content in posts_content:
                if not content:
                    continue
                words = content.split()
                for word in words:
                    if word.startswith('#') or word.startswith('@'):
                        continue
                    # Clean punctuation
                    clean_word = word.translate(str.maketrans('', '', string.punctuation)).lower().strip()
                    if len(clean_word) < 3 or clean_word in stop_words:
                        continue
                    word_counts[clean_word] = word_counts.get(clean_word, 0) + 1

            sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)[:5]
            topics_list = [{"name": word, "count": count} for word, count in sorted_words]

            return {
                "hashtags": hashtags_list,
                "topics": topics_list,
                "country": country
            }

        response_data = cache.get_or_set(cache_key, fetch_trending_data, timeout=900) # 15 mins
        
        response = Response(response_data, status=status.HTTP_200_OK)
        response["Cache-Control"] = "public, max-age=60, stale-while-revalidate=600"
        return response

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
