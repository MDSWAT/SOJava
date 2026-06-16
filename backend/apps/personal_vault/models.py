import uuid
from django.db import models
from django.conf import settings
from apps.vault.helpers import VaultCryptor

class PersonalVault(models.Model):
    """
    Personal secret storage owned by a specific user.
    Admin/Super Admin cannot view these contents over general listings.
    Passwords are encrypted at the database level.
    """
    CATEGORY_CHOICES = [
        ('login', 'Autentificare / Logins'),
        ('note', 'Note Sigure'),
        ('link', 'Link-uri Rapide'),
        ('card', 'Carduri Bancare'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='personal_secrets'
    )
    
    title = models.CharField(max_length=255, db_index=True)
    login_username = models.CharField(max_length=255, blank=True, null=True)
    
    # Secure storage
    encrypted_password = models.TextField(blank=True, null=True)
    
    # Metadata
    url = models.CharField(max_length=512, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    
    category = models.CharField(
        max_length=50, 
        choices=CATEGORY_CHOICES, 
        default='login',
        db_index=True
    )
    is_favorite = models.BooleanField(default=False, db_index=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def set_password(self, plain_password):
        if not plain_password:
            self.encrypted_password = ""
            return
        cryptor = VaultCryptor()
        self.encrypted_password = cryptor.encrypt(plain_password)

    def get_password(self):
        if not self.encrypted_password:
            return ""
        cryptor = VaultCryptor()
        return cryptor.decrypt(self.encrypted_password)

    def __str__(self):
        return f"{self.user.username} - {self.title} ({self.category})"
