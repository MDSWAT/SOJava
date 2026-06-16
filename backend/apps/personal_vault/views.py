from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from apps.personal_vault.models import PersonalVault
from apps.personal_vault.serializers import PersonalVaultSerializer
from apps.audit.models import AuditLog


class PersonalVaultViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing user-specific personal passwords and safe notes.
    Queries are strictly sandboxed to request.user to preserve privacy.
    No admin can list or access another user's personal vault.
    """
    serializer_class = PersonalVaultSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Critical: Queries are strictly sandboxed to request.user to preserve privacy.
        No admin/super admin can list or access another user's personal vault.
        """
        user = self.request.user
        queryset = PersonalVault.objects.filter(user=user).select_related('user').order_by('-is_favorite', '-created_at')

        # Filters: Search
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(login_username__icontains=search) |
                Q(url__icontains=search) |
                Q(notes__icontains=search)
            )

        # Filters: Category
        category = self.request.query_params.get('category', None)
        if category:
            queryset = queryset.filter(category=category)

        # Filters: Favorites only
        favorites_only = self.request.query_params.get('favorites', None)
        if favorites_only == 'true':
            queryset = queryset.filter(is_favorite=True)

        return queryset

    def get_serializer_context(self):
        """Pass request to serializer context for user assignment."""
        return {'request': self.request, 'format': self.format_kwarg, 'view': self}

    def perform_create(self, serializer):
        vault_item = serializer.save(user=self.request.user)
        self._log_personal_audit(
            action='personal_create',
            instance=vault_item
        )

    def perform_update(self, serializer):
        vault_item = serializer.save()
        self._log_personal_audit(
            action='personal_update',
            instance=vault_item
        )

    def perform_destroy(self, instance):
        self._log_personal_audit(
            action='personal_delete',
            instance=instance
        )
        instance.delete()

    @action(detail=True, methods=['get'], url_path='reveal')
    def reveal_password(self, request, pk=None):
        """Reveal personal credential's plain-text password. Requires ownership (enforced via get_queryset)."""
        instance = self.get_object()
        plain_password = instance.get_password()

        self._log_personal_audit(
            action='personal_reveal',
            instance=instance
        )
        return Response({"password": plain_password})

    @action(detail=True, methods=['get'], url_path='copy')
    def copy_password(self, request, pk=None):
        """Return plain-text password for clipboard copy action."""
        instance = self.get_object()
        plain_password = instance.get_password()

        self._log_personal_audit(
            action='personal_copy',
            instance=instance
        )
        return Response({"password": plain_password})

    @action(detail=True, methods=['patch'], url_path='toggle-favorite')
    def toggle_favorite(self, request, pk=None):
        """Toggle the favorite status of a personal vault item."""
        instance = self.get_object()
        instance.is_favorite = not instance.is_favorite
        instance.save(update_fields=['is_favorite'])
        return Response({'is_favorite': instance.is_favorite})

    def _log_personal_audit(self, action, instance):
        """Helper to create audit records for personal vault operations. Disabled for privacy."""
        pass
