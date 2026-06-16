from rest_framework import serializers
from apps.personal_vault.models import PersonalVault


class PersonalVaultSerializer(serializers.ModelSerializer):
    """
    Serializer for PersonalVault.
    - The `password` field is write-only (never returned)
    - A `masked_password` field indicates if a password is stored
    - The `user` is set by the view (not the serializer) via perform_create(user=request.user)
    """
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    masked_password = serializers.SerializerMethodField(read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    created_at_formatted = serializers.DateTimeField(
        source='created_at', format='%d.%m.%Y %H:%M', read_only=True
    )
    updated_at_formatted = serializers.DateTimeField(
        source='updated_at', format='%d.%m.%Y %H:%M', read_only=True
    )
    username_display = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = PersonalVault
        fields = [
            'id',
            'title',
            'login_username',
            'password',
            'masked_password',
            'url',
            'notes',
            'category',
            'category_display',
            'is_favorite',
            'created_at_formatted',
            'updated_at_formatted',
            'username_display',
        ]
        read_only_fields = ['id', 'created_at_formatted', 'updated_at_formatted']

    def get_masked_password(self, obj):
        if obj.encrypted_password:
            return '••••••••'
        return ''

    def create(self, validated_data):
        plain_password = validated_data.pop('password', None)
        # Note: `user` is passed via perform_create(user=request.user) — not set here
        instance = PersonalVault(**validated_data)
        if plain_password:
            instance.set_password(plain_password)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        plain_password = validated_data.pop('password', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if plain_password is not None:
            instance.set_password(plain_password)

        instance.save()
        return instance
