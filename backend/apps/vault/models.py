import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.vault.helpers import VaultCryptor


class PasswordVaultManager(models.Manager):
    """Manager that excludes soft-deleted records by default."""

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)

    def all_with_deleted(self):
        return super().get_queryset()


class PasswordVault(models.Model):
    """
    Core Enterprise Password Vault model.
    Passwords are stored AES-256 encrypted.
    Tracks creation, updates, and soft deletes.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='vaults'
    )

    title = models.CharField(max_length=255, db_index=True, blank=True, default='')
    login_username = models.CharField(max_length=255)
    encrypted_password = models.TextField()
    associated_email = models.CharField(max_length=255, blank=True, null=True)
    associated_phone = models.CharField(max_length=50, blank=True, null=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_passwords'
    )
    modified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='modified_passwords',
        null=True,
        blank=True
    )
    last_accessed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(blank=True, null=True, db_index=True)

    objects = PasswordVaultManager()

    class Meta:
        ordering = ['-created_at']

    def set_password(self, plain_password: str) -> None:
        """Encrypt and store password."""
        cryptor = VaultCryptor()
        self.encrypted_password = cryptor.encrypt(plain_password)

    def get_password(self) -> str:
        """Decrypt and return plain text password."""
        if not self.encrypted_password:
            return ''
        cryptor = VaultCryptor()
        return cryptor.decrypt(self.encrypted_password)

    def delete(self, using=None, keep_parents=False):
        """Soft delete."""
        self.deleted_at = timezone.now()
        self.save(using=using)

    def hard_delete(self):
        """Permanently remove from database."""
        super().delete()

    def restore(self):
        """Restore a soft-deleted item."""
        self.deleted_at = None
        self.save()

    def __str__(self):
        return f"{self.organization.name} - {self.title}"
