from rest_framework import viewsets, permissions
from apps.organizations.models import Organization
from apps.organizations.serializers import OrganizationSerializer
from apps.authentication.rbac import HasGranularPermission
from apps.audit.models import AuditLog

class OrganizationViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for managing Organizations.
    """
    queryset = Organization.objects.all().order_by('name')
    serializer_class = OrganizationSerializer
    permission_classes = [permissions.IsAuthenticated, HasGranularPermission]
    required_permission = 'orgs:manage'

    def get_permissions(self):
        # Allow read access to all authenticated users (needed to select organization in Password Vault create/edit)
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    def perform_create(self, serializer):
        instance = serializer.save()
        self._log_audit('org_create', {
            'org_id': str(instance.id),
            'name': instance.name,
        })

    def perform_update(self, serializer):
        instance = serializer.save()
        self._log_audit('org_update', {
            'org_id': str(instance.id),
            'name': instance.name,
            'fields_changed': list(self.request.data.keys()),
        })

    def perform_destroy(self, instance):
        self._log_audit('org_delete', {
            'org_id': str(instance.id),
            'name': instance.name,
        })
        instance.delete()

    def _log_audit(self, action, details):
        ip = getattr(self.request, 'client_ip', '0.0.0.0')
        ua = getattr(self.request, 'user_agent', 'system')[:512]
        AuditLog.objects.create(
            user=self.request.user,
            username_display=self.request.user.username,
            action=action,
            module='organizations',
            ip_address=ip,
            user_agent=ua,
            details=details
        )
