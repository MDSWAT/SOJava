import uuid
from django.db import models
from django.conf import settings

class AuditLog(models.Model):
    """
    Central audit log table recording all security-sensitive events.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        related_name='audit_logs',
        null=True,
        blank=True
    )
    # Store snapshot of username in case the user is deleted
    username_display = models.CharField(max_length=150, db_index=True)
    
    action = models.CharField(max_length=100, db_index=True) # e.g., 'password_view', 'login_failed'
    module = models.CharField(max_length=100, db_index=True) # e.g., 'vault', 'auth'
    
    ip_address = models.CharField(max_length=45, db_index=True)
    user_agent = models.CharField(max_length=512)
    
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.created_at} - {self.username_display} - {self.action}"
