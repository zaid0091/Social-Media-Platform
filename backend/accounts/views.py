from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.core.mail import send_mail
from django.core.signing import TimestampSigner, SignatureExpired, BadSignature
from django.urls import reverse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer

from .serializers import UserRegistrationSerializer, UserSerializer

User = get_user_model()

class RegisterView(APIView):
    permission_classes = []  # AllowAny

    def post(self, request, *args, **kwargs):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()

            # Create signed email verification token
            signer = TimestampSigner()
            token = signer.sign(user.email)

            # Build absolute verification URL
            verify_url = request.build_absolute_uri(
                reverse('verify-email') + f"?token={token}"
            )

            # Dispatch confirmation email
            subject = "Verify Your Social Media Platform Account"
            message = f"Hi {user.username},\n\nPlease verify your account by clicking the link below (valid for 24 hours):\n\n{verify_url}"
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )

            return Response({
                "message": "User registered successfully. Please check your email/console to verify your account."
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class VerifyEmailView(APIView):
    permission_classes = []  # AllowAny

    def get(self, request, *args, **kwargs):
        token = request.query_params.get('token')
        if not token:
            return Response({"error": "Missing verification token."}, status=status.HTTP_400_BAD_REQUEST)

        signer = TimestampSigner()
        try:
            # Token is valid for 24 hours (86400 seconds)
            email = signer.unsign(token, max_age=86400)
            user = User.objects.get(email=email)
            
            if user.is_active:
                return Response({"message": "Account is already verified."}, status=status.HTTP_200_OK)

            user.is_active = True
            user.save()
            return Response({"message": "Email verified successfully! You can now log in."}, status=status.HTTP_200_OK)
            
        except SignatureExpired:
            return Response({"error": "The verification link has expired."}, status=status.HTTP_400_BAD_REQUEST)
        except (BadSignature, User.DoesNotExist):
            return Response({"error": "Invalid verification link."}, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    permission_classes = []  # AllowAny

    def post(self, request, *args, **kwargs):
        username_or_email = request.data.get('username')
        password = request.data.get('password')

        if not username_or_email or not password:
            return Response({"error": "Both username/email and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        username = username_or_email
        # Authenticate by Email if email-like string is sent
        if '@' in username_or_email:
            try:
                user = User.objects.get(email__iexact=username_or_email)
                username = user.username
            except User.DoesNotExist:
                user = None

        user = authenticate(username=username, password=password)

        if user is not None:
            if not user.is_active:
                return Response({"error": "Please verify your email before logging in."}, status=status.HTTP_400_BAD_REQUEST)

            refresh = RefreshToken.for_user(user)
            response = Response({
                "access_token": str(refresh.access_token),
                "user": UserSerializer(user).data
            }, status=status.HTTP_200_OK)

            # Set refresh token in HttpOnly cookie
            response.set_cookie(
                key=settings.JWT_COOKIE_NAME,
                value=str(refresh),
                httponly=settings.JWT_COOKIE_HTTPONLY,
                secure=settings.JWT_COOKIE_SECURE,
                samesite=settings.JWT_COOKIE_SAMESITE,
                max_age=7 * 24 * 60 * 60  # 7 days in seconds
            )
            return response

        return Response({"error": "Invalid username/email or password."}, status=status.HTTP_401_UNAUTHORIZED)

class LogoutView(APIView):
    permission_classes = []  # AllowAny (can logout even if access token is already expired)

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(settings.JWT_COOKIE_NAME)
        if refresh_token:
            try:
                # Blacklist the refresh token
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass  # Token already expired or blacklisted

        response = Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)
        # Clear HttpOnly cookie
        response.delete_cookie(settings.JWT_COOKIE_NAME)
        return response

class CookieTokenRefreshView(APIView):
    permission_classes = []  # AllowAny

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(settings.JWT_COOKIE_NAME)
        if not refresh_token:
            return Response({"error": "Refresh token not found in cookies."}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            # Utilize SimpleJWT's TokenRefreshSerializer to handle rotation and blacklisting
            serializer = TokenRefreshSerializer(data={'refresh': refresh_token})
            serializer.is_valid(raise_exception=True)
            
            new_access = serializer.validated_data.get('access')
            new_refresh = serializer.validated_data.get('refresh')

            response = Response({
                "access_token": new_access
            }, status=status.HTTP_200_OK)

            # Update Cookie with rotated Refresh Token if SimpleJWT issued one
            if new_refresh:
                response.set_cookie(
                    key=settings.JWT_COOKIE_NAME,
                    value=new_refresh,
                    httponly=settings.JWT_COOKIE_HTTPONLY,
                    secure=settings.JWT_COOKIE_SECURE,
                    samesite=settings.JWT_COOKIE_SAMESITE,
                    max_age=7 * 24 * 60 * 60
                )
            return response
            
        except Exception:
            return Response({"error": "Invalid or expired refresh token."}, status=status.HTTP_401_UNAUTHORIZED)


from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from .models import Follow
from .serializers import UserUpdateSerializer, ChangePasswordSerializer, ProfilePictureUploadSerializer

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, *args, **kwargs):
        # Determine serializer depending on uploaded files or textual field updates
        if 'profile_picture' in request.FILES or 'cover_photo' in request.FILES:
            serializer = ProfilePictureUploadSerializer(request.user, data=request.data, partial=True)
        else:
            serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PublicProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, username, *args, **kwargs):
        try:
            target_user = User.objects.get(username__iexact=username, is_active=True)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # Enforce block policy: Return 404 if blocked in either direction
        from .models import BlockedUser
        if BlockedUser.objects.filter(
            Q(blocker=request.user, blocked=target_user) |
            Q(blocker=target_user, blocked=request.user)
        ).exists():
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        is_self = (request.user == target_user)
        is_following = False
        if not is_self:
            is_following = Follow.objects.filter(follower=request.user, following=target_user).exists()

        is_accessible = not target_user.is_private or is_self or is_following

        serializer_data = UserSerializer(target_user).data
        serializer_data['is_following'] = is_following
        serializer_data['is_self'] = is_self
        serializer_data['is_accessible'] = is_accessible

        if not is_accessible:
            # Hide sensitive fields for private profile if not followed
            sensitive_fields = ['email', 'phone_number', 'date_of_birth', 'website', 'location']
            for field in sensitive_fields:
                serializer_data[field] = None

        return Response(serializer_data, status=status.HTTP_200_OK)

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = request.user
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            return Response({"message": "Password changed successfully."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user
        # Soft delete: mark user inactive
        user.is_active = False
        user.save()

        # Blacklist refresh token if present to log user out immediately
        refresh_token = request.COOKIES.get(settings.JWT_COOKIE_NAME)
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass

        response = Response({"message": "Account successfully deactivated (soft deleted)."}, status=status.HTTP_200_OK)
        response.delete_cookie(settings.JWT_COOKIE_NAME)
        return response

    def delete(self, request, *args, **kwargs):
        return self.post(request, *args, **kwargs)

class UserSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        query = request.query_params.get('q', '')
        if not query:
            return Response([], status=status.HTTP_200_OK)

        users = User.objects.filter(
            Q(username__icontains=query) | Q(full_name__icontains=query),
            is_active=True
        ).exclude(id=request.user.id)[:20]

        serializer = UserSerializer(users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class UserSuggestionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # Exclude self and already followed users
        followed_ids = Follow.objects.filter(follower=request.user).values_list('following_id', flat=True)
        suggestions = User.objects.filter(
            is_active=True
        ).exclude(
            id=request.user.id
        ).exclude(
            id__in=followed_ids
        ).order_by('-is_verified', '-follower_count')[:5]

        serializer = UserSerializer(suggestions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


from rest_framework.pagination import PageNumberPagination
from .models import FollowRequest, BlockedUser
from .serializers import FollowSerializer, FollowRequestSerializer, BlockedUserSerializer

class FollowView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id, *args, **kwargs):
        try:
            target_user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if request.user == target_user:
            return Response({"error": "You cannot follow yourself."}, status=status.HTTP_400_BAD_REQUEST)

        # Check if blocked
        if BlockedUser.objects.filter(
            Q(blocker=request.user, blocked=target_user) |
            Q(blocker=target_user, blocked=request.user)
        ).exists():
            return Response({"error": "Cannot perform this action."}, status=status.HTTP_400_BAD_REQUEST)

        # Check if already following
        if Follow.objects.filter(follower=request.user, following=target_user).exists():
            return Response({"message": "You are already following this user."}, status=status.HTTP_200_OK)

        # Private Account logic
        if target_user.is_private:
            req, created = FollowRequest.objects.get_or_create(
                requester=request.user,
                receiver=target_user,
                status='pending'
            )
            if created:
                return Response({"message": "Follow request sent."}, status=status.HTTP_201_CREATED)
            return Response({"message": "Follow request already pending."}, status=status.HTTP_200_OK)

        # Public Account logic
        Follow.objects.create(follower=request.user, following=target_user)
        return Response({"message": "Successfully followed user."}, status=status.HTTP_201_CREATED)

class UnfollowView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id, *args, **kwargs):
        try:
            target_user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        deleted_follow, _ = Follow.objects.filter(follower=request.user, following=target_user).delete()
        deleted_request, _ = FollowRequest.objects.filter(requester=request.user, receiver=target_user).delete()

        if deleted_follow or deleted_request:
            return Response({"message": "Successfully unfollowed user."}, status=status.HTTP_200_OK)
        return Response({"message": "You were not following this user."}, status=status.HTTP_200_OK)

class FollowRequestListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        requests = FollowRequest.objects.filter(receiver=request.user, status='pending').order_by('-created_at')
        paginator = PageNumberPagination()
        paginator.page_size = 10
        result_page = paginator.paginate_queryset(requests, request)
        serializer = FollowRequestSerializer(result_page, many=True)
        return paginator.get_paginated_response(serializer.data)

class FollowRequestActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id, *args, **kwargs):
        action = self.kwargs.get('action')
        try:
            req = FollowRequest.objects.get(id=request_id, receiver=request.user, status='pending')
        except FollowRequest.DoesNotExist:
            return Response({"error": "Follow request not found."}, status=status.HTTP_404_NOT_FOUND)

        if action == 'accept':
            # Create Follow relationship
            Follow.objects.get_or_create(follower=req.requester, following=request.user)
            req.delete()
            return Response({"message": "Follow request accepted."}, status=status.HTTP_200_OK)
        elif action == 'reject':
            req.delete()
            return Response({"message": "Follow request rejected."}, status=status.HTTP_200_OK)
        
        return Response({"error": "Invalid action."}, status=status.HTTP_400_BAD_REQUEST)

class FollowerListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id, *args, **kwargs):
        try:
            target_user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # Blocked check
        if BlockedUser.objects.filter(
            Q(blocker=request.user, blocked=target_user) |
            Q(blocker=target_user, blocked=request.user)
        ).exists():
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        followers = Follow.objects.filter(following=target_user).order_by('-created_at')
        paginator = PageNumberPagination()
        paginator.page_size = 20
        result_page = paginator.paginate_queryset(followers, request)
        serializer = FollowSerializer(result_page, many=True)
        return paginator.get_paginated_response(serializer.data)

class FollowingListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id, *args, **kwargs):
        try:
            target_user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # Blocked check
        if BlockedUser.objects.filter(
            Q(blocker=request.user, blocked=target_user) |
            Q(blocker=target_user, blocked=request.user)
        ).exists():
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        following = Follow.objects.filter(follower=target_user).order_by('-created_at')
        paginator = PageNumberPagination()
        paginator.page_size = 20
        result_page = paginator.paginate_queryset(following, request)
        serializer = FollowSerializer(result_page, many=True)
        return paginator.get_paginated_response(serializer.data)

class BlockUserView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id, *args, **kwargs):
        try:
            target_user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if request.user == target_user:
            return Response({"error": "You cannot block yourself."}, status=status.HTTP_400_BAD_REQUEST)

        # Create Block relationship
        BlockedUser.objects.get_or_create(blocker=request.user, blocked=target_user)

        # Break follows both ways
        Follow.objects.filter(follower=request.user, following=target_user).delete()
        Follow.objects.filter(follower=target_user, following=request.user).delete()

        # Delete pending requests both ways
        FollowRequest.objects.filter(requester=request.user, receiver=target_user).delete()
        FollowRequest.objects.filter(requester=target_user, receiver=request.user).delete()

        return Response({"message": "User blocked successfully."}, status=status.HTTP_200_OK)

class UnblockUserView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id, *args, **kwargs):
        try:
            target_user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        deleted, _ = BlockedUser.objects.filter(blocker=request.user, blocked=target_user).delete()
        if deleted:
            return Response({"message": "User unblocked successfully."}, status=status.HTTP_200_OK)
        return Response({"message": "You had not blocked this user."}, status=status.HTTP_200_OK)

class BlockedUserListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        blocked = BlockedUser.objects.filter(blocker=request.user).order_by('-created_at')
        paginator = PageNumberPagination()
        paginator.page_size = 20
        result_page = paginator.paginate_queryset(blocked, request)
        serializer = BlockedUserSerializer(result_page, many=True)
        return paginator.get_paginated_response(serializer.data)


