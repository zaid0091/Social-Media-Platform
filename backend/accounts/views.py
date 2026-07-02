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
