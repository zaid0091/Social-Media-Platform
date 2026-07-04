from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from django.db.models import Q

from .models import Report
from .serializers import ReportSerializer, ReportCreateSerializer
from posts.models import Post, Comment
from stories.models import Story
from notifications.utils import create_notification

User = get_user_model()

class ReportCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = ReportCreateSerializer(data=request.data)
        if serializer.is_valid():
            report = serializer.save(reporter=request.user)
            return Response(ReportSerializer(report).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class AdminModerationView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request, *args, **kwargs):
        reports = Report.objects.all().order_by('-created_at')
        status_filter = request.query_params.get('status')
        if status_filter:
            reports = reports.filter(status=status_filter)
        
        serializer = ReportSerializer(reports, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class AdminReportResolveView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, report_id, *args, **kwargs):
        try:
            report = Report.objects.get(id=report_id)
        except Report.DoesNotExist:
            return Response({"error": "Report not found."}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status')
        action_taken = request.data.get('action_taken')
        
        if not new_status or new_status not in ['resolved', 'dismissed']:
            return Response({"error": "Valid status ('resolved' or 'dismissed') is required."}, status=status.HTTP_400_BAD_REQUEST)

        if new_status == 'resolved' and (not action_taken or action_taken not in [choice[0] for choice in Report.ACTION_CHOICES]):
            return Response({"error": "Valid action_taken is required when status is resolved."}, status=status.HTTP_400_BAD_REQUEST)

        report.status = new_status
        report.action_taken = action_taken if new_status == 'resolved' else 'no_action'
        report.reviewed_by = request.user
        report.save()

        # Handle resolution action
        if new_status == 'resolved':
            if action_taken == 'content_removed':
                if report.reported_post:
                    report.reported_post.is_hidden = True
                    report.reported_post.save(update_fields=['is_hidden'])
                if report.reported_comment:
                    report.reported_comment.is_hidden = True
                    report.reported_comment.save(update_fields=['is_hidden'])
                if report.reported_story:
                    report.reported_story.is_hidden = True
                    report.reported_story.save(update_fields=['is_hidden'])

            elif action_taken == 'user_suspended':
                target_user = report.reported_user
                if not target_user and report.reported_post:
                    target_user = report.reported_post.author
                elif not target_user and report.reported_comment:
                    target_user = report.reported_comment.author
                elif not target_user and report.reported_story:
                    target_user = report.reported_story.author

                if target_user:
                    duration_days = int(request.data.get('duration_days', 7))
                    target_user.is_suspended = True
                    target_user.suspension_expires_at = timezone.now() + timedelta(days=duration_days)
                    target_user.save(update_fields=['is_suspended', 'suspension_expires_at'])

            elif action_taken == 'user_banned':
                target_user = report.reported_user
                if not target_user and report.reported_post:
                    target_user = report.reported_post.author
                elif not target_user and report.reported_comment:
                    target_user = report.reported_comment.author
                elif not target_user and report.reported_story:
                    target_user = report.reported_story.author

                if target_user:
                    target_user.is_banned = True
                    target_user.save(update_fields=['is_banned'])

            elif action_taken == 'warning_issued':
                target_user = report.reported_user
                if not target_user and report.reported_post:
                    target_user = report.reported_post.author
                elif not target_user and report.reported_comment:
                    target_user = report.reported_comment.author
                elif not target_user and report.reported_story:
                    target_user = report.reported_story.author

                if target_user:
                    create_notification(
                        recipient=target_user,
                        sender=request.user,
                        notification_type='warning',
                        related_post=report.reported_post,
                        related_comment=report.reported_comment,
                        related_story=report.reported_story
                    )

        return Response(ReportSerializer(report).data, status=status.HTTP_200_OK)

class ContentHideView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, *args, **kwargs):
        post_id = request.data.get('post_id')
        comment_id = request.data.get('comment_id')
        is_hidden = request.data.get('is_hidden', True)

        if not post_id and not comment_id:
            return Response({"error": "Either post_id or comment_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        if post_id:
            try:
                post = Post.objects.get(id=post_id)
                post.is_hidden = is_hidden
                post.save(update_fields=['is_hidden'])
                return Response({"message": f"Post visibility updated to hidden={is_hidden}."}, status=status.HTTP_200_OK)
            except Post.DoesNotExist:
                return Response({"error": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        if comment_id:
            try:
                comment = Comment.objects.get(id=comment_id)
                comment.is_hidden = is_hidden
                comment.save(update_fields=['is_hidden'])
                return Response({"message": f"Comment visibility updated to hidden={is_hidden}."}, status=status.HTTP_200_OK)
            except Comment.DoesNotExist:
                return Response({"error": "Comment not found."}, status=status.HTTP_404_NOT_FOUND)

class UserSuspendView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, *args, **kwargs):
        user_id = request.data.get('user_id')
        duration_days = int(request.data.get('duration_days', 7))

        if not user_id:
            return Response({"error": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=user_id)
            user.is_suspended = True
            user.suspension_expires_at = timezone.now() + timedelta(days=duration_days)
            user.save(update_fields=['is_suspended', 'suspension_expires_at'])
            return Response({"message": f"User {user.username} has been suspended for {duration_days} days."}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

class UserBanView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, *args, **kwargs):
        user_id = request.data.get('user_id')

        if not user_id:
            return Response({"error": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=user_id)
            user.is_banned = True
            user.save(update_fields=['is_banned'])
            return Response({"message": f"User {user.username} has been permanently banned."}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

class UserWarnView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, *args, **kwargs):
        user_id = request.data.get('user_id')
        post_id = request.data.get('post_id')
        comment_id = request.data.get('comment_id')

        if not user_id:
            return Response({"error": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=user_id)
            post = None
            if post_id:
                try:
                    post = Post.objects.get(id=post_id)
                except Post.DoesNotExist:
                    pass

            comment = None
            if comment_id:
                try:
                    comment = Comment.objects.get(id=comment_id)
                except Comment.DoesNotExist:
                    pass

            create_notification(
                recipient=user,
                sender=request.user,
                notification_type='warning',
                related_post=post,
                related_comment=comment
            )
            return Response({"message": f"Warning issued to user {user.username}."}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
