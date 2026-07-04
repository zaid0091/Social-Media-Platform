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

            # Dispatch confirmation email asynchronously using celery and template
            from django.template.loader import render_to_string
            from notifications.tasks import send_async_email

            html_content = render_to_string("emails/verification.html", {
                "username": user.username,
                "verify_url": verify_url
            })
            send_async_email.delay(
                subject="Verify Your Social Media Platform Account",
                html_content=html_content,
                recipient_list=[user.email]
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

            # Send welcome email asynchronously using celery
            from django.template.loader import render_to_string
            from notifications.tasks import send_async_email

            html_content = render_to_string("emails/welcome.html", {
                "username": user.username
            })
            send_async_email.delay(
                subject="Welcome to Social Media Platform!",
                html_content=html_content,
                recipient_list=[user.email]
            )

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
            # Check if user is banned
            if user.is_banned:
                return Response({"error": "Your account has been permanently banned."}, status=status.HTTP_403_FORBIDDEN)

            # Check if user is suspended
            if user.is_suspended:
                from django.utils import timezone
                if user.suspension_expires_at and user.suspension_expires_at > timezone.now():
                    expires_str = user.suspension_expires_at.strftime("%Y-%m-%d %H:%M:%S UTC")
                    return Response({"error": f"Your account is suspended until {expires_str}."}, status=status.HTTP_403_FORBIDDEN)
                else:
                    # Suspension has expired, lift it automatically
                    user.is_suspended = False
                    user.suspension_expires_at = None
                    user.save(update_fields=['is_suspended', 'suspension_expires_at'])

            if not user.is_active:
                return Response({"error": "Please verify your email before logging in."}, status=status.HTTP_400_BAD_REQUEST)

            # Get user agent and IP address
            user_agent = request.META.get('HTTP_USER_AGENT', '')
            ip_address = request.META.get('REMOTE_ADDR', '')

            # Check if this device is already registered for the user
            from .models import UserDevice
            device_exists = UserDevice.objects.filter(
                user=user,
                user_agent=user_agent
            ).exists()

            if not device_exists:
                # Log the device
                UserDevice.objects.create(
                    user=user,
                    user_agent=user_agent,
                    ip_address=ip_address
                )

                # Send security alert email asynchronously using celery and template
                from django.template.loader import render_to_string
                from notifications.tasks import send_async_email
                from django.utils import timezone

                login_time = timezone.now().strftime("%Y-%m-%d %H:%M:%S UTC")
                html_content = render_to_string("emails/security_alert.html", {
                    "username": user.username,
                    "user_agent": user_agent,
                    "ip_address": ip_address,
                    "login_time": login_time
                })
                send_async_email.delay(
                    subject="Security Alert: New Device Login Detected",
                    html_content=html_content,
                    recipient_list=[user.email]
                )

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
        follow_request_pending = False
        if not is_self:
            is_following = Follow.objects.filter(follower=request.user, following=target_user).exists()
            if not is_following and target_user.is_private:
                follow_request_pending = FollowRequest.objects.filter(
                    requester=request.user, receiver=target_user, status='pending'
                ).exists()

        is_accessible = not target_user.is_private or is_self or is_following

        serializer_data = UserSerializer(target_user).data
        serializer_data['is_following'] = is_following
        serializer_data['is_self'] = is_self
        serializer_data['is_accessible'] = is_accessible
        serializer_data['follow_request_pending'] = follow_request_pending

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


from django.shortcuts import get_object_or_404
from django_redis import get_redis_connection

class GetUserPresenceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id, *args, **kwargs):
        target_user = get_object_or_404(User, id=user_id, is_active=True)
        redis_client = get_redis_connection("default")
        is_online = redis_client.exists(f"presence_user_{target_user.id}") > 0
        return Response({
            "user_id": str(target_user.id),
            "is_online": is_online,
            "last_seen": target_user.last_seen
        }, status=status.HTTP_200_OK)


from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str

class PasswordResetRequestView(APIView):
    permission_classes = []  # AllowAny

    def post(self, request, *args, **kwargs):
        email = request.data.get('email')
        if not email:
            return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email__iexact=email, is_active=True)
            
            # Generate token and encoded user ID
            token = default_token_generator.make_token(user)
            uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
            
            # Build reset confirmation URL
            reset_url = request.build_absolute_uri(
                reverse('password-reset-confirm') + f"?uidb64={uidb64}&token={token}"
            )
            
            # Send password reset email asynchronously
            from django.template.loader import render_to_string
            from notifications.tasks import send_async_email
            
            html_content = render_to_string("emails/password_reset.html", {
                "username": user.username,
                "reset_url": reset_url
            })
            send_async_email.delay(
                subject="Password Reset Request",
                html_content=html_content,
                recipient_list=[user.email]
            )
        except User.DoesNotExist:
            pass

        return Response({
            "message": "If an account exists with this email, a password reset link has been sent."
        }, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    permission_classes = []  # AllowAny

    def post(self, request, *args, **kwargs):
        uidb64 = request.data.get('uidb64') or request.query_params.get('uidb64')
        token = request.data.get('token') or request.query_params.get('token')
        new_password = request.data.get('new_password')

        if not uidb64 or not token or not new_password:
            return Response({"error": "uidb64, token, and new_password are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid, is_active=True)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({"error": "Invalid or expired reset link."}, status=status.HTTP_400_BAD_REQUEST)

        if default_token_generator.check_token(user, token):
            user.set_password(new_password)
            user.save()
            return Response({"message": "Password has been reset successfully."}, status=status.HTTP_200_OK)
        else:
            return Response({"error": "Invalid or expired reset link."}, status=status.HTTP_400_BAD_REQUEST)




