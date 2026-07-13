import re
from django.db.models.signals import post_save, post_delete, pre_delete
from django.dispatch import receiver
from django.contrib.contenttypes.models import ContentType
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import Post, Like, Bookmark, Comment
from .tasks import fanout_new_post
from hashtags.models import Hashtag, PostHashtag

def broadcast_post_engagement(post_id, likes_count, comments_count):
    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            f"post_engagement_{post_id}",
            {
                "type": "engagement_update",
                "likes_count": likes_count,
                "comments_count": comments_count
            }
        )

@receiver(post_save, sender=Post)
def update_user_post_count_on_save(sender, instance, **kwargs):
    author = instance.author
    # Count only active posts
    active_posts_count = Post.objects.filter(author=author, is_deleted=False).count()
    author.post_count = active_posts_count
    author.save(update_fields=['post_count'])

    # Phase 26: Asynchronous feed updates fanout
    created = kwargs.get('created', False)
    if created and not instance.is_deleted:
        fanout_new_post.delay(str(instance.id), str(author.id))

@receiver(post_delete, sender=Post)
def update_user_post_count_on_delete(sender, instance, **kwargs):
    author = instance.author
    active_posts_count = Post.objects.filter(author=author, is_deleted=False).count()
    author.post_count = active_posts_count
    author.save(update_fields=['post_count'])

@receiver(pre_delete, sender=Post)
def clean_hashtags_on_post_hard_delete(sender, instance, **kwargs):
    associations = PostHashtag.objects.filter(post=instance)
    hashtag_ids = list(associations.values_list('hashtag_id', flat=True))
    for hid in hashtag_ids:
        try:
            h = Hashtag.objects.get(id=hid)
            h.post_count = max(0, PostHashtag.objects.filter(hashtag=h).count() - 1)
            h.save(update_fields=['post_count'])
        except Hashtag.DoesNotExist:
            pass

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

@receiver([post_save, post_delete], sender=Like)
def update_like_count_cache(sender, instance, **kwargs):
    content_type = instance.content_type
    object_id = instance.object_id
    try:
        model_class = content_type.model_class()
        target_obj = model_class.objects.get(id=object_id)
        
        total_likes = Like.objects.filter(content_type=content_type, object_id=object_id).count()
        target_obj.like_count = total_likes

        # Real-time update broadcast
        if model_class == Post:
            total_comments = Comment.objects.filter(post=target_obj, is_deleted=False).count()
            target_obj.comment_count = total_comments
            target_obj.save(update_fields=['like_count', 'comment_count'])
            broadcast_post_engagement(str(target_obj.id), total_likes, total_comments)
        else:
            target_obj.save(update_fields=['like_count'])
    except Exception:
        pass

@receiver([post_save, post_delete], sender=Bookmark)
def update_bookmark_count_cache(sender, instance, **kwargs):
    post = instance.post
    total_bookmarks = Bookmark.objects.filter(post=post).count()
    post.bookmark_count = total_bookmarks
    post.save(update_fields=['bookmark_count'])

@receiver([post_save, post_delete], sender=Comment)
def update_comment_counts(sender, instance, **kwargs):
    # Update Post's comment count
    post = instance.post
    
    # Query direct counts to avoid stale instance attributes
    likes_count = Like.objects.filter(
        content_type=ContentType.objects.get_for_model(Post),
        object_id=post.id
    ).count()
    comments_count = Comment.objects.filter(post=post, is_deleted=False).count()

    post.comment_count = comments_count
    post.like_count = likes_count
    post.save(update_fields=['comment_count', 'like_count'])

    # Real-time update broadcast
    broadcast_post_engagement(str(post.id), likes_count, comments_count)

    # Update Parent Comment's reply count (if reply)
    if instance.parent:
        parent = instance.parent
        parent.reply_count = Comment.objects.filter(parent=parent, is_deleted=False).count()
        parent.save(update_fields=['reply_count'])


from django.db.models.signals import pre_save
from moderation.utils import check_content_moderation
from moderation.models import Report
from stories.models import Story

@receiver(pre_save, sender=Post)
def moderate_post_pre_save(sender, instance, **kwargs):
    violates, reason = check_content_moderation(instance.content)
    if violates:
        instance.needs_review = True

@receiver(post_save, sender=Post)
def create_post_report_post_save(sender, instance, created, **kwargs):
    if created and instance.needs_review:
        Report.objects.create(
            reporter=None,
            reported_post=instance,
            reason='other',
            description="Automated Content Flagging System: Guideline violation detected.",
            status='needs_review'
        )

@receiver(pre_save, sender=Comment)
def moderate_comment_pre_save(sender, instance, **kwargs):
    violates, reason = check_content_moderation(instance.content)
    if violates:
        instance.needs_review = True

@receiver(post_save, sender=Comment)
def create_comment_report_post_save(sender, instance, created, **kwargs):
    if created and instance.needs_review:
        Report.objects.create(
            reporter=None,
            reported_comment=instance,
            reason='other',
            description="Automated Content Flagging System: Guideline violation detected.",
            status='needs_review'
        )

@receiver(pre_save, sender=Story)
def moderate_story_pre_save(sender, instance, **kwargs):
    violates, reason = check_content_moderation(instance.caption)
    if violates:
        instance.needs_review = True

@receiver(post_save, sender=Story)
def create_story_report_post_save(sender, instance, created, **kwargs):
    if created and instance.needs_review:
        Report.objects.create(
            reporter=None,
            reported_story=instance,
            reason='other',
            description="Automated Content Flagging System: Guideline violation detected.",
            status='needs_review'
        )


from django.core.cache import cache

@receiver([post_save, post_delete], sender=Post)
def invalidate_post_engagement_cache(sender, instance, **kwargs):
    cache.delete(f"post_engagement:{instance.id}")
    if instance.repost_of:
        cache.delete(f"post_engagement:{instance.repost_of.id}")


