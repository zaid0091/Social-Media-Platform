from celery import shared_task
from django.utils import timezone
from .models import Story

@shared_task
def mark_and_cleanup_expired_stories():
    now = timezone.now()
    # Find stories that are past their expiry time but not marked expired
    expired_stories = Story.objects.filter(expires_at__lte=now, is_expired=False)
    
    count = expired_stories.count()
    for story in expired_stories:
        story.is_expired = True
        story.save(update_fields=['is_expired'])
        
        # Attempt to delete from Cloudinary storage
        try:
            import cloudinary.uploader
            # URL format: .../upload/v123456/public_id.ext
            url_parts = story.media_url.split('/')
            if 'upload' in url_parts:
                idx = url_parts.index('upload')
                public_id_with_ext = '/'.join(url_parts[idx+2:])
                public_id = public_id_with_ext.split('.')[0]
                cloudinary.uploader.destroy(public_id, resource_type=story.media_type)
        except Exception:
            pass

    return f"Successfully processed {count} expired stories."
