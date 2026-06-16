from rest_framework import serializers
from apps.vault.models import PasswordVault
from apps.organizations.models import Organization
from apps.organizations.serializers import OrganizationSerializer


class PasswordVaultSerializer(serializers.ModelSerializer):
    """
    Serializer for PasswordVault entries.
    - Passwords are NEVER returned in list/detail responses (masked by default)
    - Only revealed via explicit /reveal/ or /copy/ endpoints with audit logging
    """

    # Write-only password field
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    # Read-only masked password
    masked_password = serializers.SerializerMethodField(read_only=True)

    # Organization — accept name string for write, return full object for read
    organization_name = serializers.CharField(write_only=True)
    organization_id = serializers.UUIDField(source='organization.id', read_only=True)
    organization_detail = OrganizationSerializer(source='organization', read_only=True)

    # Audit tracking
    created_by_user = serializers.CharField(source='created_by.username', read_only=True)
    modified_by_user = serializers.SerializerMethodField(read_only=True)

    created_at_formatted = serializers.DateTimeField(
        source='created_at', format='%d.%m.%Y %H:%M', read_only=True
    )
    updated_at_formatted = serializers.DateTimeField(
        source='updated_at', format='%d.%m.%Y %H:%M', read_only=True
    )
    last_accessed_formatted = serializers.DateTimeField(
        source='last_accessed_at', format='%d.%m.%Y %H:%M', read_only=True, allow_null=True
    )

    class Meta:
        model = PasswordVault
        fields = [
            'id',
            'organization_name',
            'organization_id',
            'organization_detail',
            'title',
            'login_username',
            'password',
            'masked_password',
            'associated_email',
            'associated_phone',
            'created_by_user',
            'modified_by_user',
            'created_at_formatted',
            'updated_at_formatted',
            'last_accessed_formatted',
        ]

    def get_masked_password(self, obj):
        return '••••••••'

    def get_modified_by_user(self, obj):
        if obj.modified_by:
            return obj.modified_by.username
        return None

    def create(self, validated_data):
        plain_password = validated_data.pop('password', '')
        org_name = validated_data.pop('organization_name', '').strip()
        org_name_clean = " ".join(org_name.split())
        org_code = org_name_clean.replace(' ', '_').upper()[:50]
        
        from django.db.models import Q
        org = Organization.objects.filter(
            Q(name__iexact=org_name_clean) | Q(code=org_code)
        ).first()

        if not org:
            org = Organization.objects.create(
                name=org_name_clean,
                code=org_code
            )

        validated_data['organization'] = org
        request = self.context.get('request')

        if request and request.user:
            validated_data['created_by'] = request.user

        instance = PasswordVault(**validated_data)
        if plain_password:
            instance.set_password(plain_password)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        plain_password = validated_data.pop('password', None)
        org_name = validated_data.pop('organization_name', None)
        if org_name is not None:
            org_name = org_name.strip()
            org_name_clean = " ".join(org_name.split())
            org_code = org_name_clean.replace(' ', '_').upper()[:50]
            
            from django.db.models import Q
            org = Organization.objects.filter(
                Q(name__iexact=org_name_clean) | Q(code=org_code)
            ).first()

            if not org:
                org = Organization.objects.create(
                    name=org_name_clean,
                    code=org_code
                )
            instance.organization = org

        request = self.context.get('request')
        if request and request.user:
            instance.modified_by = request.user

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if plain_password:
            instance.set_password(plain_password)

        instance.save()
        return instance
