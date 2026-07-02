from django.urls import path
from .views import HashtagDetailView, TrendingHashtagsView, HashtagSearchView

urlpatterns = [
    path('trending/', TrendingHashtagsView.as_view(), name='hashtag-trending'),
    path('search/', HashtagSearchView.as_view(), name='hashtag-search'),
    path('<str:name>/', HashtagDetailView.as_view(), name='hashtag-detail'),
]
