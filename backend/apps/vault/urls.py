from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.vault.views import PasswordVaultViewSet

router = DefaultRouter()
router.register('', PasswordVaultViewSet, basename='password-vault')

urlpatterns = [
    path('', include(router.urls)),
]
