from django.db import migrations

def remove_vault_view_from_user(apps, schema_editor):
    Role = apps.get_model('authentication', 'Role')
    Permission = apps.get_model('authentication', 'Permission')
    
    try:
        user_role = Role.objects.get(name='User')
        try:
            vault_view = Permission.objects.get(code='vault:view')
            user_role.permissions.remove(vault_view)
        except Permission.DoesNotExist:
            pass
    except Role.DoesNotExist:
        pass

def add_vault_view_back_to_user(apps, schema_editor):
    Role = apps.get_model('authentication', 'Role')
    Permission = apps.get_model('authentication', 'Permission')
    
    try:
        user_role = Role.objects.get(name='User')
        try:
            vault_view = Permission.objects.get(code='vault:view')
            user_role.permissions.add(vault_view)
        except Permission.DoesNotExist:
            pass
    except Role.DoesNotExist:
        pass

class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(remove_vault_view_from_user, reverse_code=add_vault_view_back_to_user),
    ]
