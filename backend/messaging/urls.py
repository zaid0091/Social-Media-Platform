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
    MessageMediaUploadView,
    MessageReactionView,
    AddParticipantView,
    RemoveParticipantView,
    LeaveGroupView,
    GroupAdminView,
    ConversationMuteView,
    MessageForwardView,
    ConversationMessageSearchView,
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
    
    # Phase 25 urls
    path('messages/upload-media/', MessageMediaUploadView.as_view(), name='message-media-upload'),
    path('messages/<uuid:message_id>/reaction/', MessageReactionView.as_view(), name='message-reaction'),
    path('messages/<uuid:message_id>/forward/', MessageForwardView.as_view(), name='message-forward'),
    path('conversations/<uuid:conversation_id>/add-participant/', AddParticipantView.as_view(), name='conversation-add-participant'),
    path('conversations/<uuid:conversation_id>/remove-participant/', RemoveParticipantView.as_view(), name='conversation-remove-participant'),
    path('conversations/<uuid:conversation_id>/leave/', LeaveGroupView.as_view(), name='conversation-leave'),
    path('conversations/<uuid:conversation_id>/admin-action/', GroupAdminView.as_view(), name='conversation-admin-action'),
    path('conversations/<uuid:conversation_id>/mute/', ConversationMuteView.as_view(), name='conversation-mute'),
    path('conversations/<uuid:conversation_id>/search/', ConversationMessageSearchView.as_view(), name='conversation-search'),
]
