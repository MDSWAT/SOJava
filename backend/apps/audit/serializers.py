from rest_framework import serializers
from apps.audit.models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    created_at_formatted = serializers.DateTimeField(source='created_at', format='%Y-%m-%d %H:%M:%S', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'username_display', 'action', 
            'module', 'ip_address', 'user_agent', 'details', 
            'created_at', 'created_at_formatted'
        ]
        read_only_fields = fields
