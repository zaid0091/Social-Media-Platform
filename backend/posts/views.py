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
from .models import Post, Bookmark, Collection
from .serializers import PostSerializer, PostCreateSerializer, CollectionSerializer, CollectionDetailSerializer

User = get_user_model()

class PostCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = PostCreateSerializer(data=request.data)
        if serializer.is_valid():
            post = serializer.save(author=request.user)

            # Mention parsing: extract @username mentions
            content = post.content or ""
            usernames = re.findall(r"@(\w+)", content)
            for username in set(usernames):
                try:
                    mentioned_user = User.objects.get(username__iexact=username)
                    if mentioned_user != request.user:
                        if not BlockedUser.objects.filter(
                            Q(blocker=request.user, blocked=mentioned_user) |
                            Q(blocker=mentioned_user, blocked=request.user)
                        ).exists():
                            from notifications.utils import create_notification
                            create_notification(
                                recipient=mentioned_user,
                                sender=request.user,
                                notification_type='mention',
                                related_post=post
                            )
                except User.DoesNotExist:
                    pass

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

        posts = Post.objects.filter(author=target_user, is_deleted=False, is_hidden=False, needs_review=False).order_by('-created_at')
        from core.pagination import CustomCursorPagination
        paginator = CustomCursorPagination()
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


from django.contrib.contenttypes.models import ContentType
from rest_framework.throttling import ScopedRateThrottle
from .models import Like, Bookmark, Comment

class LikeView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'likes'

    def post(self, request, object_id, *args, **kwargs):
        target_type = request.data.get('type') or request.query_params.get('type') or 'post'
        target_type = target_type.lower()

        if target_type == 'post':
            try:
                target_obj = Post.objects.get(id=object_id, is_deleted=False)
            except Post.DoesNotExist:
                return Response({"error": "Post not found."}, status=status.HTTP_404_NOT_FOUND)
            model_class = Post
        elif target_type == 'comment':
            try:
                target_obj = Comment.objects.get(id=object_id, is_deleted=False)
            except Comment.DoesNotExist:
                return Response({"error": "Comment not found."}, status=status.HTTP_404_NOT_FOUND)
            model_class = Comment
        else:
            return Response({"error": "Invalid type parameter. Use 'post' or 'comment'."}, status=status.HTTP_400_BAD_REQUEST)

        # Block checks
        if BlockedUser.objects.filter(
            Q(blocker=request.user, blocked=target_obj.author) |
            Q(blocker=target_obj.author, blocked=request.user)
        ).exists():
            return Response({"error": f"{target_type.capitalize()} not found."}, status=status.HTTP_404_NOT_FOUND)

        content_type = ContentType.objects.get_for_model(model_class)
        like_filter = Like.objects.filter(
            user=request.user,
            content_type=content_type,
            object_id=object_id
        )

        if like_filter.exists():
            like_filter.delete()
            liked = False
        else:
            Like.objects.create(
                user=request.user,
                content_type=content_type,
                object_id=object_id
            )
            liked = True

        target_obj.refresh_from_db()
        return Response({
            "liked": liked,
            "like_count": target_obj.like_count
        }, status=status.HTTP_200_OK)

class CommentLikeView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'likes'

    def post(self, request, comment_id, *args, **kwargs):
        try:
            target_obj = Comment.objects.get(id=comment_id, is_deleted=False)
        except Comment.DoesNotExist:
            return Response({"error": "Comment not found."}, status=status.HTTP_404_NOT_FOUND)

        # Block checks
        if BlockedUser.objects.filter(
            Q(blocker=request.user, blocked=target_obj.author) |
            Q(blocker=target_obj.author, blocked=request.user)
        ).exists():
            return Response({"error": "Comment not found."}, status=status.HTTP_404_NOT_FOUND)

        content_type = ContentType.objects.get_for_model(Comment)
        like_filter = Like.objects.filter(
            user=request.user,
            content_type=content_type,
            object_id=comment_id
        )

        if like_filter.exists():
            like_filter.delete()
            liked = False
        else:
            Like.objects.create(
                user=request.user,
                content_type=content_type,
                object_id=comment_id
            )
            liked = True

        target_obj.refresh_from_db()
        return Response({
            "liked": liked,
            "like_count": target_obj.like_count
        }, status=status.HTTP_200_OK)

class BookmarkView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, post_id, *args, **kwargs):
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

        bookmark_filter = Bookmark.objects.filter(user=request.user, post=post)
        if bookmark_filter.exists():
            bookmark_filter.delete()
            # Cascade delete from user's collections
            for collection in Collection.objects.filter(user=request.user, posts=post):
                collection.posts.remove(post)
            bookmarked = False
        else:
            Bookmark.objects.create(user=request.user, post=post)
            bookmarked = True

        return Response({
            "bookmarked": bookmarked
        }, status=status.HTTP_200_OK)

class BookmarkListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        bookmarked_post_ids = Bookmark.objects.filter(user=request.user).values_list('post_id', flat=True)
        blocked_users = BlockedUser.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
        blockers = BlockedUser.objects.filter(blocked=request.user).values_list('blocker_id', flat=True)
        all_blocked = set(list(blocked_users) + list(blockers))

        posts = Post.objects.filter(
            id__in=bookmarked_post_ids,
            is_deleted=False,
            is_hidden=False,
            needs_review=False
        ).exclude(author_id__in=all_blocked).order_by('-created_at')

        paginator = PageNumberPagination()
        paginator.page_size = 10
        result_page = paginator.paginate_queryset(posts, request)
        serializer = PostSerializer(result_page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

class PostLikerListView(APIView):
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

        post_ct = ContentType.objects.get_for_model(Post)
        liker_ids = Like.objects.filter(
            content_type=post_ct,
            object_id=post_id
        ).values_list('user_id', flat=True)

        blocked_users = BlockedUser.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
        blockers = BlockedUser.objects.filter(blocked=request.user).values_list('blocker_id', flat=True)
        all_blocked = set(list(blocked_users) + list(blockers))

        users = User.objects.filter(id__in=liker_ids, is_active=True).exclude(id__in=all_blocked).order_by('username')
        
        paginator = PageNumberPagination()
        paginator.page_size = 10
        result_page = paginator.paginate_queryset(users, request)
        from accounts.serializers import UserFollowDetailsSerializer
        serializer = UserFollowDetailsSerializer(result_page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


from .serializers import CommentSerializer, CommentCreateSerializer

class CommentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, post_id, *args, **kwargs):
        try:
            post = Post.objects.get(id=post_id, is_deleted=False)
        except Post.DoesNotExist:
            return Response({"error": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        # Block check
        if BlockedUser.objects.filter(
            Q(blocker=request.user, blocked=post.author) |
            Q(blocker=post.author, blocked=request.user)
        ).exists():
            return Response({"error": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        comments = Comment.objects.filter(post=post, parent__isnull=True, is_deleted=False, is_hidden=False, needs_review=False).order_by('-created_at')

        blocked_users = BlockedUser.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
        blockers = BlockedUser.objects.filter(blocked=request.user).values_list('blocker_id', flat=True)
        all_blocked = set(list(blocked_users) + list(blockers))

        comments = comments.exclude(author_id__in=all_blocked)

        # Restriction Filter
        from accounts.models import RestrictedUser
        restricted_by_author = RestrictedUser.objects.filter(restrictor=post.author).values_list('restricted_id', flat=True)
        if restricted_by_author.exists() and request.user != post.author:
            if request.user.is_authenticated:
                comments = comments.filter(
                    Q(author=request.user) | ~Q(author_id__in=restricted_by_author)
                )
            else:
                comments = comments.exclude(
                    author_id__in=restricted_by_author
                )

        from core.pagination import CustomCursorPagination
        paginator = CustomCursorPagination()
        paginator.page_size = 10
        result_page = paginator.paginate_queryset(comments, request)
        serializer = CommentSerializer(result_page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

    def post(self, request, post_id, *args, **kwargs):
        try:
            post = Post.objects.get(id=post_id, is_deleted=False)
        except Post.DoesNotExist:
            return Response({"error": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        # Block check
        if BlockedUser.objects.filter(
            Q(blocker=request.user, blocked=post.author) |
            Q(blocker=post.author, blocked=request.user)
        ).exists():
            return Response({"error": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        data = request.data.copy()
        data['post'] = post.id
        serializer = CommentCreateSerializer(data=data)
        if serializer.is_valid():
            comment = serializer.save(author=request.user)

            # Mention parsing: extract @username mentions
            content = comment.content or ""
            usernames = re.findall(r"@(\w+)", content)
            for username in set(usernames):
                try:
                    mentioned_user = User.objects.get(username__iexact=username)
                    if mentioned_user != request.user:
                        if not BlockedUser.objects.filter(
                            Q(blocker=request.user, blocked=mentioned_user) |
                            Q(blocker=mentioned_user, blocked=request.user)
                        ).exists():
                            from notifications.utils import create_notification
                            create_notification(
                                recipient=mentioned_user,
                                sender=request.user,
                                notification_type='mention',
                                related_post=post,
                                related_comment=comment
                            )
                except User.DoesNotExist:
                    pass

            return Response(CommentSerializer(comment, context={'request': request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class CommentRepliesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, comment_id, *args, **kwargs):
        try:
            comment = Comment.objects.get(id=comment_id, is_deleted=False)
        except Comment.DoesNotExist:
            return Response({"error": "Comment not found."}, status=status.HTTP_404_NOT_FOUND)

        if BlockedUser.objects.filter(
            Q(blocker=request.user, blocked=comment.author) |
            Q(blocker=comment.author, blocked=request.user)
        ).exists():
            return Response({"error": "Comment not found."}, status=status.HTTP_404_NOT_FOUND)

        replies = Comment.objects.filter(parent=comment, is_deleted=False, is_hidden=False, needs_review=False).order_by('created_at')

        blocked_users = BlockedUser.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
        blockers = BlockedUser.objects.filter(blocked=request.user).values_list('blocker_id', flat=True)
        all_blocked = set(list(blocked_users) + list(blockers))

        replies = replies.exclude(author_id__in=all_blocked)

        # Restriction Filter
        from accounts.models import RestrictedUser
        post_obj = comment.post
        restricted_by_author = RestrictedUser.objects.filter(restrictor=post_obj.author).values_list('restricted_id', flat=True)
        if restricted_by_author.exists() and request.user != post_obj.author:
            if request.user.is_authenticated:
                replies = replies.filter(
                    Q(author=request.user) | ~Q(author_id__in=restricted_by_author)
                )
            else:
                replies = replies.exclude(
                    author_id__in=restricted_by_author
                )

        from core.pagination import CustomCursorPagination
        class CommentRepliesCursorPagination(CustomCursorPagination):
            ordering = 'created_at'
            page_size = 10

        paginator = CommentRepliesCursorPagination()
        result_page = paginator.paginate_queryset(replies, request)
        serializer = CommentSerializer(result_page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

class CommentUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, comment_id, *args, **kwargs):
        try:
            comment = Comment.objects.get(id=comment_id, is_deleted=False)
        except Comment.DoesNotExist:
            return Response({"error": "Comment not found."}, status=status.HTTP_404_NOT_FOUND)

        if comment.author != request.user:
            return Response({"error": "You do not have permission to edit this comment."}, status=status.HTTP_403_FORBIDDEN)

        content = request.data.get('content')
        if content is not None:
            comment.content = content
            comment.save()
        
        return Response(CommentSerializer(comment, context={'request': request}).data, status=status.HTTP_200_OK)

    def put(self, request, comment_id, *args, **kwargs):
        return self.patch(request, comment_id, *args, **kwargs)

class CommentDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, comment_id, *args, **kwargs):
        try:
            comment = Comment.objects.get(id=comment_id, is_deleted=False)
        except Comment.DoesNotExist:
            return Response({"error": "Comment not found."}, status=status.HTTP_404_NOT_FOUND)

        if comment.author != request.user:
            return Response({"error": "You do not have permission to delete this comment."}, status=status.HTTP_403_FORBIDDEN)

        comment.is_deleted = True
        comment.save(update_fields=['is_deleted'])

        return Response({"message": "Comment successfully deleted."}, status=status.HTTP_200_OK)

    def post(self, request, comment_id, *args, **kwargs):
        return self.delete(request, comment_id, *args, **kwargs)


from django.core.cache import cache
from rest_framework.pagination import CursorPagination
from django.db.models import Case, When
from .services import FeedGenerationService

from core.pagination import CustomCursorPagination

class ChronologicalFeedPagination(CustomCursorPagination):
    page_size = 10
    ordering = '-created_at'

class FeedView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        feed_type = request.query_params.get('feed_type', 'ranked').lower()
        refresh = request.query_params.get('refresh', '').lower() == 'true'

        if feed_type == 'chronological':
            # 1. Get followed users
            followed_ids = list(Follow.objects.filter(follower=request.user).values_list('following_id', flat=True))
            
            # 2. Get blocked users
            blocked_users = BlockedUser.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
            blockers = BlockedUser.objects.filter(blocked=request.user).values_list('blocker_id', flat=True)
            all_blocked = set(list(blocked_users) + list(blockers))

            # 3. Retrieve posts
            posts = Post.objects.filter(
                author_id__in=followed_ids,
                is_deleted=False
            ).exclude(
                author_id__in=all_blocked
            ).exclude(
                privacy='private'
            ).order_by('-created_at')

            paginator = ChronologicalFeedPagination()
            result_page = paginator.paginate_queryset(posts, request)
            serializer = PostSerializer(result_page, many=True, context={'request': request})
            return paginator.get_paginated_response(serializer.data)

        else:
            # Ranked feed
            if refresh:
                cache_key = f"user_feed_{request.user.id}"
                cache.delete(cache_key)

            post_ids = FeedGenerationService.generate_ranked_feed(request.user)

            # Paginate cached ranked list using index-based cursor
            cursor = request.query_params.get('cursor')
            offset = 0
            if cursor:
                try:
                    import base64
                    offset = int(base64.b64decode(cursor.encode()).decode())
                except Exception:
                    offset = 0

            limit = 10
            page_ids = post_ids[offset:offset+limit]

            # Fetch posts in exact order of list IDs
            if page_ids:
                clauses = [When(id=pk, then=pos) for pos, pk in enumerate(page_ids)]
                posts = Post.objects.filter(id__in=page_ids).order_by(Case(*clauses))
            else:
                posts = Post.objects.none()

            serializer = PostSerializer(posts, many=True, context={'request': request})

            next_offset = offset + limit
            next_cursor = None
            if next_offset < len(post_ids):
                import base64
                next_cursor = base64.b64encode(str(next_offset).encode()).decode()

            return Response({
                "next": next_cursor,
                "has_next": next_cursor is not None,
                "results": serializer.data
            }, status=status.HTTP_200_OK)

class PostExploreView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        category = request.query_params.get('category', 'for_you').lower()

        # Exclude blocked users
        blocked_users = BlockedUser.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
        blockers = BlockedUser.objects.filter(blocked=request.user).values_list('blocker_id', flat=True)
        all_blocked = set(list(blocked_users) + list(blockers))

        posts = Post.objects.filter(
            is_deleted=False,
            is_hidden=False,
            needs_review=False,
            privacy='public'
        ).exclude(author_id__in=all_blocked)

        if category == 'photos':
            posts = posts.filter(Q(post_type='image') | Q(post_type='mixed'))
        elif category == 'videos':
            posts = posts.filter(post_type='video')

        # Sorting: trending groups by highest likes and comments, others by timeline
        if category == 'trending':
            posts = posts.order_by('-like_count', '-comment_count', '-created_at')
        else:
            posts = posts.order_by('-created_at')

        paginator = PageNumberPagination()
        paginator.page_size = 12
        result_page = paginator.paginate_queryset(posts.distinct(), request)
        serializer = PostSerializer(result_page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


class CollectionListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        collections = Collection.objects.filter(user=request.user)
        serializer = CollectionSerializer(collections, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        name = request.data.get('name', '').strip()
        if not name:
            return Response({"error": "Collection name is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        if Collection.objects.filter(user=request.user, name__iexact=name).exists():
            return Response({"error": "A collection with this name already exists."}, status=status.HTTP_400_BAD_REQUEST)
            
        collection = Collection.objects.create(user=request.user, name=name)
        serializer = CollectionSerializer(collection, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CollectionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, collection_id, *args, **kwargs):
        try:
            collection = Collection.objects.get(id=collection_id, user=request.user)
        except Collection.DoesNotExist:
            return Response({"error": "Collection not found."}, status=status.HTTP_404_NOT_FOUND)
            
        serializer = CollectionDetailSerializer(collection, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, collection_id, *args, **kwargs):
        try:
            collection = Collection.objects.get(id=collection_id, user=request.user)
        except Collection.DoesNotExist:
            return Response({"error": "Collection not found."}, status=status.HTTP_404_NOT_FOUND)
            
        collection.delete()
        return Response({"message": "Collection deleted successfully."}, status=status.HTTP_200_OK)


class CollectionAddPostView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, collection_id, post_id, *args, **kwargs):
        try:
            collection = Collection.objects.get(id=collection_id, user=request.user)
        except Collection.DoesNotExist:
            return Response({"error": "Collection not found."}, status=status.HTTP_404_NOT_FOUND)
            
        try:
            post = Post.objects.get(id=post_id, is_deleted=False)
        except Post.DoesNotExist:
            return Response({"error": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        # Auto-bookmark the post if not already bookmarked
        Bookmark.objects.get_or_create(user=request.user, post=post)
        
        # Add post to collection
        collection.posts.add(post)
        return Response({"message": "Post added to collection successfully."}, status=status.HTTP_200_OK)


class CollectionRemovePostView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, collection_id, post_id, *args, **kwargs):
        try:
            collection = Collection.objects.get(id=collection_id, user=request.user)
        except Collection.DoesNotExist:
            return Response({"error": "Collection not found."}, status=status.HTTP_404_NOT_FOUND)
            
        try:
            post = Post.objects.get(id=post_id, is_deleted=False)
        except Post.DoesNotExist:
            return Response({"error": "Post not found."}, status=status.HTTP_404_NOT_FOUND)
            
        collection.posts.remove(post)
        return Response({"message": "Post removed from collection successfully."}, status=status.HTTP_200_OK)


class RepostToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, post_id, *args, **kwargs):
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

        repost_filter = Post.objects.filter(
            author=request.user, 
            repost_of=post, 
            post_type='repost',
            is_deleted=False
        )

        if repost_filter.exists():
            repost_filter.update(is_deleted=True)
            if post.repost_count > 0:
                post.repost_count -= 1
                post.save(update_fields=['repost_count'])
            reposted = False
        else:
            Post.objects.create(
                author=request.user,
                repost_of=post,
                post_type='repost',
                privacy=post.privacy
            )
            post.repost_count += 1
            post.save(update_fields=['repost_count'])
            
            # Send notification
            if post.author != request.user:
                from notifications.utils import create_notification
                create_notification(
                    recipient=post.author,
                    sender=request.user,
                    notification_type='repost',
                    related_post=post
                )
            reposted = True

        return Response({
            "reposted": reposted,
            "repost_count": post.repost_count
        }, status=status.HTTP_200_OK)


class QuotePostView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, post_id, *args, **kwargs):
        try:
            post = Post.objects.get(id=post_id, is_deleted=False)
        except Post.DoesNotExist:
            return Response({"error": "Post on quote not found."}, status=status.HTTP_404_NOT_FOUND)

        # Block checks
        if BlockedUser.objects.filter(
            Q(blocker=request.user, blocked=post.author) |
            Q(blocker=post.author, blocked=request.user)
        ).exists():
            return Response({"error": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        content = request.data.get('content', '').strip()
        if not content:
            return Response({"error": "Content is required for quote posts."}, status=status.HTTP_400_BAD_REQUEST)

        quote = Post.objects.create(
            author=request.user,
            repost_of=post,
            content=content,
            post_type='quote',
            privacy='public'
        )

        post.repost_count += 1
        post.save(update_fields=['repost_count'])

        # Send notification
        if post.author != request.user:
            from notifications.utils import create_notification
            create_notification(
                recipient=post.author,
                sender=request.user,
                notification_type='repost',
                related_post=post
            )

        serializer = PostSerializer(quote, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MentionsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        username_query = f"@{request.user.username}"
        
        blocked_users = BlockedUser.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
        blockers = BlockedUser.objects.filter(blocked=request.user).values_list('blocker_id', flat=True)
        all_blocked = set(list(blocked_users) + list(blockers))

        following_ids = Follow.objects.filter(follower=request.user).values_list('following_id', flat=True)

        posts = Post.objects.filter(
            content__icontains=username_query,
            is_deleted=False,
            needs_review=False
        ).exclude(
            author_id__in=all_blocked
        ).filter(
            Q(author=request.user) | Q(author__is_private=False) | Q(author_id__in=following_ids)
        ).order_by('-created_at')

        comments = Comment.objects.filter(
            content__icontains=username_query,
            is_deleted=False,
            needs_review=False
        ).exclude(
            author_id__in=all_blocked
        ).filter(
            Q(author=request.user) | Q(author__is_private=False) | Q(author_id__in=following_ids)
        ).filter(
            post__is_deleted=False,
            post__needs_review=False
        ).exclude(
            post__author_id__in=all_blocked
        ).filter(
            Q(post__author=request.user) | Q(post__author__is_private=False) | Q(post__author_id__in=following_ids)
        ).order_by('-created_at')

        # Filter precisely in Python with word boundaries
        pattern = re.compile(rf'@\b{re.escape(request.user.username)}\b', re.IGNORECASE)
        
        filtered_posts = [p for p in posts if pattern.search(p.content or '')]
        filtered_comments = [c for c in comments if pattern.search(c.content or '')]

        from .serializers import CommentSerializer
        post_serializer = PostSerializer(filtered_posts, many=True, context={'request': request})
        comment_serializer = CommentSerializer(filtered_comments, many=True, context={'request': request})

        return Response({
            "posts": post_serializer.data,
            "comments": comment_serializer.data
        }, status=status.HTTP_200_OK)






