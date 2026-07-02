from django.urls import path
from .views import (
    PostCreateView, PostDetailView, PostUpdateView, 
    PostDeleteView, UserPostListView, PostMediaUploadView
)

urlpatterns = [
    path('', PostCreateView.as_view(), name='post-create'),
    path('upload-media/', PostMediaUploadView.as_view(), name='post-media-upload'),
    path('<uuid:post_id>/', PostDetailView.as_view(), name='post-detail'),
    path('<uuid:post_id>/update/', PostUpdateView.as_view(), name='post-update'),
    path('<uuid:post_id>/delete/', PostDeleteView.as_view(), name='post-delete'),
    path('user/<uuid:user_id>/', UserPostListView.as_view(), name='user-posts-list'),
]

