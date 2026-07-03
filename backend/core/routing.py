from django.urls import re_path
from notifications.consumers import NotificationConsumer
from messaging.consumers import ChatConsumer
from posts.consumers import FeedConsumer, PostEngagementConsumer
from accounts.consumers import PresenceConsumer

websocket_urlpatterns = [
    re_path(r'^ws/notifications/$', NotificationConsumer.as_asgi()),
    re_path(r'^ws/chat/(?P<conversation_id>[^/]+)/$', ChatConsumer.as_asgi()),
    re_path(r'^ws/feed/$', FeedConsumer.as_asgi()),
    re_path(r'^ws/post-engagement/(?P<post_id>[^/]+)/$', PostEngagementConsumer.as_asgi()),
    re_path(r'^ws/presence/$', PresenceConsumer.as_asgi()),
]
