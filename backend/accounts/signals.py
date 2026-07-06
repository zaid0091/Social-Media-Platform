from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import F
from .models import Follow

@receiver(post_save, sender=Follow)
def increment_follow_counters(sender, instance, created, **kwargs):
    if created:
        # Increment following_count on the follower
        instance.follower.following_count = F('following_count') + 1
        instance.follower.save(update_fields=['following_count'])
        instance.follower.refresh_from_db()

        # Increment follower_count on the user being followed
        instance.following.follower_count = F('follower_count') + 1
        instance.following.save(update_fields=['follower_count'])
        instance.following.refresh_from_db()

@receiver(post_delete, sender=Follow)
def decrement_follow_counters(sender, instance, **kwargs):
    # Decrement following_count on the follower (ensuring it doesn't drop below 0)
    follower = instance.follower
    follower.refresh_from_db()
    if follower.following_count > 0:
        follower.following_count = F('following_count') - 1
        follower.save(update_fields=['following_count'])
        follower.refresh_from_db()

    # Decrement follower_count on the user being followed (ensuring it doesn't drop below 0)
    following = instance.following
    following.refresh_from_db()
    if following.follower_count > 0:
        following.follower_count = F('follower_count') - 1
        following.save(update_fields=['follower_count'])
        following.refresh_from_db()
