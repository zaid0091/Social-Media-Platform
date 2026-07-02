import cloudinary.uploader
import cloudinary.utils

def upload_file_to_cloudinary(file_obj, resource_type='auto'):
    """
    Uploads a file to Cloudinary and returns its URL, public ID, and thumbnail (if video).
    """
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
