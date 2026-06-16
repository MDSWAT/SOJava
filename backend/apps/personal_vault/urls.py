from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.personal_vault.views import PersonalVaultViewSet

router = DefaultRouter()
router.register('', PersonalVaultViewSet, basename='personal-vault')

urlpatterns = [
    path('', include(router.urls)),
]
