from django.urls import path
from .views import (
    StoryCreateView, StoryListView, StoryDetailView, StoryDeleteView,
    StoryViewView, StoryViewerListView,
    StoryHighlightCreateView, StoryHighlightUpdateView, 
    StoryHighlightDeleteView, StoryHighlightDetailView
)

urlpatterns = [
    # Story endpoints
    path('', StoryListView.as_view(), name='story-list'),
    path('create/', StoryCreateView.as_view(), name='story-create'),
    path('<uuid:story_id>/', StoryDetailView.as_view(), name='story-detail'),
    path('<uuid:story_id>/delete/', StoryDeleteView.as_view(), name='story-delete'),
    path('<uuid:story_id>/view/', StoryViewView.as_view(), name='story-view-toggle'),
    path('<uuid:story_id>/viewers/', StoryViewerListView.as_view(), name='story-viewers'),

    # Highlights endpoints
    path('highlights/create/', StoryHighlightCreateView.as_view(), name='highlight-create'),
    path('highlights/<uuid:highlight_id>/', StoryHighlightDetailView.as_view(), name='highlight-detail'),
    path('highlights/<uuid:highlight_id>/update/', StoryHighlightUpdateView.as_view(), name='highlight-update'),
    path('highlights/<uuid:highlight_id>/delete/', StoryHighlightDeleteView.as_view(), name='highlight-delete'),
]
