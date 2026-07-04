from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser
from django.utils import timezone
from django.db.models import Q
from django.contrib.auth import get_user_model

from accounts.models import Follow, BlockedUser
from core.utils.cloudinary import upload_file_to_cloudinary
from .models import Story, StoryView, StoryHighlight
from .serializers import (
    StorySerializer, 
    StoryHighlightSerializer, 
    StoryHighlightCreateSerializer
)

User = get_user_model()

class StoryCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        # Enforce maximum 30 active stories per user
        now = timezone.now()
        active_count = Story.objects.filter(author=request.user, expires_at__gt=now, is_expired=False).count()
        if active_count >= 30:
            return Response({"error": "You cannot have more than 30 active stories at a time."}, status=status.HTTP_400_BAD_REQUEST)

        # Get media file
        file_obj = request.data.get('file') or request.data.get('media')
        if not file_obj:
            return Response({"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        # Validate size & format
        content_type = file_obj.content_type
        size = file_obj.size

        allowed_image_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        allowed_video_types = ['video/mp4', 'video/quicktime', 'video/mov', 'video/x-matroska', 'video/webm']
        
        MAX_IMAGE_SIZE = 10 * 1024 * 1024
        MAX_VIDEO_SIZE = 100 * 1024 * 1024

        if content_type in allowed_image_types:
            if size > MAX_IMAGE_SIZE:
                return Response({"error": "Image size exceeds the 10MB limit."}, status=status.HTTP_400_BAD_REQUEST)
            resource_type = 'image'
        elif content_type in allowed_video_types:
            if size > MAX_VIDEO_SIZE:
                return Response({"error": "Video size exceeds the 100MB limit."}, status=status.HTTP_400_BAD_REQUEST)
            resource_type = 'video'
        else:
            return Response({"error": "Unsupported file format."}, status=status.HTTP_400_BAD_REQUEST)

        # Upload to Cloudinary
        try:
            result = upload_file_to_cloudinary(file_obj, resource_type=resource_type)
            media_url = result['secure_url']
        except Exception as e:
            return Response({"error": f"Upload failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Create Story
        caption = request.data.get('caption', '')
        story = Story.objects.create(
            author=request.user,
            media_url=media_url,
            media_type=resource_type,
            caption=caption
        )

        return Response(StorySerializer(story, context={'request': request}).data, status=status.HTTP_201_CREATED)

class StoryListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        now = timezone.now()
        followed_ids = list(Follow.objects.filter(follower=request.user).values_list('following_id', flat=True))

        # Filter out blocked users
        blocked_users = BlockedUser.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
        blockers = BlockedUser.objects.filter(blocked=request.user).values_list('blocker_id', flat=True)
        all_blocked = set(list(blocked_users) + list(blockers))

        # Active stories from followed profiles
        stories = Story.objects.filter(
            author_id__in=followed_ids,
            expires_at__gt=now,
            is_expired=False
        ).exclude(
            author_id__in=all_blocked
        ).order_by('author_id', '-created_at')

        # Group stories by author
        from collections import defaultdict
        grouped = defaultdict(list)
        for story in stories:
            grouped[story.author].append(story)

        response_data = []
        for author, author_stories in grouped.items():
            from accounts.serializers import UserFollowDetailsSerializer
            response_data.append({
                "author": UserFollowDetailsSerializer(author, context={'request': request}).data,
                "stories": StorySerializer(author_stories, many=True, context={'request': request}).data
            })

        return Response(response_data, status=status.HTTP_200_OK)

class StoryDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, story_id, *args, **kwargs):
        try:
            story = Story.objects.get(id=story_id, expires_at__gt=timezone.now(), is_expired=False)
        except Story.DoesNotExist:
            return Response({"error": "Story not found."}, status=status.HTTP_404_NOT_FOUND)

        # Block checks
        if BlockedUser.objects.filter(
            Q(blocker=request.user, blocked=story.author) |
            Q(blocker=story.author, blocked=request.user)
        ).exists():
            return Response({"error": "Story not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(StorySerializer(story, context={'request': request}).data, status=status.HTTP_200_OK)

class StoryDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, story_id, *args, **kwargs):
        try:
            story = Story.objects.get(id=story_id)
        except Story.DoesNotExist:
            return Response({"error": "Story not found."}, status=status.HTTP_404_NOT_FOUND)

        if story.author != request.user:
            return Response({"error": "You do not have permission to delete this story."}, status=status.HTTP_403_FORBIDDEN)

        story.delete()
        return Response({"message": "Story successfully deleted."}, status=status.HTTP_200_OK)

    def post(self, request, story_id, *args, **kwargs):
        return self.delete(request, story_id, *args, **kwargs)

class StoryViewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, story_id, *args, **kwargs):
        try:
            story = Story.objects.get(id=story_id, expires_at__gt=timezone.now(), is_expired=False)
        except Story.DoesNotExist:
            return Response({"error": "Story not found."}, status=status.HTTP_404_NOT_FOUND)

        # Block checks
        if BlockedUser.objects.filter(
            Q(blocker=request.user, blocked=story.author) |
            Q(blocker=story.author, blocked=request.user)
        ).exists():
            return Response({"error": "Story not found."}, status=status.HTTP_404_NOT_FOUND)

        # Record a single view
        story_view, created = StoryView.objects.get_or_create(story=story, viewer=request.user)
        if created:
            story.view_count = StoryView.objects.filter(story=story).count()
            story.save(update_fields=['view_count'])

        return Response({
            "viewed": True,
            "view_count": story.view_count
        }, status=status.HTTP_200_OK)

class StoryViewerListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, story_id, *args, **kwargs):
        try:
            story = Story.objects.get(id=story_id)
        except Story.DoesNotExist:
            return Response({"error": "Story not found."}, status=status.HTTP_404_NOT_FOUND)

        if story.author != request.user:
            return Response({"error": "You do not have permission to view this story's viewers."}, status=status.HTTP_403_FORBIDDEN)

        views = StoryView.objects.filter(story=story).select_related('viewer').order_by('-viewed_at')
        
        paginator = PageNumberPagination()
        paginator.page_size = 10
        result_page = paginator.paginate_queryset(views, request)
        from .serializers import StoryViewSerializer
        serializer = StoryViewSerializer(result_page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

class StoryHighlightCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = StoryHighlightCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            highlight = serializer.save(author=request.user)
            return Response(StoryHighlightSerializer(highlight, context={'request': request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class StoryHighlightUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, highlight_id, *args, **kwargs):
        try:
            highlight = StoryHighlight.objects.get(id=highlight_id)
        except StoryHighlight.DoesNotExist:
            return Response({"error": "Highlight not found."}, status=status.HTTP_404_NOT_FOUND)

        if highlight.author != request.user:
            return Response({"error": "You do not have permission to edit this highlight."}, status=status.HTTP_403_FORBIDDEN)

        serializer = StoryHighlightCreateSerializer(highlight, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            updated_highlight = serializer.save()
            return Response(StoryHighlightSerializer(updated_highlight, context={'request': request}).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request, highlight_id, *args, **kwargs):
        return self.patch(request, highlight_id, *args, **kwargs)

class StoryHighlightDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, highlight_id, *args, **kwargs):
        try:
            highlight = StoryHighlight.objects.get(id=highlight_id)
        except StoryHighlight.DoesNotExist:
            return Response({"error": "Highlight not found."}, status=status.HTTP_404_NOT_FOUND)

        if highlight.author != request.user:
            return Response({"error": "You do not have permission to delete this highlight."}, status=status.HTTP_403_FORBIDDEN)

        highlight.delete()
        return Response({"message": "Highlight successfully deleted."}, status=status.HTTP_200_OK)

    def post(self, request, highlight_id, *args, **kwargs):
        return self.delete(request, highlight_id, *args, **kwargs)

class StoryHighlightDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, highlight_id, *args, **kwargs):
        try:
            highlight = StoryHighlight.objects.get(id=highlight_id)
        except StoryHighlight.DoesNotExist:
            return Response({"error": "Highlight not found."}, status=status.HTTP_404_NOT_FOUND)

        # Block checks on highlight author
        if BlockedUser.objects.filter(
            Q(blocker=request.user, blocked=highlight.author) |
            Q(blocker=highlight.author, blocked=request.user)
        ).exists():
            return Response({"error": "Highlight not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(StoryHighlightSerializer(highlight, context={'request': request}).data, status=status.HTTP_200_OK)

class StoryArchiveView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # Retrieve all stories created by the user, ordered by creation date desc
        stories = Story.objects.filter(author=request.user).order_by('-created_at')
        serializer = StorySerializer(stories, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

class UserHighlightListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, username, *args, **kwargs):
        try:
            target_user = User.objects.get(username__iexact=username, is_active=True)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # Block checks
        if BlockedUser.objects.filter(
            Q(blocker=request.user, blocked=target_user) |
            Q(blocker=target_user, blocked=request.user)
        ).exists():
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # Enforce private account policy: Only show highlights if user is self, or following, or public
        is_self = (request.user == target_user)
        is_following = Follow.objects.filter(follower=request.user, following=target_user).exists()
        if target_user.is_private and not is_self and not is_following:
            return Response([], status=status.HTTP_200_OK)

        highlights = StoryHighlight.objects.filter(author=target_user)
        serializer = StoryHighlightSerializer(highlights, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
