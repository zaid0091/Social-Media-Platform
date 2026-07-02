import re
from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.contrib.auth import get_user_model
from accounts.models import Follow, BlockedUser
from hashtags.models import Hashtag, PostHashtag
from .models import Post
from .serializers import PostSerializer, PostCreateSerializer

User = get_user_model()

class PostCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = PostCreateSerializer(data=request.data)
        if serializer.is_valid():
            post = serializer.save(author=request.user)
            return Response(PostSerializer(post, context={'request': request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PostDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, post_id, *args, **kwargs):
        try:
            post = Post.objects.get(id=post_id, is_deleted=False)
        except Post.DoesNotExist:
            return Response({"error": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        # Block checks
        if BlockedUser.objects.filter(
            Q(blocker=request.user, blocked=post.author) |
            Q(blocker=post.author, blocked=request.user)
        ).exists():
            return Response({"error": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        # Privacy checks
        if post.author.is_private and request.user != post.author:
            is_following = Follow.objects.filter(follower=request.user, following=post.author).exists()
            if not is_following:
                return Response({"error": "This account is private."}, status=status.HTTP_403_FORBIDDEN)

        return Response(PostSerializer(post, context={'request': request}).data, status=status.HTTP_200_OK)

class PostUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, post_id, *args, **kwargs):
        try:
            post = Post.objects.get(id=post_id, is_deleted=False)
        except Post.DoesNotExist:
            return Response({"error": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        if post.author != request.user:
            return Response({"error": "You do not have permission to edit this post."}, status=status.HTTP_403_FORBIDDEN)

        serializer = PostCreateSerializer(post, data=request.data, partial=True)
        if serializer.is_valid():
            updated_post = serializer.save()
            return Response(PostSerializer(updated_post, context={'request': request}).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request, post_id, *args, **kwargs):
        return self.patch(request, post_id, *args, **kwargs)

class PostDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, post_id, *args, **kwargs):
        try:
            post = Post.objects.get(id=post_id, is_deleted=False)
        except Post.DoesNotExist:
            return Response({"error": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        if post.author != request.user:
            return Response({"error": "You do not have permission to delete this post."}, status=status.HTTP_403_FORBIDDEN)

        # Soft delete
        post.is_deleted = True
        post.save(update_fields=['is_deleted'])
        
        return Response({"message": "Post successfully deleted."}, status=status.HTTP_200_OK)

    def post(self, request, post_id, *args, **kwargs):
        return self.delete(request, post_id, *args, **kwargs)

class UserPostListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id, *args, **kwargs):
        try:
            target_user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # Block checks
        if BlockedUser.objects.filter(
            Q(blocker=request.user, blocked=target_user) |
            Q(blocker=target_user, blocked=request.user)
        ).exists():
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # Privacy checks
        if target_user.is_private and request.user != target_user:
            is_following = Follow.objects.filter(follower=request.user, following=target_user).exists()
            if not is_following:
                return Response({"error": "This account is private."}, status=status.HTTP_403_FORBIDDEN)

        posts = Post.objects.filter(author=target_user, is_deleted=False).order_by('-created_at')
        paginator = PageNumberPagination()
        paginator.page_size = 10
        result_page = paginator.paginate_queryset(posts, request)
        serializer = PostSerializer(result_page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


from rest_framework.parsers import MultiPartParser, FormParser
from core.utils.cloudinary import upload_file_to_cloudinary

class PostMediaUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        files = request.FILES.getlist('files') or request.FILES.getlist('media')
        if not files:
            return Response({"error": "No files provided."}, status=status.HTTP_400_BAD_REQUEST)

        allowed_image_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        allowed_video_types = ['video/mp4', 'video/quicktime', 'video/mov', 'video/x-matroska', 'video/webm']
        
        MAX_IMAGE_SIZE = 10 * 1024 * 1024   # 10MB
        MAX_VIDEO_SIZE = 100 * 1024 * 1024 # 100MB

        uploaded_results = []

        for f in files:
            content_type = f.content_type
            size = f.size

            if content_type in allowed_image_types:
                if size > MAX_IMAGE_SIZE:
                    return Response({"error": f"Image size exceeds the 10MB limit: {f.name}"}, status=status.HTTP_400_BAD_REQUEST)
                resource_type = 'image'
            elif content_type in allowed_video_types:
                if size > MAX_VIDEO_SIZE:
                    return Response({"error": f"Video size exceeds the 100MB limit: {f.name}"}, status=status.HTTP_400_BAD_REQUEST)
                resource_type = 'video'
            else:
                ext = f.name.split('.')[-1].lower() if f.name else ''
                if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
                    if size > MAX_IMAGE_SIZE:
                        return Response({"error": f"Image size exceeds the 10MB limit: {f.name}"}, status=status.HTTP_400_BAD_REQUEST)
                    resource_type = 'image'
                elif ext in ['mp4', 'mov', 'avi', 'mkv', 'webm']:
                    if size > MAX_VIDEO_SIZE:
                        return Response({"error": f"Video size exceeds the 100MB limit: {f.name}"}, status=status.HTTP_400_BAD_REQUEST)
                    resource_type = 'video'
                else:
                    return Response({"error": f"Unsupported file type: {f.name}"}, status=status.HTTP_400_BAD_REQUEST)

            try:
                result = upload_file_to_cloudinary(f, resource_type=resource_type)
                uploaded_results.append({
                    'media_url': result['secure_url'],
                    'media_type': result['resource_type'],
                    'public_id': result['public_id'],
                    'thumbnail_url': result['thumbnail_url']
                })
            except Exception as e:
                return Response({"error": f"Upload failed for {f.name}: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(uploaded_results, status=status.HTTP_201_CREATED)


