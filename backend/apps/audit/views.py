from rest_framework import viewsets, permissions
from rest_framework.response import Response
from django.db.models import Q
from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer
from apps.authentication.rbac import HasGranularPermission

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for auditing system-wide operations.
    Restricted to users with 'audit:view' granular permission or Super Admin.
    """
    queryset = AuditLog.objects.all().order_by('-created_at')
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, HasGranularPermission]
    required_permission = 'audit:view'

    def get_queryset(self):
        queryset = AuditLog.objects.exclude(module='personal_vault').order_by('-created_at')
        
        # 1. Advanced Search (searches in username, actions, modules)
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(username_display__icontains=search) |
                Q(action__icontains=search) |
                Q(module__icontains=search) |
                Q(ip_address__icontains=search)
            )

        # 2. Specific field filters
        module_filter = self.request.query_params.get('module', None)
        if module_filter:
            queryset = queryset.filter(module=module_filter)

        action_filter = self.request.query_params.get('action', None)
        if action_filter:
            queryset = queryset.filter(action=action_filter)

        user_filter = self.request.query_params.get('user', None)
        if user_filter:
            queryset = queryset.filter(username_display=user_filter)

        # 3. Date Filters (range)
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)

        return queryset
