from django.urls import path
from .views import (
    PostCreateView, PostDetailView, PostUpdateView, 
    PostDeleteView, UserPostListView, PostMediaUploadView,
    LikeView, CommentLikeView, BookmarkView, BookmarkListView, PostLikerListView,
    CommentListCreateView, CommentRepliesView, CommentUpdateView, CommentDeleteView,
    FeedView
)

urlpatterns = [
    path('feed/', FeedView.as_view(), name='news-feed'),
    path('', PostCreateView.as_view(), name='post-create'),
    path('upload-media/', PostMediaUploadView.as_view(), name='post-media-upload'),
    path('<uuid:post_id>/', PostDetailView.as_view(), name='post-detail'),
    path('<uuid:post_id>/update/', PostUpdateView.as_view(), name='post-update'),
    path('<uuid:post_id>/delete/', PostDeleteView.as_view(), name='post-delete'),
    path('user/<uuid:user_id>/', UserPostListView.as_view(), name='user-posts-list'),
    
    # Likes & Bookmarks endpoints
    path('like/<uuid:object_id>/', LikeView.as_view(), name='like-toggle'),
    path('comment-like/<uuid:comment_id>/', CommentLikeView.as_view(), name='comment-like-toggle'),
    path('bookmark/<uuid:post_id>/', BookmarkView.as_view(), name='bookmark-toggle'),
    path('bookmarks/', BookmarkListView.as_view(), name='bookmark-list'),
    path('<uuid:post_id>/likers/', PostLikerListView.as_view(), name='post-likers'),

    # Comment endpoints
    path('<uuid:post_id>/comments/', CommentListCreateView.as_view(), name='comment-list-create'),
    path('comments/<uuid:comment_id>/', CommentUpdateView.as_view(), name='comment-update'),
    path('comments/<uuid:comment_id>/delete/', CommentDeleteView.as_view(), name='comment-delete'),
    path('comments/<uuid:comment_id>/replies/', CommentRepliesView.as_view(), name='comment-replies'),
]


