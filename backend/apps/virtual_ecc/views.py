import os
import re
from io import BytesIO
from datetime import datetime, date
from pypdf import PdfReader

from django.conf import settings
from django.http import HttpResponse, FileResponse
from django.db.models import Q, Count, F, Value, Case, When, IntegerField
from django.db.models.functions import NullIf
from django.utils import timezone
from rest_framework import viewsets, permissions, status, parsers
from rest_framework.decorators import action
from rest_framework.response import Response

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from rest_framework.pagination import PageNumberPagination
from apps.authentication.rbac import HasGranularPermission
from apps.audit.models import AuditLog
from apps.virtual_ecc.models import VirtualECC, Raion
from apps.virtual_ecc.serializers import VirtualECCSerializer, RaionSerializer


class VirtualECCPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 500


class VirtualECCViewSet(viewsets.ModelViewSet):
    serializer_class = VirtualECCSerializer
    pagination_class = VirtualECCPagination
    permission_classes = [permissions.IsAuthenticated, HasGranularPermission]
    required_permission = 'virtual_ecc:view'
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_queryset(self):
        qs = VirtualECC.objects.all()
        search = self.request.query_params.get('search', None)
        if search:
            qs = qs.filter(
                Q(terminal_id__icontains=search) |
                Q(oficiu__icontains=search) |
                Q(nr_inregistrare_sfs__icontains=search) |
                Q(denumire_entitate__icontains=search) |
                Q(adresa_ecc__icontains=search) |
                Q(ip_adresa__icontains=search) |
                Q(comentarii__icontains=search)
            )
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            qs = qs.filter(status=status_filter)

        raion_filter = self.request.query_params.get('raion', None)
        if raion_filter == 'nealocat':
            qs = qs.filter(raion__isnull=True)
        elif raion_filter:
            qs = qs.filter(raion__id=raion_filter)

        has_mev_key = self.request.query_params.get('has_mev_key', None)
        if has_mev_key is not None and has_mev_key != '':
            if has_mev_key.lower() == 'true':
                qs = qs.exclude(encrypted_mev_key__isnull=True).exclude(encrypted_mev_key__exact='')
            elif has_mev_key.lower() == 'false':
                qs = qs.filter(Q(encrypted_mev_key__isnull=True) | Q(encrypted_mev_key__exact=''))

        ordering = self.request.query_params.get('ordering', None)
        if ordering == 'ip_adresa':
            # Cu IP: only records with an IP address, ordered by office and terminal
            qs = qs.exclude(ip_adresa__isnull=True).exclude(ip_adresa__exact='').order_by('oficiu', 'terminal_id')
        elif ordering == '-ip_adresa':
            # Fără IP: only records without an IP address, ordered by office and terminal
            qs = qs.filter(Q(ip_adresa__isnull=True) | Q(ip_adresa__exact='')).order_by('oficiu', 'terminal_id')
        elif ordering == 'mev_key':
            # Cu cheie MEV: only records with an MEV key, ordered by office and terminal
            qs = qs.exclude(encrypted_mev_key__isnull=True).exclude(encrypted_mev_key__exact='').order_by('oficiu', 'terminal_id')
        elif ordering == '-mev_key':
            # Fără cheie MEV: only records without an MEV key, ordered by office and terminal
            qs = qs.filter(Q(encrypted_mev_key__isnull=True) | Q(encrypted_mev_key__exact='')).order_by('oficiu', 'terminal_id')
        elif ordering in ['adresa_ecc', '-adresa_ecc', 'status', '-status', 'oficiu', '-oficiu', 'terminal_id', '-terminal_id']:
            qs = qs.order_by(ordering)
        else:
            qs = qs.order_by('oficiu', 'terminal_id')

        return qs

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'import_pdf', 'import_ips', 'import_mev_keys']:
            self.required_permission = 'virtual_ecc:manage'
        else:
            self.required_permission = 'virtual_ecc:view'
        return super().get_permissions()

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """Return aggregated status counts using DB-level COUNT — no pagination applied."""
        counts = VirtualECC.objects.values('status').annotate(total=Count('id'))
        total = VirtualECC.objects.count()
        with_ip = VirtualECC.objects.exclude(ip_adresa__isnull=True).exclude(ip_adresa__exact='').count()
        with_mev = VirtualECC.objects.exclude(encrypted_mev_key__isnull=True).exclude(encrypted_mev_key__exact='').count()
        result = {
            'total': total,
            'by_status': {row['status']: row['total'] for row in counts},
            'with_ip': with_ip,
            'without_ip': total - with_ip,
            'with_mev': with_mev,
            'without_mev': total - with_mev,
        }
        return Response(result)

    def perform_create(self, serializer):
        ecc = serializer.save()
        # Auto-propagate tel_oficiu to all devices with the same office (including clearing)
        if ecc.oficiu:
            VirtualECC.objects.filter(
                oficiu=ecc.oficiu
            ).exclude(pk=ecc.pk).update(tel_oficiu=ecc.tel_oficiu or None)
        self._log_audit_event(
            action='create_ecc',
            details={
                'ecc_id': str(ecc.id),
                'terminal_id': ecc.terminal_id,
                'oficiu': ecc.oficiu,
                'status': ecc.status
            }
        )

    def perform_update(self, serializer):
        ecc = serializer.save()
        # Auto-propagate tel_oficiu to all devices with the same office (including clearing)
        if ecc.oficiu:
            VirtualECC.objects.filter(
                oficiu=ecc.oficiu
            ).exclude(pk=ecc.pk).update(tel_oficiu=ecc.tel_oficiu or None)
        self._log_audit_event(
            action='update_ecc',
            details={
                'ecc_id': str(ecc.id),
                'terminal_id': ecc.terminal_id,
                'oficiu': ecc.oficiu,
                'status': ecc.status
            }
        )

    def perform_destroy(self, instance):
        self._log_audit_event(
            action='delete_ecc',
            details={
                'ecc_id': str(instance.id),
                'terminal_id': instance.terminal_id,
                'oficiu': instance.oficiu
            }
        )
        instance.delete()

    @action(detail=True, methods=['get'], url_path='reveal')
    def reveal_mev_key(self, request, pk=None):
        """Reveal decrypted MEV key with strict access log creation."""
        if not request.user.has_permission('virtual_ecc:reveal'):
            return Response(
                {"detail": "Nu aveți permisiunea de a dezvălui chei MEV."},
                status=status.HTTP_403_FORBIDDEN
            )
        instance = self.get_object()
        plain_key = instance.get_mev_key()

        self._log_audit_event(
            action='reveal_mev_key',
            details={
                'ecc_id': str(instance.id),
                'terminal_id': instance.terminal_id,
                'oficiu': instance.oficiu
            }
        )
        return Response({"mev_key": plain_key})

    @action(detail=False, methods=['get'], url_path='reveal-bulk')
    def reveal_mev_keys_bulk(self, request):
        """Reveal decrypted MEV keys for multiple ECCs at once (bulk)."""
        if not request.user.has_permission('virtual_ecc:reveal'):
            return Response(
                {"detail": "Nu aveți permisiunea de a dezvălui chei MEV."},
                status=status.HTTP_403_FORBIDDEN
            )
        ids_param = request.query_params.get('ids', '')
        if not ids_param:
            return Response({"keys": {}})

        ids = [s.strip() for s in ids_param.split(',') if s.strip()]
        keys = {}
        for ecc_id in ids:
            try:
                instance = VirtualECC.objects.get(pk=ecc_id)
                if instance.encrypted_mev_key:
                    keys[ecc_id] = instance.get_mev_key()
                    self._log_audit_event(
                        action='reveal_mev_key',
                        details={
                            'ecc_id': str(instance.id),
                            'terminal_id': instance.terminal_id,
                            'oficiu': instance.oficiu
                        }
                    )
            except VirtualECC.DoesNotExist:
                continue

        return Response({"keys": keys})

    @action(detail=True, methods=['get'], url_path='download')
    def download_pdf(self, request, pk=None):
        """Secure download of the original registration PDF file."""
        instance = self.get_object()
        if not instance.pdf_file:
            return Response(
                {"detail": "Acest echipament nu are atașat un fișier PDF."},
                status=status.HTTP_404_NOT_FOUND
            )

        file_path = instance.pdf_file.path
        if not os.path.exists(file_path):
            return Response(
                {"detail": "Fișierul PDF nu a fost găsit pe server."},
                status=status.HTTP_404_NOT_FOUND
            )

        self._log_audit_event(
            action='download_pdf',
            details={
                'ecc_id': str(instance.id),
                'terminal_id': instance.terminal_id,
                'filename': os.path.basename(file_path)
            }
        )

        response = FileResponse(open(file_path, 'rb'), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{os.path.basename(file_path)}"'
        return response

    @action(detail=False, methods=['post'], url_path='import')
    def import_pdf(self, request):
        """Import one or more PDF files, parse their content and create/update database records."""
        files = request.FILES.getlist('file')
        if not files:
            return Response(
                {"detail": "Niciun fișier nu a fost încărcat."},
                status=status.HTTP_400_BAD_REQUEST
            )

        results = {
            'success': [],
            'failed': []
        }

        # Optional raion assignment
        raion_id = request.data.get('raion_id', None)
        raion_obj = None
        if raion_id:
            try:
                raion_obj = Raion.objects.get(id=raion_id)
            except Raion.DoesNotExist:
                pass

        for f in files:
            try:
                # 1. Read PDF text using pypdf
                reader = PdfReader(f)
                text = ""
                for page in reader.pages:
                    text += page.extract_text() or ""

                # 2. Run regex parsing
                parsed_data = self._parse_pdf_text(text)

                # Check for critical missing elements
                if not parsed_data.get('terminal_id'):
                    raise ValueError("ID-ul Terminalului nu a putut fi extras din PDF.")

                terminal_id = parsed_data['terminal_id'].strip().upper()
                oficiu = parsed_data.get('oficiu', '')

                # 3. Find existing record — match by terminal_id first, then by SFS as fallback
                ecc_instance = VirtualECC.objects.filter(terminal_id=terminal_id).first()
                action_type = "updated" if ecc_instance else "created"

                # If no match by terminal_id, try matching by nr_inregistrare_sfs
                # This catches duplicates where the terminal_id was parsed differently
                if not ecc_instance and parsed_data.get('nr_inregistrare_sfs'):
                    sfs_match = VirtualECC.objects.filter(
                        nr_inregistrare_sfs=parsed_data['nr_inregistrare_sfs']
                    ).first()
                    if sfs_match:
                        # Delete the old duplicate and create fresh with correct terminal_id
                        old_pdf_path = sfs_match.pdf_file.path if sfs_match.pdf_file else None
                        sfs_match.delete()
                        if old_pdf_path and os.path.isfile(old_pdf_path):
                            try:
                                os.remove(old_pdf_path)
                            except OSError:
                                pass

                if not ecc_instance:
                    ecc_instance = VirtualECC(terminal_id=terminal_id)

                ecc_instance.oficiu = oficiu
                ecc_instance.nr_inregistrare_sfs = parsed_data.get('nr_inregistrare_sfs', ecc_instance.nr_inregistrare_sfs)
                ecc_instance.nr_ordine = parsed_data.get('nr_ordine', ecc_instance.nr_ordine)

                if parsed_data.get('data_inregistrare'):
                    ecc_instance.data_inregistrare = parsed_data['data_inregistrare']

                ecc_instance.denumire_entitate = parsed_data.get('denumire_entitate', ecc_instance.denumire_entitate)
                # Normalize "POSTA MOLDOVEI" variants
                if ecc_instance.denumire_entitate and 'POSTA MOLDOVEI' in ecc_instance.denumire_entitate.upper():
                    ecc_instance.denumire_entitate = 'POSTA MOLDOVEI I.S.'
                ecc_instance.idno = parsed_data.get('idno', ecc_instance.idno)
                ecc_instance.model_ecc = parsed_data.get('model_ecc', ecc_instance.model_ecc)
                ecc_instance.adresa_ecc = parsed_data.get('adresa_ecc', ecc_instance.adresa_ecc)

                # Save uploaded file
                ecc_instance.pdf_file = f
                # Assign raion if specified (only override if currently unset)
                if raion_obj and not ecc_instance.raion_id:
                    ecc_instance.raion = raion_obj
                ecc_instance.save()

                results['success'].append({
                    'filename': f.name,
                    'terminal_id': terminal_id,
                    'oficiu': oficiu,
                    'action': action_type
                })

                self._log_audit_event(
                    action='import_ecc_pdf',
                    details={
                        'filename': f.name,
                        'terminal_id': terminal_id,
                        'oficiu': oficiu,
                        'action': action_type
                    }
                )

            except Exception as e:
                results['failed'].append({
                    'filename': f.name,
                    'error': str(e)
                })

        return Response(results, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='import-ips')
    def import_ips(self, request):
        """Import IP addresses from an Excel file.

        Reads column A (terminal_id) and column D (ip_adresa).
        - Strips trailing '|' from IP
        - If IP doesn't start with '192.168.', prepends it
        - Skips rows where IP is empty
        - Reports duplicates within the Excel
        - Reports terminal_ids not found in DB
        - For terminal_ids that already have an IP, requires force=true to overwrite

        POST params:
            file:  Excel file (.xlsx)
            force: 'true' to overwrite existing IPs (default: false)
        """
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'Nu a fost încărcat niciun fișier.'}, status=status.HTTP_400_BAD_REQUEST)

        force = request.data.get('force', 'false').lower() == 'true'

        try:
            wb = load_workbook(file, read_only=True, data_only=True)
            ws = wb.active
        except Exception:
            return Response({'error': 'Fișierul Excel nu a putut fi citit. Asigurați-vă că este un fișier .xlsx valid.'}, status=status.HTTP_400_BAD_REQUEST)

        # Parse rows: column A = terminal_id, column D = ip_adresa
        # Skip header row (row 1)
        rows = []
        seen_in_excel = {}  # terminal_id -> [row_numbers]
        duplicates = []

        for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            # Pad row to at least 4 columns
            cells = list(row) + [None] * (4 - len(row)) if len(row) < 4 else list(row)
            terminal_id_raw = cells[0]
            ip_raw = cells[3] if len(cells) > 3 else None

            if not terminal_id_raw:
                continue

            terminal_id = str(terminal_id_raw).strip().upper().replace(' ', '')

            # Track duplicates within Excel
            if terminal_id in seen_in_excel:
                duplicates.append({
                    'terminal_id': terminal_id,
                    'rows': seen_in_excel[terminal_id] + [row_idx]
                })
                # Keep first occurrence, skip duplicates
                continue
            seen_in_excel[terminal_id] = [row_idx]

            # Process IP
            ip_str = str(ip_raw).strip() if ip_raw else ''

            if not ip_str:
                # Empty IP — skip, will report as no_ip
                rows.append({
                    'terminal_id': terminal_id,
                    'ip': '',
                    'row': row_idx,
                    'has_ip': False
                })
                continue

            # Strip trailing '|'
            ip_str = ip_str.rstrip('|').strip()

            # Add prefix if missing
            if not ip_str.startswith('192.168.'):
                ip_str = '192.168.' + ip_str

            rows.append({
                'terminal_id': terminal_id,
                'ip': ip_str,
                'row': row_idx,
                'has_ip': True
            })

        wb.close()

        # Separate into categories
        no_ip = [r for r in rows if not r['has_ip']]
        with_ip = [r for r in rows if r['has_ip']]

        # Match against DB
        terminal_ids = [r['terminal_id'] for r in with_ip]
        existing = VirtualECC.objects.filter(terminal_id__in=terminal_ids)
        existing_map = {ecc.terminal_id: ecc for ecc in existing}

        not_found = []
        updated = []
        already_has_ip = []
        overwrite_conflict = []

        for r in with_ip:
            ecc = existing_map.get(r['terminal_id'])
            if not ecc:
                not_found.append({
                    'terminal_id': r['terminal_id'],
                    'row': r['row']
                })
                continue

            if ecc.ip_adresa and ecc.ip_adresa.strip():
                # Already has an IP — check if it's different
                if ecc.ip_adresa.strip() == r['ip']:
                    # Same IP, no change needed
                    updated.append({
                        'terminal_id': r['terminal_id'],
                        'ip': r['ip'],
                        'action': 'same'
                    })
                else:
                    # Different IP — needs confirmation
                    already_has_ip.append({
                        'terminal_id': r['terminal_id'],
                        'old_ip': ecc.ip_adresa.strip(),
                        'new_ip': r['ip'],
                        'row': r['row']
                    })
                    if force:
                        ecc.ip_adresa = r['ip']
                        ecc.save()
                        overwrite_conflict.append({
                            'terminal_id': r['terminal_id'],
                            'old_ip': already_has_ip[-1]['old_ip'],
                            'new_ip': r['ip']
                        })
            else:
                # No existing IP — update directly
                ecc.ip_adresa = r['ip']
                ecc.save()
                updated.append({
                    'terminal_id': r['terminal_id'],
                    'ip': r['ip'],
                    'action': 'added'
                })

        # Also check not_found for the no_ip rows
        no_ip_not_found = []
        no_ip_found = []
        for r in no_ip:
            if r['terminal_id'] in existing_map:
                no_ip_found.append(r['terminal_id'])
            else:
                no_ip_not_found.append({
                    'terminal_id': r['terminal_id'],
                    'row': r['row']
                })

        result = {
            'summary': {
                'total_rows': len(rows),
                'with_ip': len(with_ip),
                'without_ip': len(no_ip),
                'updated': len([u for u in updated if u['action'] == 'added']) + len(overwrite_conflict),
                'same_ip': len([u for u in updated if u['action'] == 'same']),
                'already_has_ip': len(already_has_ip),
                'not_found': len(not_found) + len(no_ip_not_found),
                'duplicates': len(duplicates),
            },
            'updated': updated,
            'already_has_ip': already_has_ip,
            'overwritten': overwrite_conflict if force else [],
            'not_found': not_found + no_ip_not_found,
            'duplicates': duplicates,
            'no_ip': no_ip_found,
            'force_used': force,
        }

        self._log_audit_event(
            action='import_ips_excel',
            details={
                'total_rows': len(rows),
                'updated': result['summary']['updated'],
                'already_has_ip': len(already_has_ip),
                'not_found': len(not_found) + len(no_ip_not_found),
                'duplicates': len(duplicates),
                'force': force,
            }
        )

        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='import-mev-keys')
    def import_mev_keys(self, request):
        """Import MEV keys from an Excel file.

        Reads column C (index 2) = mev_number (terminal_id) and
        column L (index 11) = mev_key.

        Rules:
        - Only updates ECCs that have NO existing MEV key (encrypted_mev_key is empty/null)
        - ECCs that already have a key are skipped (not modified)
        - Reports duplicates within the Excel file
        - Reports terminal_ids not found in DB
        - Reports skipped (already has key)

        POST params:
            file:  Excel file (.xlsx)
        """
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'Nu a fost încărcat niciun fișier.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            wb = load_workbook(file, read_only=True, data_only=True)
            ws = wb.active
        except Exception:
            return Response({'error': 'Fișierul Excel nu a putut fi citit. Asigurați-vă că este un fișier .xlsx valid.'}, status=status.HTTP_400_BAD_REQUEST)

        # Parse rows: column C (index 2) = mev_number (nr_inregistrare_sfs), column L (index 11) = mev_key
        # Data starts at row 5 (rows 1-4 are headers/title blocks)
        rows = []
        seen_in_excel = {}  # mev_number -> [row_numbers]
        duplicates = []

        for row_idx, row in enumerate(ws.iter_rows(min_row=5, values_only=True), start=5):
            # Pad row to at least 12 columns
            cells = list(row) + [None] * (12 - len(row)) if len(row) < 12 else list(row)
            mev_number_raw = cells[2] if len(cells) > 2 else None  # Column C
            mev_key_raw = cells[11] if len(cells) > 11 else None    # Column L

            if not mev_number_raw:
                continue

            mev_number = str(mev_number_raw).strip()

            # Track duplicates within Excel
            if mev_number in seen_in_excel:
                duplicates.append({
                    'mev_number': mev_number,
                    'rows': seen_in_excel[mev_number] + [row_idx]
                })
                # Keep first occurrence, skip duplicates
                continue
            seen_in_excel[mev_number] = [row_idx]

            mev_key_str = str(mev_key_raw).strip() if mev_key_raw else ''

            is_date = isinstance(mev_key_raw, (datetime, date))
            if not is_date and mev_key_str:
                is_date = bool(re.match(r'^\d{4}[-/]\d{2}[-/]\d{2}|^\d{2}[./-]\d{2}[./-]\d{4}', mev_key_str))

            if not mev_key_str or mev_key_str in ['—', '-', '–', 'N/A', 'n/a', 'null', 'None'] or is_date:
                # Empty or date MEV key — skip
                rows.append({
                    'mev_number': mev_number,
                    'mev_key': '',
                    'row': row_idx,
                    'has_key': False
                })
                continue

            rows.append({
                'mev_number': mev_number,
                'mev_key': mev_key_str,
                'row': row_idx,
                'has_key': True
            })

        wb.close()

        # Separate into categories
        no_key = [r for r in rows if not r['has_key']]
        with_key = [r for r in rows if r['has_key']]

        # Match against DB by nr_inregistrare_sfs (MEV Number)
        mev_numbers = [r['mev_number'] for r in with_key]
        existing = VirtualECC.objects.filter(nr_inregistrare_sfs__in=mev_numbers)
        existing_map = {ecc.nr_inregistrare_sfs: ecc for ecc in existing}

        not_found = []
        updated = []
        skipped_has_key = []

        for r in with_key:
            ecc = existing_map.get(r['mev_number'])
            if not ecc:
                not_found.append({
                    'mev_number': r['mev_number'],
                    'row': r['row']
                })
                continue

            if ecc.encrypted_mev_key:
                # Already has a key — skip, do not modify
                skipped_has_key.append({
                    'mev_number': r['mev_number'],
                    'terminal_id': ecc.terminal_id,
                    'row': r['row']
                })
            else:
                # No existing key — set it
                ecc.set_mev_key(r['mev_key'])
                ecc.save()
                updated.append({
                    'mev_number': r['mev_number'],
                    'terminal_id': ecc.terminal_id,
                    'mev_key': r['mev_key'],
                    'action': 'added'
                })

        # Also check no_key rows for not_found
        no_key_not_found = []
        for r in no_key:
            if r['mev_number'] not in existing_map:
                no_key_not_found.append({
                    'mev_number': r['mev_number'],
                    'row': r['row']
                })

        result = {
            'summary': {
                'total_rows': len(rows),
                'with_key': len(with_key),
                'without_key': len(no_key),
                'updated': len(updated),
                'skipped_has_key': len(skipped_has_key),
                'not_found': len(not_found) + len(no_key_not_found),
                'duplicates': len(duplicates),
            },
            'updated': updated,
            'skipped_has_key': skipped_has_key,
            'not_found': not_found + no_key_not_found,
            'duplicates': duplicates,
        }

        self._log_audit_event(
            action='import_mev_keys',
            details={
                'total_rows': len(rows),
                'updated': len(updated),
                'skipped_has_key': len(skipped_has_key),
                'not_found': len(not_found) + len(no_key_not_found),
                'duplicates': len(duplicates),
            }
        )

        return Response(result, status=status.HTTP_200_OK)

    def _parse_pdf_text(self, text):
        data = {}

        # IDNO
        idno_m = re.search(r'(?:IDNO|codul\s+fiscal)\D*(\d{13})', text, re.IGNORECASE)
        if idno_m:
            data['idno'] = idno_m.group(1)

        # Denumire entitate
        denumire_m = re.search(r'Denumirea\s+entit[^,\n]+,\s*(.+)', text, re.IGNORECASE)
        if denumire_m:
            val = denumire_m.group(1).strip()
            if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                val = val[1:-1].strip()
            data['denumire_entitate'] = val

        # Adresa ECC — capture everything between "ECC" and "Genul de activitate" (multiline)
        adresa_m = re.search(
            r'unde\s+este\s+amplasat\s+ECC\s+(.+?)\s+Genul\s+de\s+activitate',
            text, re.IGNORECASE | re.DOTALL
        )
        if adresa_m:
            addr = adresa_m.group(1).strip()
            # Collapse internal whitespace / newlines into single spaces
            addr = re.sub(r'\s+', ' ', addr)
            data['adresa_ecc'] = addr
        else:
            # Fallback: single-line capture
            adresa_m2 = re.search(r'unde\s+este\s+amplasat\s+ECC\s*(.+)', text, re.IGNORECASE)
            if adresa_m2:
                data['adresa_ecc'] = re.sub(r'\s+', ' ', adresa_m2.group(1).strip())

        # Model ECC
        model_m = re.search(r'Modelul\s+ECC\s+(.+?)\s+Nr\.\s+de\s+fabrica', text, re.IGNORECASE)
        if model_m:
            data['model_ecc'] = model_m.group(1).strip()

        # Terminal ID / ID sistem informatic — the single unique identifier (no separate nr_fabricatie)
        fab_m = re.search(r'(?:sistemului\s+informatic|fabrica[^/]+?)\s+(\w+)\s*$', text, re.MULTILINE | re.IGNORECASE)
        if not fab_m:
            fab_m = re.search(r'Nr\.\s+de\s+fabrica.*?informatic\s+(\w+)', text, re.IGNORECASE)
        if fab_m:
            val = fab_m.group(1).strip().upper()
            data['terminal_id'] = val
            if len(val) >= 3:
                data['oficiu'] = val[:-2].lower()

        # Nr de inregistrare SFS
        sfs_m = re.search(r'atribuit\s+de\s+SFS\s+(\w+)', text, re.IGNORECASE)
        if sfs_m:
            data['nr_inregistrare_sfs'] = sfs_m.group(1).strip()

        # Numrul de ordine al înscrierii (poate fi pe linie noua)
        ordine_m = re.search(r'Num[a-z\s]+de\s+ordine\s+al\s+[iî]nscrierii\s+(\d+)', text, re.IGNORECASE)
        if ordine_m:
            data['nr_ordine'] = ordine_m.group(1).strip()

        # Data inregistrarii ECC
        data_m = re.search(r'data\s+[iî]nregistr[a-z\s]+ECC\s+([\d\.]+)', text, re.IGNORECASE)
        if data_m:
            date_str = data_m.group(1).strip()
            try:
                dt = datetime.strptime(date_str, "%d.%m.%Y").date()
                data['data_inregistrare'] = dt
            except ValueError:
                pass

        return data

    # Available columns for export: key -> (header_label, value_extractor)
    EXPORT_COLUMNS = {
        'oficiu':              ('Oficiu',              lambda item: item.oficiu.upper()),
        'tel_oficiu':          ('Telefon Oficiu',      lambda item: item.tel_oficiu or '—'),
        'terminal_id':         ('ID Terminal',         lambda item: item.terminal_id),
        'nr_inregistrare_sfs': ('Nr. Înregistrare SFS', lambda item: item.nr_inregistrare_sfs or '—'),
        'nr_ordine':           ('Nr. Ordine',          lambda item: item.nr_ordine or '—'),
        'data_inregistrare':   ('Dată Înregistrare',   lambda item: item.data_inregistrare.strftime('%Y-%m-%d') if item.data_inregistrare else '—'),
        'denumire_entitate':   ('Denumire Entitate',   lambda item: item.denumire_entitate or '—'),
        'idno':                ('IDNO',                lambda item: item.idno or '—'),
        'model_ecc':           ('Model ECC',           lambda item: item.model_ecc or '—'),
        'adresa_ecc':          ('Adresă ECC',          lambda item: item.adresa_ecc or '—'),
        'ip_adresa':           ('IP Adresă',           lambda item: item.ip_adresa or '—'),
        'status':              ('Statut',              lambda item: dict(item.STATUS_CHOICES).get(item.status, item.status)),
        'mev_key':             ('Cheie MEV',           lambda item: item.get_mev_key() or '—'),
        'comentarii':          ('Comentarii',          lambda item: item.comentarii or '—'),
        'created_at':          ('Data Creării',        lambda item: item.created_at.strftime('%Y-%m-%d %H:%M') if item.created_at else '—'),
    }
    DEFAULT_EXPORT_COLUMNS = [
        'oficiu', 'terminal_id', 'nr_inregistrare_sfs', 'nr_ordine',
        'data_inregistrare', 'denumire_entitate', 'idno', 'adresa_ecc', 'status'
    ]

    @action(detail=False, methods=['get'], url_path='export')
    def export_excel(self, request):
        """Export virtual cash registers as a styled Excel workbook.

        Query params:
            columns:  comma-separated column keys (defaults to DEFAULT_EXPORT_COLUMNS)
            oficiu:   filter by office (exact match, case-insensitive)
            status:   comma-separated status values (e.g. 'certificat,pus_in_exploatare')
            search:   search term (same as list view)
            ordering: sort order (same as list view)
        """
        queryset = self.filter_queryset(self.get_queryset())

        # Extra filters specific to export
        oficiu_param = request.query_params.get('oficiu', None)
        if oficiu_param:
            oficiu_list = [o.strip() for o in oficiu_param.split(',') if o.strip()]
            if oficiu_list:
                queryset = queryset.filter(oficiu__in=oficiu_list)

        status_param = request.query_params.get('status', None)
        if status_param:
            status_list = [s.strip() for s in status_param.split(',') if s.strip()]
            if status_list:
                queryset = queryset.filter(status__in=status_list)

        # Determine which columns to export
        columns_param = request.query_params.get('columns', None)
        if columns_param:
            selected_keys = [c.strip() for c in columns_param.split(',') if c.strip() in self.EXPORT_COLUMNS]
        else:
            selected_keys = self.DEFAULT_EXPORT_COLUMNS

        # Fallback: if no valid columns, use defaults
        if not selected_keys:
            selected_keys = self.DEFAULT_EXPORT_COLUMNS

        selected_columns = [(key, self.EXPORT_COLUMNS[key]) for key in selected_keys]
        headers = [col[1][0] for col in selected_columns]
        num_cols = len(headers)

        wb = Workbook()
        ws = wb.active
        ws.title = "Aparate Casa Virtuale"

        # Page setup
        ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
        ws.page_setup.paperSize = ws.PAPERSIZE_A4
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 0
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.print_title_rows = '1:3'

        # Fonts and fills matching inventory style
        fn = 'Calibri'
        title_font = Font(name=fn, size=16, bold=True, color='FFFFFF')
        subtitle_font = Font(name=fn, size=9, color='BFDBFE')
        header_font = Font(name=fn, size=9, bold=True, color='1E3A5F')
        data_font = Font(name=fn, size=9, color='1E293B')

        title_fill = PatternFill(start_color='0F172A', end_color='0F172A', fill_type='solid')
        header_fill = PatternFill(start_color='DBEAFE', end_color='DBEAFE', fill_type='solid')
        alt_fill = PatternFill(start_color='F8FAFC', end_color='F8FAFC', fill_type='solid')
        white_fill = PatternFill(start_color='FFFFFF', end_color='FFFFFF', fill_type='solid')

        thin_border = Border(
            left=Side(style='thin', color='CBD5E1'),
            right=Side(style='thin', color='CBD5E1'),
            top=Side(style='thin', color='CBD5E1'),
            bottom=Side(style='thin', color='CBD5E1')
        )

        # Title Block
        last_col_letter = get_column_letter(num_cols)
        ws.merge_cells(f'A1:{last_col_letter}1')
        ws['A1'] = "REGISTRUL EVIDENȚEI APARATELOR DE CASĂ VIRTUALE"
        ws['A1'].font = title_font
        ws['A1'].fill = title_fill
        ws['A1'].alignment = Alignment(horizontal='center', vertical='center')

        ws.merge_cells(f'A2:{last_col_letter}2')
        ws['A2'] = f"Generat la: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')} | Total inregistrari: {queryset.count()}"
        ws['A2'].font = subtitle_font
        ws['A2'].fill = title_fill
        ws['A2'].alignment = Alignment(horizontal='center', vertical='center')

        ws.row_dimensions[1].height = 40
        ws.row_dimensions[2].height = 20

        # Empty row
        ws.append([])

        # Table headers
        ws.append(headers)
        ws.row_dimensions[4].height = 26

        for col_idx in range(1, num_cols + 1):
            cell = ws.cell(row=4, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            cell.border = thin_border

        # Add data
        for row_idx, item in enumerate(queryset, 5):
            row_data = [col[1][1](item) for col in selected_columns]

            ws.append(row_data)
            ws.row_dimensions[row_idx].height = 22

            fill = alt_fill if row_idx % 2 == 0 else white_fill

            for col_idx in range(1, num_cols + 1):
                cell = ws.cell(row=row_idx, column=col_idx)
                cell.font = data_font
                cell.fill = fill
                cell.border = thin_border

                # Center alignment for short columns, left for long ones
                col_key = selected_columns[col_idx - 1][0]
                if col_key in ('adresa_ecc', 'denumire_entitate'):
                    cell.alignment = Alignment(horizontal='left', vertical='center')
                else:
                    cell.alignment = Alignment(horizontal='center', vertical='center')

        # Auto-fit columns
        for col_idx in range(1, num_cols + 1):
            col_letter = get_column_letter(col_idx)
            col_key = selected_columns[col_idx - 1][0]
            if col_key in ('adresa_ecc', 'denumire_entitate'):
                ws.column_dimensions[col_letter].width = 30
                continue
            max_len = 0
            for row_idx in range(4, ws.max_row + 1):
                cell = ws.cell(row=row_idx, column=col_idx)
                if cell.value:
                    max_len = max(max_len, len(str(cell.value)))
            ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

        buffer = BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        self._log_audit_event(
            action='export_virtual_ecc_excel',
            details={
                'count': queryset.count(),
                'columns': selected_keys,
                'oficiu': oficiu_param or '',
                'status': status_param or '',
            }
        )

        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response['Content-Disposition'] = f'attachment; filename="SIDESI_Echipamente_Virtuale_{timezone.now().strftime("%Y%m%d_%H%M%S")}.xlsx"'
        return response

    def _log_audit_event(self, action, details):
        ip = getattr(self.request, 'client_ip', '0.0.0.0')
        ua = getattr(self.request, 'user_agent', 'system')
        AuditLog.objects.create(
            user=self.request.user,
            username_display=self.request.user.username,
            action=action,
            module='virtual_ecc',
            ip_address=ip,
            user_agent=ua,
            details=details
        )


class RaionViewSet(viewsets.ModelViewSet):
    """CRUD ViewSet for Raion (districts) with ECC count annotation."""
    serializer_class = RaionSerializer
    permission_classes = [permissions.IsAuthenticated, HasGranularPermission]
    required_permission = 'virtual_ecc:view'
    pagination_class = None  # always return full list

    def get_queryset(self):
        return Raion.objects.annotate(ecc_count=Count('ecc_list')).order_by('name')

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            self.required_permission = 'virtual_ecc:manage'
        else:
            self.required_permission = 'virtual_ecc:view'
        return super().get_permissions()

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """Return each raion with its ECC count + unassigned count."""
        raioane = Raion.objects.annotate(ecc_count=Count('ecc_list')).order_by('name')
        unassigned = VirtualECC.objects.filter(raion__isnull=True).count()
        data = {
            'raioane': RaionSerializer(raioane, many=True).data,
            'unassigned': unassigned,
        }
        return Response(data)
