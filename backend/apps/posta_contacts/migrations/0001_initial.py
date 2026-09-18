from django.db import migrations, models
import uuid


def create_raioane(apps, schema_editor):
    Raion = apps.get_model('posta_contacts', 'Raion')
    raioane = [
        ("Anenii Noi", "MDAN", "md-an"),
        ("Basarabeasca", "MDBS", "md-bs"),
        ("Bender", "MDBD", "md-bd"),
        ("Briceni", "MDBR", "md-br"),
        ("Bălți", "MDBA", "md-ba"),
        ("Cahul", "MDCA", "md-ca"),
        ("Cantemir", "MDCT", "md-ct"),
        ("Chișinău", "MDCU", "md-cu"),
        ("Cimișlia", "MDCM", "md-cm"),
        ("Criuleni", "MDCR", "md-cr"),
        ("Călărași", "MDCL", "md-cl"),
        ("Căușeni", "MDCS", "md-cs"),
        ("Dondușeni", "MDDO", "md-do"),
        ("Drochia", "MDDR", "md-dr"),
        ("Dubăsari", "MDDU", "md-du"),
        ("Edineț", "MDED", "md-ed"),
        ("Florești", "MDFL", "md-fl"),
        ("Fălești", "MDFA", "md-fa"),
        ("Glodeni", "MDGL", "md-gl"),
        ("Hîncești", "MDHI", "md-hi"),
        ("Ialoveni", "MDIA", "md-ia"),
        ("Leova", "MDLE", "md-le"),
        ("Nisporeni", "MDNI", "md-ni"),
        ("Ocnița", "MDOC", "md-oc"),
        ("Orhei", "MDOR", "md-or"),
        ("Rezina", "MDRE", "md-re"),
        ("Rîșcani", "MDRI", "md-ri"),
        ("Soroca", "MDSO", "md-so"),
        ("Strășeni", "MDST", "md-st"),
        ("Sîngerei", "MDSI", "md-si"),
        ("Taraclia", "MDTA", "md-ta"),
        ("Telenești", "MDTE", "md-te"),
        ("Ungheni", "MDUN", "md-un"),
        ("Șoldănești", "MDSD", "md-sd"),
        ("Ștefan Vodă", "MDSV", "md-sv"),
        ("UTAG Găgăuzia", "MDGA", "md-ga"),
        ("Transnistria", "MDSN", "md-sn"),
    ]
    for name, code, svg_id in raioane:
        Raion.objects.create(name=name, code=code, svg_id=svg_id)


def delete_raioane(apps, schema_editor):
    Raion = apps.get_model('posta_contacts', 'Raion')
    Raion.objects.all().delete()


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Raion',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=100, unique=True, verbose_name='Denumire Raion')),
                ('code', models.CharField(max_length=20, unique=True, verbose_name='Cod Raion')),
                ('svg_id', models.CharField(max_length=50, unique=True, verbose_name='SVG ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Raion',
                'verbose_name_plural': 'Raioane',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='ContactOficiu',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('oficiu', models.CharField(max_length=150, verbose_name='Oficiu Poștal')),
                ('nume', models.CharField(max_length=100, verbose_name='Nume')),
                ('prenume', models.CharField(max_length=100, verbose_name='Prenume')),
                ('functie', models.CharField(blank=True, max_length=150, null=True, verbose_name='Funcție')),
                ('telefon', models.CharField(blank=True, max_length=50, null=True, verbose_name='Telefon')),
                ('email', models.EmailField(blank=True, max_length=254, null=True, verbose_name='Email')),
                ('adresa', models.TextField(blank=True, null=True, verbose_name='Adresă')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('raion', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='contacts', to='posta_contacts.raion', verbose_name='Raion')),
            ],
            options={
                'verbose_name': 'Contact Oficiu',
                'verbose_name_plural': 'Contacte Oficii',
                'ordering': ['oficiu', 'nume'],
            },
        ),
        migrations.RunPython(create_raioane, delete_raioane),
    ]
