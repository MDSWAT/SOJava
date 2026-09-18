from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.virtual_ecc.views import VirtualECCViewSet, RaionViewSet

router = DefaultRouter()
router.register(r'ecc', VirtualECCViewSet, basename='virtual-ecc')
router.register(r'raioane', RaionViewSet, basename='raion')

urlpatterns = [
    path('', include(router.urls)),
]
