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
        ip = getattr(request, 'client_ip', request.META.get('REMOTE_ADDR', '0.0.0.0'))
        ua = getattr(request, 'user_agent', request.META.get('HTTP_USER_AGENT', 'unknown'))[:512]
        username = request.data.get('username', 'unknown')
        if response.status_code == 200:
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
        else:
            AuditLog.objects.create(
                user=None,
                username_display=username,
                action='login_failed',
                module='auth',
                ip_address=ip,
                user_agent=ua,
                details={'method': 'jwt', 'reason': 'invalid_credentials'}
            )
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

    def _log_audit(self, action, details):
        ip = getattr(self.request, 'client_ip', '0.0.0.0')
        ua = getattr(self.request, 'user_agent', 'system')[:512]
        AuditLog.objects.create(
            user=self.request.user,
            username_display=self.request.user.username,
            action=action,
            module='auth',
            ip_address=ip,
            user_agent=ua,
            details=details
        )

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

        self._log_audit('user_create', {
            'created_user': user.username,
            'email': user.email,
            'role': role.name if role else None,
        })
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
        self._log_audit('user_update', {
            'updated_user': instance.username,
            'fields_changed': list(request.data.keys()),
        })
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
            self._log_audit('user_delete', {
                'deleted_user': user_to_delete.username,
                'mode': 'hard_delete',
            })
            user_to_delete.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        # Soft delete — dezactivare
        self._log_audit('user_deactivate', {
            'deactivated_user': user_to_delete.username,
            'mode': 'soft_delete',
        })
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

    def create(self, request, *args, **kwargs):
        """Allow creating role with permissions."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()

        permission_ids = request.data.get('permission_ids', None)
        if permission_ids is not None:
            perms = Permission.objects.filter(id__in=permission_ids)
            instance.permissions.set(perms)

        self._log_audit('role_create', {
            'role_name': instance.name,
            'permissions_count': len(permission_ids) if permission_ids else 0,
        })
        return Response(RoleSerializer(instance).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.is_system:
            return Response(
                {"detail": "Rolurile de sistem nu pot fi șterse."},
                status=status.HTTP_400_BAD_REQUEST
            )
        self._log_audit('role_delete', {'role_name': role.name})
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
        self._log_audit('role_update', {
            'role_name': instance.name,
            'fields_changed': list(request.data.keys()),
        })
        return Response(RoleSerializer(instance).data)

    def _log_audit(self, action, details):
        ip = getattr(self.request, 'client_ip', '0.0.0.0')
        ua = getattr(self.request, 'user_agent', 'system')[:512]
        AuditLog.objects.create(
            user=self.request.user,
            username_display=self.request.user.username,
            action=action,
            module='auth',
            ip_address=ip,
            user_agent=ua,
            details=details
        )


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset listing all granular permissions.
    """
    queryset = Permission.objects.all().order_by('module', 'code')
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated]


class DashboardStatsView(APIView):
    """
    Returns aggregated live statistics across all platform modules for the main Dashboard.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Count
        from django.utils import timezone
        from datetime import timedelta

        today = timezone.localdate()
        user = request.user

        # 1. Users count
        from apps.authentication.models import User
        total_users = User.objects.count()
        active_users = User.objects.filter(is_active=True).count()

        # 2. Vault counts
        from apps.vault.models import PasswordVault
        from apps.personal_vault.models import PersonalVault
        vault_count = PasswordVault.objects.count()
        personal_count = PersonalVault.objects.filter(user=user).count()

        # 3. Virtual ECC
        from apps.virtual_ecc.models import VirtualECC
        ecc_total = VirtualECC.objects.count()
        ecc_status_counts = dict(VirtualECC.objects.values_list('status').annotate(c=Count('id')))
        ecc_with_ip = VirtualECC.objects.exclude(ip_adresa__isnull=True).exclude(ip_adresa__exact='').count()
        ecc_with_mev = VirtualECC.objects.exclude(encrypted_mev_key__isnull=True).exclude(encrypted_mev_key__exact='').count()
        ecc_z_raport = VirtualECC.objects.filter(z_raport=True).count()

        # 4. Posta Contacts
        from apps.posta_contacts.models import Raion, ContactOficiu
        raioane_count = Raion.objects.count()
        contacts_total = ContactOficiu.objects.count()
        contacts_by_tip = dict(ContactOficiu.objects.values_list('tip').annotate(c=Count('id')))

        # 5. Duty Days & Leaves
        from apps.duty_days.models import SaturdayDuty, LeaveRequest
        next_duty_obj = SaturdayDuty.objects.filter(date__gte=today).order_by('date').first()
        next_duty = None
        if next_duty_obj:
            booked_user = next_duty_obj.booked_by
            next_duty = {
                'date': next_duty_obj.date.isoformat(),
                'user_name': booked_user.get_full_name() or booked_user.username if booked_user else 'Disponibilă (Nerezervată)',
                'is_booked': next_duty_obj.is_booked,
                'label': next_duty_obj.label or 'Sâmbătă de serviciu',
            }
        active_leaves_today = LeaveRequest.objects.filter(
            start_date__lte=today, end_date__gte=today, status='approved'
        ).count()
        upcoming_leaves_count = LeaveRequest.objects.filter(
            start_date__gt=today, start_date__lte=today + timedelta(days=30), status='approved'
        ).count()

        # 6. Inventory
        from apps.inventory.models import InventoryItem
        inventory_total = InventoryItem.objects.count()

        # 7. Real Activity Analytics (last 7 days)
        from apps.audit.models import AuditLog
        day_names_ro = {0: 'Lun', 1: 'Mar', 2: 'Mie', 3: 'Joi', 4: 'Vin', 5: 'Sâm', 6: 'Dum'}
        seven_days_ago = today - timedelta(days=6)

        recent_week_logs = AuditLog.objects.filter(
            created_at__date__gte=seven_days_ago
        ).values('created_at__date', 'action')

        daily_stats = {}
        for i in range(7):
            d = seven_days_ago + timedelta(days=i)
            iso_d = d.isoformat()
            daily_stats[iso_d] = {
                'date': iso_d,
                'name': day_names_ro[d.weekday()],
                'reveals': 0,
                'copies': 0,
                'updates': 0,
                'logins': 0,
                'total': 0
            }

        for log in recent_week_logs:
            d_str = log['created_at__date'].isoformat()
            if d_str in daily_stats:
                act = log['action'].lower()
                daily_stats[d_str]['total'] += 1
                if 'reveal' in act or 'view' in act:
                    daily_stats[d_str]['reveals'] += 1
                elif 'copy' in act:
                    daily_stats[d_str]['copies'] += 1
                elif 'update' in act or 'edit' in act or 'patch' in act:
                    daily_stats[d_str]['updates'] += 1
                elif 'login' in act:
                    daily_stats[d_str]['logins'] += 1

        chart_data = list(daily_stats.values())

        # 8. Recent platform audit logs (top 6)
        recent_audit_qs = AuditLog.objects.exclude(module='personal_vault').order_by('-created_at')[:6]
        recent_logs = []
        for l in recent_audit_qs:
            recent_logs.append({
                'id': str(l.id),
                'username_display': l.username_display,
                'action': l.action,
                'module': l.module,
                'details': l.details,
                'created_at': l.created_at.isoformat(),
            })

        return Response({
            'users': {
                'total': total_users,
                'active': active_users,
            },
            'vault': {
                'shared_count': vault_count,
                'personal_count': personal_count,
            },
            'virtual_ecc': {
                'total': ecc_total,
                'by_status': {
                    'pus_in_exploatare': ecc_status_counts.get('pus_in_exploatare', 0),
                    'neconfigurat': ecc_status_counts.get('neconfigurat', 0),
                    'certificat': ecc_status_counts.get('certificat', 0),
                    'in_certificare': ecc_status_counts.get('in_certificare', 0),
                    'eroare_certificare': ecc_status_counts.get('eroare_certificare', 0),
                    'aplicatie_instalata': ecc_status_counts.get('aplicatie_instalata', 0),
                },
                'with_ip': ecc_with_ip,
                'without_ip': ecc_total - ecc_with_ip,
                'with_mev': ecc_with_mev,
                'without_mev': ecc_total - ecc_with_mev,
                'z_raport_count': ecc_z_raport,
            },
            'posta_contacts': {
                'total_contacts': contacts_total,
                'total_raioane': raioane_count,
                'ingineri_count': contacts_by_tip.get('inginer', 0),
                'oficii_count': contacts_by_tip.get('oficiu', 0),
            },
            'duty_days': {
                'next_duty': next_duty,
                'active_leaves_today': active_leaves_today,
                'upcoming_leaves_count': upcoming_leaves_count,
            },
            'inventory': {
                'total_items': inventory_total,
            },
            'chart_data': chart_data,
            'recent_logs': recent_logs,
        })
