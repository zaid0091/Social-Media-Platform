from django.core.cache import cache
from django.utils import timezone
from django.db.models import Q
from accounts.models import Follow, BlockedUser
from .models import Post

class FeedGenerationService:
    @staticmethod
    def generate_ranked_feed(user):
        cache_key = f"user_feed_{user.id}"
        # Check cache
        post_ids = cache.get(cache_key)
        if post_ids is not None:
            return post_ids

        # Cache miss: generate ranked feed
        # 1. Get followed users
        followed_ids = list(Follow.objects.filter(follower=user).values_list('following_id', flat=True))
        
        # 2. Get blocked users
        blocked_ids = BlockedUser.objects.filter(blocker=user).values_list('blocked_id', flat=True)
        blockers_ids = BlockedUser.objects.filter(blocked=user).values_list('blocker_id', flat=True)
        all_blocked = set(list(blocked_ids) + list(blockers_ids))

        # 3. Retrieve posts from followed users
        posts = Post.objects.filter(
            author_id__in=followed_ids,
            is_deleted=False,
            is_hidden=False,
            needs_review=False
        ).exclude(
            author_id__in=all_blocked
        ).exclude(
            privacy='private'
        )

        # 4. Score posts: (likes * 1) + (comments * 2) + (shares * 3) + (bookmarks * 2) * recency decay
        scored_posts = []
        now = timezone.now()
        for post in posts:
            hours_old = (now - post.created_at).total_seconds() / 3600.0
            decay = 1.0 / (1.0 + hours_old * 0.1)
            engagement = (
                post.like_count * 1 +
                post.comment_count * 2 +
                post.share_count * 3 +
                post.bookmark_count * 2
            )
            score = engagement * decay
            scored_posts.append((post.id, score))

        # 5. Sort by score descending
        scored_posts.sort(key=lambda x: x[1], reverse=True)
        post_ids = [str(item[0]) for item in scored_posts]

        # 6. Cache for 5 minutes (300 seconds)
        cache.set(cache_key, post_ids, timeout=300)
        return post_ids
