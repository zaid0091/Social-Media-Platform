from django.urls import path
from .views import (
    RegisterView, VerifyEmailView, LoginView, 
    LogoutView, CookieTokenRefreshView,
    UserProfileView, PublicProfileView, ChangePasswordView,
    DeleteAccountView, UserSearchView, UserSuggestionView,
    FollowView, UnfollowView, FollowRequestListView, FollowRequestActionView,
    FollowerListView, FollowingListView, BlockUserView, UnblockUserView, BlockedUserListView,
    GetUserPresenceView, PasswordResetRequestView, PasswordResetConfirmView,
    DiscoverSuggestionsView, RestrictUserView, UnrestrictUserView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('verify-email/', VerifyEmailView.as_view(), name='verify-email'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('token/refresh/', CookieTokenRefreshView.as_view(), name='token-refresh'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    
    # User Profile management endpoints
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('profile/<str:username>/', PublicProfileView.as_view(), name='public-profile'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('delete-account/', DeleteAccountView.as_view(), name='delete-account'),
    path('search/', UserSearchView.as_view(), name='user-search'),
    path('suggestions/', UserSuggestionView.as_view(), name='user-suggestions'),
    path('suggestions/discover/', DiscoverSuggestionsView.as_view(), name='discover-suggestions'),

    # Follow / Block System endpoints
    path('follow/<uuid:user_id>/', FollowView.as_view(), name='follow'),
    path('unfollow/<uuid:user_id>/', UnfollowView.as_view(), name='unfollow'),
    path('follow-requests/', FollowRequestListView.as_view(), name='follow-request-list'),
    path('follow-requests/<int:request_id>/accept/', FollowRequestActionView.as_view(), {'action': 'accept'}, name='follow-request-accept'),
    path('follow-requests/<int:request_id>/reject/', FollowRequestActionView.as_view(), {'action': 'reject'}, name='follow-request-reject'),
    path('<uuid:user_id>/followers/', FollowerListView.as_view(), name='followers-list'),
    path('<uuid:user_id>/following/', FollowingListView.as_view(), name='following-list'),
    path('block/<uuid:user_id>/', BlockUserView.as_view(), name='block-user'),
    path('unblock/<uuid:user_id>/', UnblockUserView.as_view(), name='unblock-user'),
    path('blocks/', BlockedUserListView.as_view(), name='blocked-users-list'),
    path('presence/<uuid:user_id>/', GetUserPresenceView.as_view(), name='user-presence'),
    path('restrict/<uuid:user_id>/', RestrictUserView.as_view(), name='restrict-user'),
    path('unrestrict/<uuid:user_id>/', UnrestrictUserView.as_view(), name='unrestrict-user'),
]

from posts.views import UserPostListView
urlpatterns += [
    path('<uuid:user_id>/posts/', UserPostListView.as_view(), name='user-posts-list-under-users'),
]



