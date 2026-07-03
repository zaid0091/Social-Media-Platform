from django.shortcuts import get_object_or_404
from django.db import models
from django.db.models import Q
from django.db.models.functions import Coalesce
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import CursorPagination
from rest_framework.parsers import MultiPartParser, FormParser

from accounts.models import BlockedUser
from django.contrib.auth import get_user_model
from .models import Conversation, DirectMessage, MessageReaction
from .serializers import ConversationSerializer, MessageSerializer
from core.utils.cloudinary import upload_file_to_cloudinary

User = get_user_model()

class ConversationMessagesCursorPagination(CursorPagination):
    page_size = 20
    ordering = '-created_at'

class ConversationListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ConversationSerializer

    def get_queryset(self):
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

        if BlockedUser.objects.filter(
            Q(blocker=request.user, blocked=recipient) |
            Q(blocker=recipient, blocked=request.user)
        ).exists():
            return Response({"detail": "Cannot start conversation due to a block relationship."}, status=status.HTTP_403_FORBIDDEN)

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
        # Group creator is an admin by default
        conversation.admins.add(request.user)

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
        replied_to_id = request.data.get('replied_to_id')

        conversation = get_object_or_404(Conversation, id=conversation_id, participants=request.user)

        participants = conversation.participants.exclude(id=request.user.id)
        for participant in participants:
            if BlockedUser.objects.filter(
                Q(blocker=request.user, blocked=participant) |
                Q(blocker=participant, blocked=request.user)
            ).exists():
                return Response({"detail": "Cannot send message due to a block relationship."}, status=status.HTTP_403_FORBIDDEN)

        replied_to = None
        if replied_to_id:
            replied_to = get_object_or_404(DirectMessage, id=replied_to_id, conversation=conversation)

        message = DirectMessage.objects.create(
            sender=request.user,
            conversation=conversation,
            content=content,
            media_url=media_url,
            message_type=message_type,
            replied_to=replied_to
        )

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

        message.is_deleted_for_sender = True
        message.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

class MessageReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, *args, **kwargs):
        message = get_object_or_404(DirectMessage, id=pk)
        
        if not message.conversation.participants.filter(id=request.user.id).exists():
            return Response({"detail": "Not a participant in this conversation."}, status=status.HTTP_403_FORBIDDEN)

        if message.sender != request.user:
            message.is_read = True
            message.save()

        return Response({"is_read": message.is_read})

class MessageMediaUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file') or request.FILES.get('media')
        if not file_obj:
            return Response({"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        MAX_SIZE = 100 * 1024 * 1024
        if file_obj.size > MAX_SIZE:
            return Response({"error": "File size exceeds 100MB."}, status=status.HTTP_400_BAD_REQUEST)

        content_type = file_obj.content_type
        if content_type and content_type.startswith('image/'):
            resource_type = 'image'
        elif content_type and content_type.startswith('video/'):
            resource_type = 'video'
        else:
            resource_type = 'auto'

        try:
            result = upload_file_to_cloudinary(file_obj, resource_type=resource_type)
            return Response({
                "media_url": result["secure_url"],
                "media_type": result.get("resource_type", "image")
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": f"Upload failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class MessageReactionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, message_id, *args, **kwargs):
        message = get_object_or_404(DirectMessage, id=message_id)
        if not message.conversation.participants.filter(id=request.user.id).exists():
            return Response({"detail": "Not a participant in this conversation."}, status=status.HTTP_403_FORBIDDEN)

        emoji = request.data.get('emoji')
        if not emoji:
            return Response({"detail": "emoji is required."}, status=status.HTTP_400_BAD_REQUEST)

        reaction, created = MessageReaction.objects.get_or_create(
            message=message,
            user=request.user,
            defaults={'emoji': emoji}
        )

        if not created:
            if reaction.emoji == emoji:
                reaction.delete()
                return Response({"status": "removed"}, status=status.HTTP_200_OK)
            else:
                reaction.emoji = emoji
                reaction.save()

        return Response({
            "status": "added",
            "emoji": emoji
        }, status=status.HTTP_200_OK)

class AddParticipantView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, conversation_id, *args, **kwargs):
        conversation = get_object_or_404(Conversation, id=conversation_id, participants=request.user)
        if not conversation.is_group:
            return Response({"detail": "Cannot add participant to a 1-to-1 conversation."}, status=status.HTTP_400_BAD_REQUEST)

        if not conversation.admins.filter(id=request.user.id).exists():
            return Response({"detail": "Only admins can add participants."}, status=status.HTTP_403_FORBIDDEN)

        user_id = request.data.get('user_id')
        if not user_id:
            return Response({"detail": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        new_participant = get_object_or_404(User, id=user_id)

        if BlockedUser.objects.filter(
            Q(blocker=request.user, blocked=new_participant) |
            Q(blocker=new_participant, blocked=request.user)
        ).exists():
            return Response({"detail": "Cannot add participant due to a block relationship."}, status=status.HTTP_403_FORBIDDEN)

        conversation.participants.add(new_participant)
        return Response({"detail": f"{new_participant.username} has been added to the group."}, status=status.HTTP_200_OK)

class RemoveParticipantView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, conversation_id, *args, **kwargs):
        conversation = get_object_or_404(Conversation, id=conversation_id, participants=request.user)
        if not conversation.is_group:
            return Response({"detail": "Cannot remove participant from a 1-to-1 conversation."}, status=status.HTTP_400_BAD_REQUEST)

        if not conversation.admins.filter(id=request.user.id).exists():
            return Response({"detail": "Only admins can remove participants."}, status=status.HTTP_43_FORBIDDEN if False else status.HTTP_403_FORBIDDEN)

        user_id = request.data.get('user_id')
        if not user_id:
            return Response({"detail": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        participant = get_object_or_404(User, id=user_id)
        if participant == request.user:
            return Response({"detail": "Use LeaveGroupView to leave the group."}, status=status.HTTP_400_BAD_REQUEST)

        conversation.participants.remove(participant)
        conversation.admins.remove(participant)
        return Response({"detail": f"{participant.username} has been removed from the group."}, status=status.HTTP_200_OK)

class LeaveGroupView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, conversation_id, *args, **kwargs):
        conversation = get_object_or_404(Conversation, id=conversation_id, participants=request.user)
        if not conversation.is_group:
            return Response({"detail": "Cannot leave a 1-to-1 conversation."}, status=status.HTTP_400_BAD_REQUEST)

        conversation.participants.remove(request.user)
        conversation.admins.remove(request.user)

        if conversation.participants.exists() and not conversation.admins.exists():
            next_admin = conversation.participants.first()
            conversation.admins.add(next_admin)

        return Response({"detail": "You have left the group."}, status=status.HTTP_200_OK)

class GroupAdminView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, conversation_id, *args, **kwargs):
        conversation = get_object_or_404(Conversation, id=conversation_id, participants=request.user)
        if not conversation.is_group:
            return Response({"detail": "Not a group conversation."}, status=status.HTTP_400_BAD_REQUEST)

        if not conversation.admins.filter(id=request.user.id).exists():
            return Response({"detail": "Only admins can perform admin actions."}, status=status.HTTP_403_FORBIDDEN)

        user_id = request.data.get('user_id')
        action = request.data.get('action')

        if not user_id or action not in ['promote', 'demote']:
            return Response({"detail": "user_id and action ('promote'/'demote') are required."}, status=status.HTTP_400_BAD_REQUEST)

        target_user = get_object_or_404(User, id=user_id)
        if not conversation.participants.filter(id=target_user.id).exists():
            return Response({"detail": "User is not a participant of this group."}, status=status.HTTP_400_BAD_REQUEST)

        if action == 'promote':
            conversation.admins.add(target_user)
            return Response({"detail": f"{target_user.username} has been promoted to admin."}, status=status.HTTP_200_OK)
        elif action == 'demote':
            if target_user == conversation.created_by:
                return Response({"detail": "Cannot demote the group creator."}, status=status.HTTP_400_BAD_REQUEST)
            conversation.admins.remove(target_user)
            return Response({"detail": f"{target_user.username} has been demoted to member."}, status=status.HTTP_200_OK)

class ConversationMuteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, conversation_id, *args, **kwargs):
        conversation = get_object_or_404(Conversation, id=conversation_id, participants=request.user)
        if conversation.muted_by.filter(id=request.user.id).exists():
            conversation.muted_by.remove(request.user)
            muted = False
        else:
            conversation.muted_by.add(request.user)
            muted = True
        return Response({"is_muted": muted}, status=status.HTTP_200_OK)

class MessageForwardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, message_id, *args, **kwargs):
        message = get_object_or_404(DirectMessage, id=message_id)
        if not message.conversation.participants.filter(id=request.user.id).exists():
            return Response({"detail": "Not a participant in this conversation."}, status=status.HTTP_403_FORBIDDEN)

        target_conversation_id = request.data.get('target_conversation_id')
        if not target_conversation_id:
            return Response({"detail": "target_conversation_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        target_conversation = get_object_or_404(Conversation, id=target_conversation_id, participants=request.user)

        participants = target_conversation.participants.exclude(id=request.user.id)
        for p in participants:
            if BlockedUser.objects.filter(
                Q(blocker=request.user, blocked=p) |
                Q(blocker=p, blocked=request.user)
            ).exists():
                return Response({"detail": "Cannot forward message to this conversation due to a block relationship."}, status=status.HTTP_403_FORBIDDEN)

        forwarded_message = DirectMessage.objects.create(
            sender=request.user,
            conversation=target_conversation,
            content=f"[Forwarded] {message.content}" if message.content else "[Forwarded Media]",
            media_url=message.media_url,
            message_type=message.message_type
        )
        target_conversation.last_message = forwarded_message
        target_conversation.save()

        serializer = MessageSerializer(forwarded_message)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class ConversationMessageSearchView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageSerializer

    def get_queryset(self):
        conversation_id = self.kwargs.get('conversation_id')
        conversation = get_object_or_404(Conversation, id=conversation_id, participants=self.request.user)
        q = self.request.query_params.get('q', '')
        if not q:
            return DirectMessage.objects.none()
        return conversation.messages.filter(
            content__icontains=q
        ).exclude(
            sender=self.request.user, is_deleted_for_sender=True
        ).order_by('-created_at')
