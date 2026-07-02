from django.urls import path
from .views import (
    UserSearchView, PostSearchView, HashtagSearchView, GlobalSearchView,
    RecentSearchListView, ClearSearchHistoryView, SuggestedSearchView
)

urlpatterns = [
    path('users/', UserSearchView.as_view(), name='search-users'),
    path('posts/', PostSearchView.as_view(), name='search-posts'),
    path('hashtags/', HashtagSearchView.as_view(), name='search-hashtags'),
    path('global/', GlobalSearchView.as_view(), name='search-global'),
    path('recent/', RecentSearchListView.as_view(), name='search-recent'),
    path('clear/', ClearSearchHistoryView.as_view(), name='search-clear'),
    path('suggested/', SuggestedSearchView.as_view(), name='search-suggested'),
]
