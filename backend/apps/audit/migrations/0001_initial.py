from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('authentication', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='AuditLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('username_display', models.CharField(db_index=True, max_length=150)),
                ('action', models.CharField(db_index=True, max_length=100)),
                ('module', models.CharField(db_index=True, max_length=100)),
                ('ip_address', models.CharField(db_index=True, max_length=45)),
                ('user_agent', models.CharField(max_length=512)),
                ('details', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('user', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=models.deletion.SET_NULL,
                    related_name='audit_logs',
                    to='authentication.user'
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
