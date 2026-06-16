from django.contrib import admin
from django.urls import path, include
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

schema_view = get_schema_view(
    openapi.Info(
        title="Corporatia SIDESI API",
        default_version='v1',
        description="Portal Enterprise și Sistem Centralizat de Parole Securizat SIDESI",
        contact=openapi.Contact(email="contact@posta.md"),
        license=openapi.License(name="Proprietary License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    # Admin Interface
    path('admin/', admin.site.urls),
    
    # Swagger & Redoc Schema Documentation
    path('swagger<format>/', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    
    # Versioned Module APIs
    path('api/v1/auth/', include('apps.authentication.urls')),
    path('api/v1/organizations/', include('apps.organizations.urls')),
    path('api/v1/vault/', include('apps.vault.urls')),
    path('api/v1/personal-vault/', include('apps.personal_vault.urls')),
    path('api/v1/audit-logs/', include('apps.audit.urls')),
    path('api/v1/duty-days/', include('apps.duty_days.urls')),
]
