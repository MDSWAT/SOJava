from rest_framework import serializers
from apps.posta_contacts.models import Raion, ContactOficiu


class ContactOficiuSerializer(serializers.ModelSerializer):
    raion_name = serializers.CharField(source='raion.name', read_only=True)
    tip_display = serializers.CharField(source='get_tip_display', read_only=True)

    class Meta:
        model = ContactOficiu
        fields = [
            'id',
            'raion',
            'raion_name',
            'tip',
            'tip_display',
            'ordine',
            'oficiu',
            'nume',
            'prenume',
            'functie',
            'telefon',
            'email',
            'adresa',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'raion_name', 'tip_display']


class RaionSerializer(serializers.ModelSerializer):
    contacts_count = serializers.SerializerMethodField()

    class Meta:
        model = Raion
        fields = [
            'id',
            'name',
            'code',
            'svg_id',
            'contacts_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'contacts_count']

    def get_contacts_count(self, obj):
        return obj.contacts.count()


class RaionDetailSerializer(serializers.ModelSerializer):
    contacts = ContactOficiuSerializer(many=True, read_only=True)

    class Meta:
        model = Raion
        fields = [
            'id',
            'name',
            'code',
            'svg_id',
            'contacts',
        ]
        read_only_fields = fields
