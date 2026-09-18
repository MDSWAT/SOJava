from rest_framework import serializers
from apps.inventory.models import InventoryItem
from django.contrib.auth import get_user_model

User = get_user_model()


class AssignedUserSerializer(serializers.ModelSerializer):
    """Lightweight serializer for displaying the assigned user."""
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'full_name', 'email']

    def get_full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name if name else obj.username


class InventoryItemSerializer(serializers.ModelSerializer):
    """Full serializer for InventoryItem CRUD operations."""
    assigned_to_detail = AssignedUserSerializer(source='assigned_to', read_only=True)
    assigned_to = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True),
        write_only=False
    )
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = InventoryItem
        fields = [
            'id',
            'name',
            'inventory_number',
            'description',
            'quantity',
            'assigned_to',
            'assigned_to_detail',
            'image',
            'image_url',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'image_url', 'assigned_to_detail']
        extra_kwargs = {
            'image': {'required': False, 'allow_null': True},
        }

    def get_image_url(self, obj):
        """Return absolute URL for the image if it exists."""
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None
