from django.db import migrations
from apps.vault.helpers import VaultCryptor


def cleanup_invalid_mev_keys(apps, schema_editor):
    VirtualECC = apps.get_model('virtual_ecc', 'VirtualECC')
    cryptor = VaultCryptor()
    to_clear = []

    for ecc in VirtualECC.objects.exclude(encrypted_mev_key__isnull=True).exclude(encrypted_mev_key=''):
        try:
            decrypted = cryptor.decrypt(ecc.encrypted_mev_key)
            if not decrypted or decrypted.strip() in ['—', '-', '–', 'N/A', 'n/a', 'null', 'None']:
                to_clear.append(ecc.pk)
        except Exception:
            to_clear.append(ecc.pk)

    if to_clear:
        VirtualECC.objects.filter(pk__in=to_clear).update(encrypted_mev_key=None)


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('virtual_ecc', '0007_alter_virtualecc_status'),
    ]

    operations = [
        migrations.RunPython(cleanup_invalid_mev_keys, reverse_noop),
    ]
