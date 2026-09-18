from django.db import migrations


def seed_permissions(apps, schema_editor):
    Permission = apps.get_model('authentication', 'Permission')
    Role = apps.get_model('authentication', 'Role')

    # 1. Create permissions
    permissions_data = [
        ('virtual_ecc:view', 'virtual_ecc', 'Vizualizare Echipamente de Casă Virtuale'),
        ('virtual_ecc:manage', 'virtual_ecc', 'Administrare Echipamente de Casă Virtuale'),
        ('virtual_ecc:reveal', 'virtual_ecc', 'Dezvăluire Cheie MEV'),
    ]

    created_perms = []
    for code, module, desc in permissions_data:
        perm, _ = Permission.objects.get_or_create(
            code=code,
            defaults={'module': module, 'description': desc}
        )
        created_perms.append(perm)

    # 2. Add to Super Admin role if it exists
    try:
        super_admin = Role.objects.get(name='Super Admin')
        for perm in created_perms:
            super_admin.permissions.add(perm)
    except Role.DoesNotExist:
        pass


def remove_permissions(apps, schema_editor):
    Permission = apps.get_model('authentication', 'Permission')
    codes = ['virtual_ecc:view', 'virtual_ecc:manage', 'virtual_ecc:reveal']
    Permission.objects.filter(code__in=codes).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('virtual_ecc', '0001_initial'),
        ('authentication', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_permissions, reverse_code=remove_permissions),
    ]
