from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('authentication', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='PersonalVault',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(db_index=True, max_length=255)),
                ('login_username', models.CharField(blank=True, max_length=255, null=True)),
                ('encrypted_password', models.TextField(blank=True, null=True)),
                ('url', models.CharField(blank=True, max_length=512, null=True)),
                ('notes', models.TextField(blank=True, null=True)),
                ('category', models.CharField(
                    choices=[
                        ('login', 'Autentificare / Logins'),
                        ('note', 'Note Sigure'),
                        ('link', 'Link-uri Rapide'),
                        ('card', 'Carduri Bancare'),
                    ],
                    db_index=True,
                    default='login',
                    max_length=50
                )),
                ('is_favorite', models.BooleanField(db_index=True, default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name='personal_secrets',
                    to='authentication.user'
                )),
            ],
        ),
    ]
