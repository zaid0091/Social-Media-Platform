from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination

from .models import Notification
from .serializers import NotificationSerializer

class NotificationPagination(PageNumberPagination):
    page_size = 20

class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        notifications = Notification.objects.filter(recipient=request.user).exclude(notification_type='message').order_by('-created_at')
        
        paginator = NotificationPagination()
        result_page = paginator.paginate_queryset(notifications, request)
        serializer = NotificationSerializer(result_page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id, *args, **kwargs):
        try:
            notification = Notification.objects.get(id=notification_id, recipient=request.user)
        except Notification.DoesNotExist:
            return Response({"error": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)

        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response(NotificationSerializer(notification, context={'request': request}).data, status=status.HTTP_200_OK)

class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({"message": "All notifications marked as read."}, status=status.HTTP_200_OK)

class NotificationDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, notification_id, *args, **kwargs):
        try:
            notification = Notification.objects.get(id=notification_id, recipient=request.user)
        except Notification.DoesNotExist:
            return Response({"error": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)

        notification.delete()
        return Response({"message": "Notification successfully deleted."}, status=status.HTTP_200_OK)

    def post(self, request, notification_id, *args, **kwargs):
        return self.delete(request, notification_id, *args, **kwargs)

class NotificationUnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        unread_count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({"unread_count": unread_count}, status=status.HTTP_200_OK)


from .serializers import DeviceTokenSerializer, UserNotificationPreferenceSerializer
from .models import UserNotificationPreference

class DeviceTokenRegisterView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = DeviceTokenSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserNotificationPreferenceUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        pref, _ = UserNotificationPreference.objects.get_or_create(user=request.user)
        serializer = UserNotificationPreferenceSerializer(pref)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, *args, **kwargs):
        pref, _ = UserNotificationPreference.objects.get_or_create(user=request.user)
        serializer = UserNotificationPreferenceSerializer(pref, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request, *args, **kwargs):
        return self.patch(request, *args, **kwargs)
