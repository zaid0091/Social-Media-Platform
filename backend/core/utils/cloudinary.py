import os
import uuid
from django.conf import settings
from django.core.files.storage import default_storage
import cloudinary.uploader
import cloudinary.utils

def upload_file_to_cloudinary(file_obj, resource_type='auto'):
    """
    Uploads a file to Cloudinary and returns its URL, public ID, and thumbnail (if video).
    Falls back to local file storage if Cloudinary fails or is not fully configured.
    """
    try:
        response = cloudinary.uploader.upload(
            file_obj,
            resource_type=resource_type
        )
        
        secure_url = response.get('secure_url')
        public_id = response.get('public_id')
        actual_resource_type = response.get('resource_type', resource_type)
        thumbnail_url = None
        
        if actual_resource_type == 'video':
            # Generate video thumbnail jpg URL using 1-second mark transformation
            thumbnail_url, _ = cloudinary.utils.cloudinary_url(
                public_id,
                format='jpg',
                resource_type='video',
                transformation=[{'width': 300, 'height': 300, 'crop': 'fill', 'time': '00:00:01'}]
            )
            
        return {
            'secure_url': secure_url,
            'public_id': public_id,
            'resource_type': actual_resource_type,
            'thumbnail_url': thumbnail_url
        }
    except Exception as e:
        # Fallback to local storage if Cloudinary fails (e.g. permission or quota error)
        ext = file_obj.name.split('.')[-1] if file_obj.name else 'bin'
        filename = f"{uuid.uuid4()}.{ext}"
        
        # Save file locally using Django's default storage (under MEDIA_ROOT)
        saved_path = default_storage.save(os.path.join('uploads', filename), file_obj)
        media_url = f"/media/{saved_path.replace(os.sep, '/')}"
        
        actual_resource_type = 'video' if resource_type == 'video' or ext.lower() in ['mp4', 'mov', 'avi', 'mkv', 'webm'] else 'image'
        
        return {
            'secure_url': media_url,
            'public_id': saved_path,
            'resource_type': actual_resource_type,
            'thumbnail_url': media_url if actual_resource_type == 'video' else None
        }
