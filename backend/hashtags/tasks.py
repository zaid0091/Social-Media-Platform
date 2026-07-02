from celery import shared_task
from django.core.cache import cache
from django.utils import timezone
from django.db.models import Count
from datetime import timedelta
from .models import Hashtag
from .serializers import HashtagSerializer

@shared_task
def recalculate_trending_hashtags():
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
    # Store in Redis cache for 15 minutes (900 seconds)
    cache.set("trending_hashtags", serializer.data, timeout=900)
    return serializer.data
