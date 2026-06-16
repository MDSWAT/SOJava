from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('organizations', '0001_initial'),
        ('authentication', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='PasswordVault',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(db_index=True, max_length=255)),
                ('login_username', models.CharField(max_length=255)),
                ('encrypted_password', models.TextField()),
                ('associated_email', models.CharField(blank=True, max_length=255, null=True)),
                ('last_accessed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('deleted_at', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('organization', models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name='vaults',
                    to='organizations.organization'
                )),
                ('created_by', models.ForeignKey(
                    on_delete=models.deletion.PROTECT,
                    related_name='created_passwords',
                    to='authentication.user'
                )),
                ('modified_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=models.deletion.PROTECT,
                    related_name='modified_passwords',
                    to='authentication.user'
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
