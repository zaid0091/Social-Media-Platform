from django.urls import path
from .views import (
    NotificationListView, NotificationMarkReadView, NotificationMarkAllReadView,
    NotificationDeleteView, NotificationUnreadCountView
)

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification-list'),
    path('unread-count/', NotificationUnreadCountView.as_view(), name='notification-unread-count'),
    path('mark-all-read/', NotificationMarkAllReadView.as_view(), name='notification-mark-all-read'),
    path('<uuid:notification_id>/read/', NotificationMarkReadView.as_view(), name='notification-mark-read'),
    path('<uuid:notification_id>/delete/', NotificationDeleteView.as_view(), name='notification-delete'),
]
