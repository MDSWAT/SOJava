from django.db import migrations


INGINERI = [
    # (raion_db_name, telefon, email, nume, prenume, functie_extra)
    ('Anenii Noi', '672 51 091', 'serghei.eni@posta.md', 'Eni', 'Serghei', None),
    ('Bălți', '799 24 617', 'serghei.movila@posta.md', 'Movilă', 'Sergiu', None),
    ('Glodeni', '690 58 048', 'margarita.josanu@posta.md', 'Josanu', 'Margarita', None),
    ('Fălești', '799 24 661', 'iulia.russu@posta.md', 'Russu', 'Iulia', None),
    ('Briceni', '672 51 122, 247 22 041', 'it.briceni@posta.md, igor.muzica@posta.md', 'Muzica', 'Igor', None),
    ('Cahul', '672 51 444, 299 20 633', 'cahul@posta.md', 'Grigorenco', 'Alexei', None),
    ('Călărași', '621 87 237, 244 22 601', 'larisa.arman@posta.md', 'Arman', 'Larisa', None),
    ('Cantemir', '799 24 461', 'it.cantemir@posta.md', 'Ursachi', 'Daniel', None),
    ('Căușeni', '672 51 100', 'vasile.arpenti@posta.md', 'Arpenti', 'Vasile', None),
    ('UTAG Găgăuzia', '621 87 297', 'iurii.slavioglo@posta.md', 'Slavioglo', 'Iurii', 'Inginer raional (Ceadîr Lunga)'),
    ('Cimișlia', '799 24 463', 'constantin.prodan@posta.md', 'Prodan', 'Constantin', None),
    ('UTAG Găgăuzia', '799 24 777', 'it.comrat@posta.md', 'Buzilov', 'Victor', 'Inginer raional (Comrat)'),
    ('Criuleni', '799 24 502', 'victoria.chelari@posta.md', 'Chelari', 'Victoria', None),
    ('Drochia', '796 48 400, 252 23 677', 'dorian.conea@posta.md', 'Conea', 'Dorian', None),
    ('Edineț', '799 24 653', 'victor.simionca@posta.md', 'Simionca', 'Victor', None),
    ('Florești', '799 24 662', 'andrei.suhari@posta.md; it.floresti@posta.md', 'Suhari', 'Andrei', None),
    ('Hîncești', '795 51 227', 'viorel.gaburici@posta.md', 'Gaburici', 'Viorel', None),
    ('Ialoveni', '799 24 496', 'vladimir.nadeev@posta.md', 'Nadeev', 'Vladimir', None),
    ('Leova', '799 24 267', 'sergiu.polesciuc@posta.md', 'Polesciuc', 'Sergiu', None),
    ('Nisporeni', '672 51 221, 264 23 251', 'alexandrina.botez@posta.md', 'Botez', 'Alexandrina', None),
    ('Orhei', '621 87 260', 'sergiu.melnic@posta.md', 'Melnic', 'Sergiu', None),
    ('Ocnița', '799 24 684', 'iurii.paliuc@posta.md', 'Paliuc', 'Iurii', None),
    ('Dondușeni', '799 00 894', 'sergiu.sandu@posta.md', 'Sandu', 'Sergiu', None),
    ('Rezina', '799 24 351', 'marin.cretu@posta.md', 'Crețu', 'Marin', None),
    ('Șoldănești', '799 24 347', 'oleg.sedoi@posta.md', 'Sedoi', 'Oleg', None),
    ('Rîșcani', '672 51 209, 256 22 388, 689 21 098', 'ilie.druc@posta.md', 'Druc', 'Ilie', None),
    ('Sîngerei', '799 24 166', 'mihail.andriuta@posta.md', 'Andriuta', 'Mihail', None),
    ('Soroca', '796 48 692, 699 89 453', 'violeta.cobozev@posta.md', 'Cobozev', 'Violeta', None),
    ('Ștefan Vodă', '799 24 360', 'igor.galaci@posta.md', 'Galaci', 'Igor', None),
    ('Strășeni', '799 24 188', 'vladislav.codreanu@posta.md', 'Codreanu', 'Vladislav', None),
    ('Taraclia', '799 24 363', 'elena.bairictar@posta.md', 'Bairictar', 'Elena', None),
    ('Ungheni', '799 24 213', 'petru.lisenco@posta.md; it.ungheni@posta.md', 'Lisenco', 'Petru', None),
]


def add_ingineri(apps, schema_editor):
    Raion = apps.get_model('posta_contacts', 'Raion')
    ContactOficiu = apps.get_model('posta_contacts', 'ContactOficiu')
    for raion_name, telefon, email, nume, prenume, functie in INGINERI:
        try:
            raion = Raion.objects.get(name=raion_name)
        except Raion.DoesNotExist:
            continue
        ContactOficiu.objects.update_or_create(
            raion=raion,
            tip='inginer',
            nume=nume,
            prenume=prenume,
            defaults={
                'telefon': telefon,
                'email': email,
                'functie': functie or 'Inginer raional',
                'oficiu': None,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ('posta_contacts', '0004_alter_contactoficiu_prenume'),
    ]

    operations = [
        migrations.RunPython(add_ingineri, migrations.RunPython.noop),
    ]
