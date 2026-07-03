from django.shortcuts import get_object_or_404
from django.db import models
from django.db.models import Q, Count
from django.db.models.functions import Coalesce
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import CursorPagination

from accounts.models import BlockedUser
from django.contrib.auth import get_user_model
from .models import Conversation, DirectMessage
from .serializers import ConversationSerializer, MessageSerializer

User = get_user_model()

class ConversationMessagesCursorPagination(CursorPagination):
    page_size = 20
    ordering = '-created_at'

class ConversationListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ConversationSerializer

    def get_queryset(self):
        # Order conversations by the last message's creation time, or fallback to the conversation's creation time
        return Conversation.objects.filter(
            participants=self.request.user
        ).annotate(
            last_activity=Coalesce('last_message__created_at', 'created_at')
        ).order_by('-last_activity')

class ConversationDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ConversationSerializer

    def get_queryset(self):
        return Conversation.objects.filter(participants=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        conversation = self.get_object()
        
        # Exclude messages that the sender (requesting user) has soft-deleted
        messages_qs = conversation.messages.filter(
            ~Q(sender=request.user, is_deleted_for_sender=True)
        ).order_by('-created_at')

        paginator = ConversationMessagesCursorPagination()
        page = paginator.paginate_queryset(messages_qs, request, view=self)
        
        message_serializer = MessageSerializer(page, many=True, context={'request': request})
        conv_serializer = self.get_serializer(conversation)

        response_data = {
            "conversation": conv_serializer.data,
            "messages": {
                "next": paginator.get_next_link(),
                "previous": paginator.get_previous_link(),
                "results": message_serializer.data
            }
        }
        return Response(response_data)

class ConversationCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ConversationSerializer

    def create(self, request, *args, **kwargs):
        recipient_id = request.data.get('recipient_id')
        if not recipient_id:
            return Response({"detail": "recipient_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        recipient = get_object_or_404(User, id=recipient_id)
        if recipient == request.user:
            return Response({"detail": "Cannot start a conversation with yourself."}, status=status.HTTP_400_BAD_REQUEST)

        # Enforce block relationship check
        if BlockedUser.objects.filter(
            Q(blocker=request.user, blocked=recipient) |
            Q(blocker=recipient, blocked=request.user)
        ).exists():
            return Response({"detail": "Cannot start conversation due to a block relationship."}, status=status.HTTP_403_FORBIDDEN)

        # Get or create 1-to-1 conversation
        conversation = None
        for c in Conversation.objects.filter(is_group=False, participants=request.user).filter(participants=recipient):
            if c.participants.count() == 2:
                conversation = c
                break

        if not conversation:
            conversation = Conversation.objects.create(is_group=False)
            conversation.participants.add(request.user, recipient)

        serializer = self.get_serializer(conversation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class GroupConversationCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ConversationSerializer

    def create(self, request, *args, **kwargs):
        group_name = request.data.get('group_name')
        participant_ids = request.data.get('participant_ids', [])
        group_avatar = request.data.get('group_avatar', '')

        if not group_name:
            return Response({"detail": "group_name is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Enforce block validation with all participants
        participants = User.objects.filter(id__in=participant_ids)
        for participant in participants:
            if BlockedUser.objects.filter(
                Q(blocker=request.user, blocked=participant) |
                Q(blocker=participant, blocked=request.user)
            ).exists():
                return Response({"detail": f"Cannot create group due to block relationship with {participant.username}."}, status=status.HTTP_403_FORBIDDEN)

        conversation = Conversation.objects.create(
            is_group=True,
            group_name=group_name,
            group_avatar=group_avatar,
            created_by=request.user
        )
        conversation.participants.add(request.user, *participants)

        serializer = self.get_serializer(conversation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class GroupConversationUpdateView(generics.UpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ConversationSerializer

    def get_queryset(self):
        return Conversation.objects.filter(is_group=True, participants=self.request.user)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        
        group_name = request.data.get('group_name')
        group_avatar = request.data.get('group_avatar')

        if group_name is not None:
            instance.group_name = group_name
        if group_avatar is not None:
            instance.group_avatar = group_avatar

        instance.save()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

class MessageCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageSerializer

    def create(self, request, *args, **kwargs):
        conversation_id = request.data.get('conversation_id')
        content = request.data.get('content', '')
        media_url = request.data.get('media_url', '')
        message_type = request.data.get('message_type', 'text')

        conversation = get_object_or_404(Conversation, id=conversation_id, participants=request.user)

        # Verify block constraints for all participants in the conversation
        participants = conversation.participants.exclude(id=request.user.id)
        for participant in participants:
            if BlockedUser.objects.filter(
                Q(blocker=request.user, blocked=participant) |
                Q(blocker=participant, blocked=request.user)
            ).exists():
                return Response({"detail": "Cannot send message due to a block relationship."}, status=status.HTTP_403_FORBIDDEN)

        message = DirectMessage.objects.create(
            sender=request.user,
            conversation=conversation,
            content=content,
            media_url=media_url,
            message_type=message_type
        )

        # Update last message on conversation
        conversation.last_message = message
        conversation.save()

        serializer = self.get_serializer(message)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class MessageDeleteView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = DirectMessage.objects.all()

    def destroy(self, request, *args, **kwargs):
        message = self.get_object()
        if message.sender != request.user:
            return Response({"detail": "Only the sender can delete this message."}, status=status.HTTP_403_FORBIDDEN)

        # Soft-delete for the sender
        message.is_deleted_for_sender = True
        message.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

class MessageReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, *args, **kwargs):
        message = get_object_or_404(DirectMessage, id=pk)
        
        # Enforce that the user is a participant in the conversation
        if not message.conversation.participants.filter(id=request.user.id).exists():
            return Response({"detail": "Not a participant in this conversation."}, status=status.HTTP_403_FORBIDDEN)

        # Mark as read if not sent by requesting user
        if message.sender != request.user:
            message.is_read = True
            message.save()

        return Response({"is_read": message.is_read})
