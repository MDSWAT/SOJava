from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.posta_contacts.views import RaionViewSet, ContactOficiuViewSet

router = DefaultRouter()
router.register(r'raioane', RaionViewSet, basename='raion')
router.register(r'contacts', ContactOficiuViewSet, basename='contact')

urlpatterns = [
    path('', include(router.urls)),
]
