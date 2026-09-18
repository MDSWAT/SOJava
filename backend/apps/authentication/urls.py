from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from apps.authentication.views import (
    CustomTokenObtainPairView,
    CurrentUserView,
    UserViewSet,
    RoleViewSet,
    PermissionViewSet,
    DashboardStatsView
)

router = DefaultRouter()
router.register('users', UserViewSet, basename='users')
router.register('roles', RoleViewSet, basename='roles')
router.register('permissions', PermissionViewSet, basename='permissions')

urlpatterns = [
    # Credentials & Tokens
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Active Session User info
    path('me/', CurrentUserView.as_view(), name='current_user'),

    # Centralized Dashboard Stats
    path('dashboard-stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    
    # REST API resources
    path('', include(router.urls)),
]
