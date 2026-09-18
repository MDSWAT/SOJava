from rest_framework import serializers
from apps.virtual_ecc.models import VirtualECC, Raion


class RaionSerializer(serializers.ModelSerializer):
    ecc_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Raion
        fields = ['id', 'name', 'code', 'color', 'ecc_count', 'created_at']
        read_only_fields = ['id', 'created_at', 'ecc_count']


class VirtualECCSerializer(serializers.ModelSerializer):
    masked_mev_key = serializers.SerializerMethodField()
    plain_mev_key = serializers.SerializerMethodField()
    mev_key = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    pdf_file_url = serializers.SerializerMethodField()
    # Raion — write via raion_id, read via raion_detail
    raion_id = serializers.PrimaryKeyRelatedField(
        source='raion',
        queryset=Raion.objects.all(),
        required=False,
        allow_null=True,
    )
    raion_detail = RaionSerializer(source='raion', read_only=True)

    class Meta:
        model = VirtualECC
        fields = [
            'id',
            'terminal_id',
            'oficiu',
            'raion_id',
            'raion_detail',
            'tel_oficiu',
            'nr_inregistrare_sfs',
            'nr_ordine',
            'data_inregistrare',
            'denumire_entitate',
            'idno',
            'model_ecc',
            'adresa_ecc',
            'ip_adresa',
            'masked_mev_key',
            'plain_mev_key',
            'mev_key',
            'status',
            'comentarii',
            'pdf_file',
            'pdf_file_url',
            'z_raport',
            'created_at',
            'updated_at'
        ]
        read_only_fields = [
            'id', 'oficiu', 'created_at', 'updated_at', 'pdf_file_url',
            'masked_mev_key', 'plain_mev_key', 'raion_detail',
        ]
        extra_kwargs = {
            'pdf_file': {'required': False, 'allow_null': True},
            'comentarii': {'required': False, 'allow_null': True, 'allow_blank': True},
        }

    def get_masked_mev_key(self, obj):
        return '••••••••' if obj.encrypted_mev_key else ''

    def get_plain_mev_key(self, obj):
        return obj.get_mev_key() if obj.encrypted_mev_key else ''

    def get_pdf_file_url(self, obj):
        if obj.pdf_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.pdf_file.url)
            return obj.pdf_file.url
        return None

    def create(self, validated_data):
        mev_key = validated_data.pop('mev_key', None)
        # Automatically extract oficiu from terminal_id
        terminal_id = validated_data.get('terminal_id', '')
        if terminal_id and not validated_data.get('oficiu'):
            validated_data['oficiu'] = terminal_id[:-2].lower() if len(terminal_id) >= 3 else terminal_id.lower()

        # If status is pus_in_exploatare, automatically set registration date and z_raport
        if validated_data.get('status') == 'pus_in_exploatare':
            from django.utils import timezone
            if not validated_data.get('data_inregistrare'):
                validated_data['data_inregistrare'] = timezone.localdate()
            if 'z_raport' not in validated_data:
                validated_data['z_raport'] = True

        instance = VirtualECC.objects.create(**validated_data)
        if mev_key is not None:
            instance.set_mev_key(mev_key)
            instance.save()
        return instance

    def update(self, instance, validated_data):
        mev_key = validated_data.pop('mev_key', None)

        # If terminal_id is updated, update oficiu too
        terminal_id = validated_data.get('terminal_id', None)
        if terminal_id:
            validated_data['oficiu'] = terminal_id[:-2].lower() if len(terminal_id) >= 3 else terminal_id.lower()

        # If status is pus_in_exploatare, automatically set registration date and z_raport
        new_status = validated_data.get('status', instance.status)
        if new_status == 'pus_in_exploatare' and ('status' in validated_data):
            from django.utils import timezone
            if not validated_data.get('data_inregistrare') and not instance.data_inregistrare:
                validated_data['data_inregistrare'] = timezone.localdate()
            if 'z_raport' not in validated_data:
                validated_data['z_raport'] = True

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if mev_key is not None:
            instance.set_mev_key(mev_key)

        instance.save()
        return instance
