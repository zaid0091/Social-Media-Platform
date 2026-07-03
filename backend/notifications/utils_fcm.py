import logging
import firebase_admin
from firebase_admin import credentials, messaging
from django.conf import settings

logger = logging.getLogger(__name__)

_firebase_initialized = False

def initialize_firebase():
    global _firebase_initialized
    if _firebase_initialized:
        return True
    try:
        # Try to initialize using custom certificate path from settings
        creds_path = getattr(settings, 'FIREBASE_CREDENTIALS_PATH', None)
        if creds_path:
            cred = credentials.Certificate(creds_path)
            firebase_admin.initialize_app(cred)
        else:
            # Fallback: initialize using default credentials
            firebase_admin.initialize_app()
        _firebase_initialized = True
        return True
    except Exception as e:
        logger.warning(f"Failed to initialize Firebase Admin SDK: {e}. Push notifications will be mocked.")
        return False

def send_push_notification(device_token, title, body, data=None):
    if not initialize_firebase():
        logger.info(f"[MOCK PUSH] Token: {device_token} | Title: {title} | Body: {body} | Data: {data}")
        return True

    try:
        # Construct message dictionary/payload
        # Convert all data dictionary values to strings as required by FCM
        data_str = {}
        if data:
            for k, v in data.items():
                data_str[str(k)] = str(v)

        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data=data_str,
            token=device_token,
        )
        response = messaging.send(message)
        return response
    except Exception as e:
        logger.error(f"FCM push notification delivery failed: {e}")
        return None
