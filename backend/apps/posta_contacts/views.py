from django.db import models
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.posta_contacts.models import Raion, ContactOficiu
from apps.posta_contacts.serializers import (
    RaionSerializer,
    RaionDetailSerializer,
    ContactOficiuSerializer,
)
from apps.audit.models import AuditLog


class RaionViewSet(viewsets.ModelViewSet):
    queryset = Raion.objects.all()
    serializer_class = RaionSerializer

    def _log_audit(self, action, details):
        ip = getattr(self.request, 'client_ip', '0.0.0.0')
        ua = getattr(self.request, 'user_agent', 'system')[:512]
        AuditLog.objects.create(
            user=self.request.user,
            username_display=self.request.user.username,
            action=action,
            module='posta_contacts',
            ip_address=ip,
            user_agent=ua,
            details=details
        )

    def perform_create(self, serializer):
        instance = serializer.save()
        self._log_audit('raion_create', {'raion_id': str(instance.id), 'name': getattr(instance, 'name', str(instance))})

    def perform_update(self, serializer):
        instance = serializer.save()
        self._log_audit('raion_update', {'raion_id': str(instance.id), 'fields_changed': list(self.request.data.keys())})

    def perform_destroy(self, instance):
        self._log_audit('raion_delete', {'raion_id': str(instance.id), 'name': getattr(instance, 'name', str(instance))})
        instance.delete()

    @action(detail=True, methods=['get'])
    def contacts(self, request, pk=None):
        """Return all contacts for a specific raion."""
        raion = self.get_object()
        serializer = RaionDetailSerializer(raion)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def all_with_contacts(self, request):
        """Return all raions with their contacts nested."""
        raions = Raion.objects.prefetch_related('contacts').all()
        serializer = RaionDetailSerializer(raions, many=True)
        return Response(serializer.data)


class ContactOficiuViewSet(viewsets.ModelViewSet):
    queryset = ContactOficiu.objects.select_related('raion').all()
    serializer_class = ContactOficiuSerializer

    def _log_audit(self, action, details):
        ip = getattr(self.request, 'client_ip', '0.0.0.0')
        ua = getattr(self.request, 'user_agent', 'system')[:512]
        AuditLog.objects.create(
            user=self.request.user,
            username_display=self.request.user.username,
            action=action,
            module='posta_contacts',
            ip_address=ip,
            user_agent=ua,
            details=details
        )

    def perform_create(self, serializer):
        instance = serializer.save()
        self._log_audit('contact_create', {
            'contact_id': str(instance.id),
            'name': f'{getattr(instance, "nume", "")} {getattr(instance, "prenume", "")}'.strip(),
            'oficiu': getattr(instance, 'oficiu', ''),
        })

    def perform_update(self, serializer):
        instance = serializer.save()
        self._log_audit('contact_update', {
            'contact_id': str(instance.id),
            'fields_changed': list(self.request.data.keys()),
        })

    def perform_destroy(self, instance):
        self._log_audit('contact_delete', {
            'contact_id': str(instance.id),
            'name': f'{getattr(instance, "nume", "")} {getattr(instance, "prenume", "")}'.strip(),
        })
        instance.delete()

    def get_queryset(self):
        qs = ContactOficiu.objects.select_related('raion').all()
        raion_id = self.request.query_params.get('raion_id', None)
        if raion_id:
            qs = qs.filter(raion_id=raion_id)
        search = self.request.query_params.get('search', None)
        if search:
            qs = qs.filter(
                models.Q(nume__icontains=search) |
                models.Q(prenume__icontains=search) |
                models.Q(oficiu__icontains=search) |
                models.Q(telefon__icontains=search) |
                models.Q(email__icontains=search) |
                models.Q(adresa__icontains=search)
            )
        return qs
