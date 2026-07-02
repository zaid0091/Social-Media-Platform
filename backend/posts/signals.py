from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Post

@receiver(post_save, sender=Post)
def update_user_post_count_on_save(sender, instance, **kwargs):
    author = instance.author
    # Count only active posts
    active_posts_count = Post.objects.filter(author=author, is_deleted=False).count()
    author.post_count = active_posts_count
    author.save(update_fields=['post_count'])

@receiver(post_delete, sender=Post)
def update_user_post_count_on_delete(sender, instance, **kwargs):
    author = instance.author
    active_posts_count = Post.objects.filter(author=author, is_deleted=False).count()
    author.post_count = active_posts_count
    author.save(update_fields=['post_count'])

import re
from hashtags.models import Hashtag, PostHashtag

@receiver(post_save, sender=Post)
def sync_post_hashtags(sender, instance, **kwargs):
    # If soft deleted, clear associations and decrease counts
    if instance.is_deleted:
        associations = PostHashtag.objects.filter(post=instance)
        hashtag_ids = list(associations.values_list('hashtag_id', flat=True))
        associations.delete()
        for hid in hashtag_ids:
            try:
                h = Hashtag.objects.get(id=hid)
                h.post_count = PostHashtag.objects.filter(hashtag=h).count()
                h.save(update_fields=['post_count'])
            except Hashtag.DoesNotExist:
                pass
        return

    # Extract tags using regex
    content = instance.content or ""
    tags = set(re.findall(r"#(\w+)", content))
    tags_lower = {t.lower() for t in tags}

    # Retrieve current associated hashtags
    current_associations = PostHashtag.objects.filter(post=instance)
    associated_tags = set(current_associations.values_list('hashtag__name', flat=True))

    # If tags match exactly, skip update to avoid redundant writes
    if tags_lower == associated_tags:
        return

    # Clear old tags and link new ones
    current_associations.delete()
    for tag in tags_lower:
        hashtag, _ = Hashtag.objects.get_or_create(name=tag)
        PostHashtag.objects.get_or_create(post=instance, hashtag=hashtag)

    # Recalculate post counts for all affected hashtags
    for tag in tags_lower.union(associated_tags):
        try:
            h = Hashtag.objects.get(name=tag)
            h.post_count = PostHashtag.objects.filter(hashtag=h).count()
            h.save(update_fields=['post_count'])
        except Hashtag.DoesNotExist:
            pass

