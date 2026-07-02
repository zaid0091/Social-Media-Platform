from django.urls import path
from .views import (
    RegisterView, VerifyEmailView, LoginView, 
    LogoutView, CookieTokenRefreshView,
    UserProfileView, PublicProfileView, ChangePasswordView,
    DeleteAccountView, UserSearchView, UserSuggestionView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('verify-email/', VerifyEmailView.as_view(), name='verify-email'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('token/refresh/', CookieTokenRefreshView.as_view(), name='token-refresh'),
    
    # User Profile management endpoints
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('profile/<str:username>/', PublicProfileView.as_view(), name='public-profile'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('delete-account/', DeleteAccountView.as_view(), name='delete-account'),
    path('search/', UserSearchView.as_view(), name='user-search'),
    path('suggestions/', UserSuggestionView.as_view(), name='user-suggestions'),
]

