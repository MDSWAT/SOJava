import re
import unicodedata
from pathlib import Path

import openpyxl
from django.core.management.base import BaseCommand, CommandError

from apps.posta_contacts.models import Raion, ContactOficiu


def norm(text) -> str:
    """Lowercase, strip diacritics (both comma and cedilla forms), collapse spaces."""
    if not text:
        return ''
    t = unicodedata.normalize('NFD', str(text).strip().lower())
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', t)


# normalized DB raion names are built dynamically; these aliases map
# extra names found in the file to DB raion normalized names
ALIASES = {
    'comrat': 'utag gagauzia',
    'vulcanesti': 'utag gagauzia',
    'ceadir-lunga': 'utag gagauzia',
    'ceadir lunga': 'utag gagauzia',
    'gagauzia': 'utag gagauzia',
    'uta gagauzia': 'utag gagauzia',
    'tiraspol': 'transnistria',
    'ribnita': 'transnistria',
    'slobozia': 'transnistria',
    'camenca': 'transnistria',
    'donduseni (ocnita)': 'donduseni',
}


def clean_office_name(name: str) -> str:
    """Strip trailing '(Raion)' parens and ' old' markers from office name."""
    n = str(name).strip()
    n = re.sub(r'\s*\([^)]*\)\s*$', '', n).strip()
    n = re.sub(r'\s+old\s*$', '', n, flags=re.IGNORECASE).strip()
    return n


def extract_raion_key(name: str, addr: str, raione_keys: list) -> str | None:
    """Extract normalized raion key from office name / address."""
    # 1. r-nul X at end of address
    m = re.search(r'r[-.\s]?n(?:ul)?\.?\s+(.+?)\s*[,;]?\s*$', addr)
    if m:
        return norm(m.group(1))
    # 2. mun. X at end of address
    m = re.search(r'mun[.,]?\s+(.+?)\s*[,;]?\s*$', addr)
    if m:
        return norm(m.group(1))
    # 3. raion name anywhere in address (e.g. 'or. Cahul, str. ...')
    naddr = norm(addr)
    for key in raione_keys:
        if re.search(r'(?<![a-z])' + re.escape(key) + r'(?![a-z])', naddr):
            return key
    # 4. raion name in office name (e.g. 'AP3982 Cahul', 'OP5351 Cismichioi (Comrat)')
    nname = norm(name)
    for key in raione_keys:
        if re.search(r'(?<![a-z])' + re.escape(key) + r'(?![a-z])', nname):
            return key
    # 5. aliases in name/address (comrat, vulcanesti...)
    for alias, target in ALIASES.items():
        if re.search(r'(?<![a-z])' + re.escape(alias) + r'(?![a-z])', nname) or \
           re.search(r'(?<![a-z])' + re.escape(alias) + r'(?![a-z])', naddr):
            return target
    return None


class Command(BaseCommand):
    help = 'Importă oficii poștale din fișierul Excel (date op.xlsx)'

    def add_arguments(self, parser):
        parser.add_argument('file', type=str, help='Calea către fișierul .xlsx')
        parser.add_argument('--dry-run', action='store_true', help='Doar validează, nu scrie în DB')
        parser.add_argument('--clear', action='store_true', help='Șterge contactele de tip oficiu înainte de import')

    def handle(self, *args, **options):
        file_path = Path(options['file'])
        if not file_path.exists():
            raise CommandError(f'Fișierul nu există: {file_path}')

        wb = openpyxl.load_workbook(file_path, data_only=True)
        ws = wb.active

        # raion lookup: normalized name -> Raion
        raioane = {norm(r.name): r for r in Raion.objects.all()}
        raione_keys = sorted(raioane.keys(), key=len, reverse=True)  # longest first (e.g. 'anenii noi' before 'aneni')
        alias_targets = {k: v for k, v in ALIASES.items() if v in raioane}

        if options['clear'] and not options['dry_run']:
            deleted, _ = ContactOficiu.objects.filter(tip='oficiu').delete()
            self.stdout.write(self.style.WARNING(f'Șterse {deleted} contacte oficiu existente.'))

        created, updated, skipped = 0, 0, 0
        errors = []
        seen = set()  # (raion_id, cleaned_oficiu) to skip duplicates within file

        for row in ws.iter_rows(min_row=1, values_only=True):
            name_raw, _code, addr_raw, phone_raw = (list(row) + [None, None, None, None])[:4]
            if not name_raw:
                continue
            name = str(name_raw).strip()
            addr = str(addr_raw).strip() if addr_raw else ''
            phone = str(phone_raw).strip() if phone_raw else None

            key = extract_raion_key(name, addr, raione_keys + list(alias_targets.keys()))
            if not key:
                errors.append(f'Nedetectat raion: "{name}" | "{addr[:60]}"')
                skipped += 1
                continue
            key = alias_targets.get(key, key)
            # prefix fallback for truncated names in source (e.g. 'Dondusen')
            if key not in raioane and len(key) >= 5:
                prefix_hits = [rk for rk in raione_keys if rk.startswith(key)]
                if len(prefix_hits) == 1:
                    key = prefix_hits[0]

            raion = raioane.get(key)
            if not raion:
                errors.append(f'Raion necunoscut "{key}" pentru: "{name}"')
                skipped += 1
                continue

            oficiu = clean_office_name(name)
            dedup = (str(raion.id), norm(oficiu))
            if dedup in seen:
                skipped += 1
                continue
            seen.add(dedup)

            if options['dry_run']:
                created += 1
                continue

            _obj, was_created = ContactOficiu.objects.update_or_create(
                raion=raion,
                tip='oficiu',
                oficiu=oficiu,
                defaults={
                    'nume': oficiu,
                    'prenume': '',
                    'telefon': phone,
                    'adresa': addr or None,
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1

        mode = 'DRY-RUN' if options['dry_run'] else 'IMPORT'
        self.stdout.write(self.style.SUCCESS(
            f'{mode} finalizat: {created} create, {updated} actualizate, {skipped} ignorate/duplicate.'
        ))
        if errors:
            self.stdout.write(self.style.WARNING(f'Erori ({len(errors)}):'))
            for err in errors[:60]:
                self.stdout.write(f'  - {err}')

        # summary per raion
        self.stdout.write('')
        self.stdout.write('Oficii per raion (în DB după import):')
        if not options['dry_run']:
            for r in Raion.objects.all():
                cnt = r.contacts.filter(tip='oficiu').count()
                if cnt:
                    self.stdout.write(f'  {cnt:4d}  {r.name}')