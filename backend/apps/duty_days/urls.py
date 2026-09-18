from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.duty_days.views import (
    CalendarEventViewSet,
    SaturdayDutyViewSet,
    LeaveRequestViewSet,
    MyBalanceView,
    TakeFreeDayView,
    AllBalancesView,
    AdjustBalanceView,
    MarkAbsentView,
    ActivityLogsView,
    ActivityLogsExportView,
    UserDetailView,
    UserReportView,
    UserReportExportView,
    AllUsersReportExportView,
)

router = DefaultRouter()
router.register('events', CalendarEventViewSet, basename='calendar-events')
router.register('saturdays', SaturdayDutyViewSet, basename='saturdays')
router.register('leaves', LeaveRequestViewSet, basename='leaves')

urlpatterns = [
    # Calendar events, Saturdays & Leaves (via router)
    path('', include(router.urls)),

    # Balance
    path('balance/me/', MyBalanceView.as_view(), name='my-balance'),
    path('balance/take-free-day/', TakeFreeDayView.as_view(), name='take-free-day'),
    path('balance/all/', AllBalancesView.as_view(), name='all-balances'),
    path('balance/adjust/', AdjustBalanceView.as_view(), name='adjust-balance'),
    path('balance/mark-absent/', MarkAbsentView.as_view(), name='mark-absent'),

    # Activity logs & export
    path('logs/', ActivityLogsView.as_view(), name='activity-logs'),
    path('logs/export/', ActivityLogsExportView.as_view(), name='activity-logs-export'),

    # Admin: Reports & Detail
    path('users/<uuid:user_id>/detail/', UserDetailView.as_view(), name='user-detail'),
    path('users/<uuid:user_id>/report/', UserReportView.as_view(), name='user-report'),
    path('users/<uuid:user_id>/report/export/', UserReportExportView.as_view(), name='user-report-export'),
    path('reports/all-users/export/', AllUsersReportExportView.as_view(), name='all-users-report-export'),
]
