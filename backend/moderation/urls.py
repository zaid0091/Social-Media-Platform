from django.urls import path
from .views import (
    ReportCreateView,
    AdminModerationView,
    AdminReportResolveView,
    ContentHideView,
    UserSuspendView,
    UserBanView,
    UserWarnView
)

urlpatterns = [
    path('reports/create/', ReportCreateView.as_view(), name='report-create'),
    path('admin/reports/', AdminModerationView.as_view(), name='admin-reports'),
    path('admin/reports/<uuid:report_id>/resolve/', AdminReportResolveView.as_view(), name='admin-report-resolve'),
    path('admin/content/hide/', ContentHideView.as_view(), name='admin-content-hide'),
    path('admin/users/suspend/', UserSuspendView.as_view(), name='admin-user-suspend'),
    path('admin/users/ban/', UserBanView.as_view(), name='admin-user-ban'),
    path('admin/users/warn/', UserWarnView.as_view(), name='admin-user-warn'),
]
