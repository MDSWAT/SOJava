import uuid
from django.db import models


class Raion(models.Model):
    """Raion (district) of Moldova — used for map interaction."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True, verbose_name="Denumire Raion")
    code = models.CharField(max_length=20, unique=True, verbose_name="Cod Raion")
    # SVG path id for linking to the map element
    svg_id = models.CharField(max_length=50, unique=True, verbose_name="SVG ID")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Raion'
        verbose_name_plural = 'Raioane'

    def __str__(self):
        return self.name


class ContactOficiu(models.Model):
    """Contact person at a post office within a raion, or a district engineer."""
    TIP_CHOICES = [
        ('inginer', 'Inginer raional'),
        ('oficiu', 'Contact oficiu'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    raion = models.ForeignKey(Raion, on_delete=models.CASCADE, related_name='contacts', verbose_name="Raion")
    tip = models.CharField(max_length=20, choices=TIP_CHOICES, default='oficiu', db_index=True, verbose_name="Tip contact")
    ordine = models.IntegerField(default=0, verbose_name="Ordine afișare")
    oficiu = models.CharField(max_length=150, blank=True, null=True, verbose_name="Oficiu Poștal")
    nume = models.CharField(max_length=100, verbose_name="Nume")
    prenume = models.CharField(max_length=100, blank=True, default='', verbose_name="Prenume")
    functie = models.CharField(max_length=150, blank=True, null=True, verbose_name="Funcție")
    telefon = models.CharField(max_length=50, blank=True, null=True, verbose_name="Telefon")
    email = models.EmailField(blank=True, null=True, verbose_name="Email")
    adresa = models.TextField(blank=True, null=True, verbose_name="Adresă")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # 'inginer' < 'oficiu' alfabetic → inginerii mereu primii în listă
        ordering = ['tip', 'ordine', 'oficiu', 'nume']
        verbose_name = 'Contact Oficiu'
        verbose_name_plural = 'Contacte Oficii'

    def __str__(self):
        target = self.oficiu or self.raion.name
        return f"{self.nume} {self.prenume} — {target} ({self.raion.name})"
