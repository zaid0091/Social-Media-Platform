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

