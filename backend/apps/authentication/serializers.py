from rest_framework import serializers
from django.contrib.auth import get_user_model
from apps.authentication.models import Role, Permission

User = get_user_model()


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'code', 'module', 'description']


class RoleSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)
    users_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'is_system', 'permissions', 'users_count']

    def get_users_count(self, obj):
        return obj.users.filter(is_active=True).count()


class RoleMinimalSerializer(serializers.ModelSerializer):
    """Minimal role data for user list views."""
    class Meta:
        model = Role
        fields = ['id', 'name']


class UserSerializer(serializers.ModelSerializer):
    role_detail = RoleMinimalSerializer(source='role', read_only=True)
    custom_permissions = PermissionSerializer(many=True, read_only=True)
    full_name = serializers.SerializerMethodField(read_only=True)
    created_at_formatted = serializers.DateTimeField(
        source='created_at', format='%d.%m.%Y %H:%M', read_only=True
    )
    updated_at_formatted = serializers.DateTimeField(
        source='updated_at', format='%d.%m.%Y %H:%M', read_only=True
    )

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'role_detail',
            'custom_permissions',
            'is_active',
            'is_ad_synced',
            'last_sync_at',
            'created_at_formatted',
            'updated_at_formatted',
        ]
        read_only_fields = ['id', 'is_ad_synced', 'last_sync_at', 'created_at_formatted', 'updated_at_formatted']

    def get_full_name(self, obj):
        full = f"{obj.first_name} {obj.last_name}".strip()
        return full if full else obj.username
