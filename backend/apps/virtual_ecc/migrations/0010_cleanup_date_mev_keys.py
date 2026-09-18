import re
from django.db import migrations
from apps.vault.helpers import VaultCryptor


def cleanup_date_mev_keys(apps, schema_editor):
    VirtualECC = apps.get_model('virtual_ecc', 'VirtualECC')
    cryptor = VaultCryptor()
    to_clear = []

    # Matches dates/timestamps like 2026-07-17, 2026-07-17 12:49, 17.07.2026, etc.
    date_pattern = re.compile(
        r'^\d{4}[-/]\d{2}[-/]\d{2}(\s+\d{2}:\d{2}(:\d{2})?)?$|^\d{2}[./-]\d{2}[./-]\d{4}(\s+\d{2}:\d{2}(:\d{2})?)?$'
    )

    for ecc in VirtualECC.objects.exclude(encrypted_mev_key__isnull=True).exclude(encrypted_mev_key=''):
        try:
            decrypted = cryptor.decrypt(ecc.encrypted_mev_key)
            if not decrypted:
                to_clear.append(ecc.pk)
                continue
            cleaned = decrypted.strip()
            if cleaned in ['—', '-', '–', 'N/A', 'n/a', 'null', 'None'] or date_pattern.match(cleaned):
                to_clear.append(ecc.pk)
        except Exception:
            to_clear.append(ecc.pk)

    if to_clear:
        VirtualECC.objects.filter(pk__in=to_clear).update(encrypted_mev_key=None)


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('virtual_ecc', '0009_virtualecc_comentarii'),
    ]

    operations = [
        migrations.RunPython(cleanup_date_mev_keys, reverse_noop),
    ]
