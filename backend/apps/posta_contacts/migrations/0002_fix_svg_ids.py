from django.db import migrations


def fix_svg_ids(apps, schema_editor):
    Raion = apps.get_model('posta_contacts', 'Raion')
    mapping = {
        'Anenii Noi': 'md-an',
        'Basarabeasca': 'md-bs',
        'Bender': 'md-be',
        'Briceni': 'md-br',
        'Bălți': 'md-bl',
        'Cahul': 'md-ca',
        'Cantemir': 'md-ct',
        'Chișinău': 'md-c',
        'Cimișlia': 'md-cm',
        'Criuleni': 'md-cr',
        'Călărași': 'md-cl',
        'Căușeni': 'md-cs',
        'Dondușeni': 'md-dn',
        'Drochia': 'md-dr',
        'Dubăsari': 'md-db',
        'Edineț': 'md-ed',
        'Florești': 'md-fr',
        'Fălești': 'md-fl',
        'Glodeni': 'md-gl',
        'Hîncești': 'md-hn',
        'Ialoveni': 'md-il',
        'Leova': 'md-lv',
        'Nisporeni': 'md-ns',
        'Ocnița': 'md-oc',
        'Orhei': 'md-or',
        'Rezina': 'md-rz',
        'Rîșcani': 'md-rs',
        'Soroca': 'md-sr',
        'Strășeni': 'md-st',
        'Sîngerei': 'md-sg',
        'Taraclia': 'md-ta',
        'Telenești': 'md-tl',
        'Ungheni': 'md-un',
        'Șoldănești': 'md-sd',
        'Ștefan Vodă': 'md-sv',
        'UTAG Găgăuzia': 'md-utag',
        'Transnistria': 'md-utsn',
    }
    for name, svg_id in mapping.items():
        Raion.objects.filter(name=name).update(svg_id=svg_id)


class Migration(migrations.Migration):

    dependencies = [
        ('posta_contacts', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(fix_svg_ids, migrations.RunPython.noop),
    ]
