from rest_framework.permissions import BasePermission


class HasGranularPermission(BasePermission):
    """
    Granular permission check that verifies the user has the required permission
    defined on the ViewSet via `required_permission` class attribute.

    Usage in ViewSet:
        permission_classes = [IsAuthenticated, HasGranularPermission]
        required_permission = 'vault:view'
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if not request.user.is_active:
            return False

        # Super Admin always passes
        if request.user.role.name == 'Super Admin':
            return True

        # Get the required permission from the view
        perm_code = getattr(view, 'required_permission', None)
        if perm_code is None:
            # If no permission required, allow authenticated users
            return True

        return request.user.has_permission(perm_code)

    def has_object_permission(self, request, view, obj):
        """Same check at object level for full security."""
        return self.has_permission(request, view)
