from rest_framework import serializers, viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.db.models import Q

from apps.authentication.models import Role, Permission
from apps.authentication.serializers import UserSerializer, RoleSerializer, PermissionSerializer
from apps.authentication.rbac import HasGranularPermission
from apps.audit.models import AuditLog

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT serializer that adds full user profile details to the login response.
    Also logs the login event to audit trail.
    """
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Restrict local (non-AD) login strictly to Django superusers
        if not self.user.is_ad_synced and not self.user.is_superuser:
            raise serializers.ValidationError(
                "Conectarea locală este permisă doar pentru conturile de Super Admin."
            )
            
        serializer = UserSerializer(self.user)
        data['user'] = serializer.data
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            # Log successful login to audit
            ip = getattr(request, 'client_ip', request.META.get('REMOTE_ADDR', '0.0.0.0'))
            ua = getattr(request, 'user_agent', request.META.get('HTTP_USER_AGENT', 'unknown'))[:512]
            username = request.data.get('username', 'unknown')
            try:
                user = User.objects.get(username=username)
                AuditLog.objects.create(
                    user=user,
                    username_display=username,
                    action='login_success',
                    module='auth',
                    ip_address=ip,
                    user_agent=ua,
                    details={'method': 'jwt'}
                )
            except User.DoesNotExist:
                pass
        return response


class CurrentUserView(APIView):
    """
    API endpoint to return the currently authenticated user's profile.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class UserViewSet(viewsets.ModelViewSet):
    """
    CRUD endpoint for managing platform users.
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, HasGranularPermission]
    required_permission = 'users:manage'

    def get_queryset(self):
        queryset = User.objects.all().select_related('role').order_by('-created_at')

        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )

        role_filter = self.request.query_params.get('role', None)
        if role_filter:
            queryset = queryset.filter(role__name=role_filter)

        return queryset

    def create(self, request, *args, **kwargs):
        """Create user with password support."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Handle password
        password = request.data.get('password')
        role_id = request.data.get('role_id')

        try:
            role = Role.objects.get(id=role_id)
        except Role.DoesNotExist:
            return Response({'detail': 'Rolul specificat nu există.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=request.data.get('username'),
            email=request.data.get('email'),
            password=password,
            role=role,
            first_name=request.data.get('first_name', ''),
            last_name=request.data.get('last_name', ''),
            is_ad_synced=False
        )

        custom_permission_codes = request.data.get('custom_permission_codes', [])
        if custom_permission_codes:
            perms = Permission.objects.filter(code__in=custom_permission_codes)
            user.custom_permissions.set(perms)

        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """Update user, optionally changing password and role."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        # Update role if provided
        role_id = request.data.get('role_id')
        if role_id:
            try:
                instance.role = Role.objects.get(id=role_id)
            except Role.DoesNotExist:
                return Response({'detail': 'Rolul nu există.'}, status=status.HTTP_400_BAD_REQUEST)

        # Update password if provided
        password = request.data.get('password')
        if password:
            instance.set_password(password)

        # Update other fields
        for field in ['first_name', 'last_name', 'email', 'is_active']:
            if field in request.data:
                setattr(instance, field, request.data[field])

        # Update custom permissions if provided
        if 'custom_permission_codes' in request.data:
            custom_permission_codes = request.data.get('custom_permission_codes', [])
            perms = Permission.objects.filter(code__in=custom_permission_codes)
            instance.custom_permissions.set(perms)

        instance.save()
        return Response(UserSerializer(instance).data)

    def destroy(self, request, *args, **kwargs):
        user_to_delete = self.get_object()
        if user_to_delete.id == request.user.id:
            return Response(
                {"detail": "Nu vă puteți șterge propriul cont."},
                status=status.HTTP_400_BAD_REQUEST
            )
        # Hard delete for Super Admin
        if request.user.is_superuser or (request.user.role and request.user.role.name == 'Super Admin'):
            user_to_delete.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        # Soft delete — dezactivare
        user_to_delete.is_active = False
        user_to_delete.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RoleViewSet(viewsets.ModelViewSet):
    """
    CRUD endpoint for managing system roles.
    """
    queryset = Role.objects.all().prefetch_related('permissions').order_by('name')
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated, HasGranularPermission]
    required_permission = 'roles:manage'

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.is_system:
            return Response(
                {"detail": "Rolurile de sistem nu pot fi șterse."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        """Allow updating role permissions."""
        instance = self.get_object()
        permission_ids = request.data.get('permission_ids', None)

        if permission_ids is not None:
            perms = Permission.objects.filter(id__in=permission_ids)
            instance.permissions.set(perms)

        # Update other fields
        if 'name' in request.data and not instance.is_system:
            instance.name = request.data['name']
        if 'description' in request.data:
            instance.description = request.data['description']

        instance.save()
        return Response(RoleSerializer(instance).data)


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset listing all granular permissions.
    """
    queryset = Permission.objects.all().order_by('module', 'code')
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated]
