import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager


class Permission(models.Model):
    """
    Granular permission nodes at module/action level.
    Examples: vault:view, vault:reveal, vault:copy, users:manage
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=100, unique=True, db_index=True)
    module = models.CharField(max_length=100, db_index=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['module', 'code']

    def __str__(self):
        return f"{self.module}:{self.code}"


class Role(models.Model):
    """
    User roles with a set of granular permissions.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True, db_index=True)
    description = models.TextField(blank=True, null=True)
    permissions = models.ManyToManyField(Permission, related_name='roles', blank=True)
    is_system = models.BooleanField(default=False)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    def create_user(self, username, email, password=None, role=None, **extra_fields):
        if not username:
            raise ValueError('Username-ul este obligatoriu.')
        if not email:
            raise ValueError('Email-ul este obligatoriu.')

        email = self.normalize_email(email)

        # Assign default 'User' role if none provided
        if role is None:
            role, _ = Role.objects.get_or_create(
                name='User',
                defaults={'description': 'Standard platform user'}
            )

        user = self.model(
            username=username,
            email=email,
            role=role,
            **extra_fields
        )
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()

        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, **extra_fields):
        """Create a Super Admin user with full system access."""
        super_admin_role, _ = Role.objects.get_or_create(
            name='Super Admin',
            defaults={
                'description': 'System Super Admin - Full Privileges',
                'is_system': True
            }
        )

        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_ad_synced', False)

        # Remove 'role' from extra_fields if accidentally passed to avoid duplicate kwarg
        extra_fields.pop('role', None)

        user = self.create_user(
            username=username,
            email=email,
            password=password,
            role=super_admin_role,
            **extra_fields
        )
        return user


class User(AbstractBaseUser):
    """
    Custom enterprise user model with AD/LDAP sync support and granular RBAC.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=150, unique=True, db_index=True)
    email = models.EmailField(max_length=255, unique=True, db_index=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)

    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name='users'
    )
    custom_permissions = models.ManyToManyField(
        Permission,
        related_name='custom_users',
        blank=True
    )

    is_active = models.BooleanField(default=True)
    is_ad_synced = models.BooleanField(default=False)
    last_sync_at = models.DateTimeField(blank=True, null=True)

    # Django admin compatibility
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.username} ({self.role.name})"

    def has_permission(self, perm_code: str) -> bool:
        """
        Check if user has a specific granular permission.
        Super Admin bypasses all permission checks.
        """
        if not self.is_active:
            return False
        if self.role.name == 'Super Admin':
            return True
        if self.custom_permissions.filter(code=perm_code).exists():
            return True
        return self.role.permissions.filter(code=perm_code).exists()

    # Django admin stubs
    def has_perm(self, perm, obj=None):
        return self.is_superuser or self.role.name == 'Super Admin'

    def has_module_perms(self, app_label):
        return self.is_superuser or self.role.name == 'Super Admin'
