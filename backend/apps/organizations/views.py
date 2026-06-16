from rest_framework import viewsets, permissions
from apps.organizations.models import Organization
from apps.organizations.serializers import OrganizationSerializer
from apps.authentication.rbac import HasGranularPermission

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
