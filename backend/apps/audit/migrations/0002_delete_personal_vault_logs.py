from django.db import migrations

def delete_personal_vault_logs(apps, schema_editor):
    AuditLog = apps.get_model('audit', 'AuditLog')
    AuditLog.objects.filter(module='personal_vault').delete()

class Migration(migrations.Migration):

    dependencies = [
        ('audit', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(delete_personal_vault_logs, reverse_code=migrations.RunPython.noop),
    ]
