from django.urls import path
from .views import (
    ConversationListView,
    ConversationDetailView,
    ConversationCreateView,
    GroupConversationCreateView,
    GroupConversationUpdateView,
    MessageCreateView,
    MessageDeleteView,
    MessageReadView,
)

urlpatterns = [
    path('conversations/', ConversationListView.as_view(), name='conversation-list'),
    path('conversations/<uuid:pk>/', ConversationDetailView.as_view(), name='conversation-detail'),
    path('conversations/create/', ConversationCreateView.as_view(), name='conversation-create'),
    path('conversations/group/', GroupConversationCreateView.as_view(), name='group-conversation-create'),
    path('conversations/group/<uuid:pk>/', GroupConversationUpdateView.as_view(), name='group-conversation-update'),
    path('messages/', MessageCreateView.as_view(), name='message-create'),
    path('messages/<uuid:pk>/', MessageDeleteView.as_view(), name='message-delete'),
    path('messages/<uuid:pk>/read/', MessageReadView.as_view(), name='message-read'),
]
