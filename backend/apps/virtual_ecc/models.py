import uuid
from django.db import models
from apps.vault.helpers import VaultCryptor


class Raion(models.Model):
    """Raion / zonă geografică pentru gruparea aparatelor ECC."""
    COLORS = [
        ('#3b82f6', 'Albastru'),
        ('#10b981', 'Verde'),
        ('#f59e0b', 'Galben'),
        ('#ef4444', 'Roșu'),
        ('#8b5cf6', 'Violet'),
        ('#ec4899', 'Roz'),
        ('#06b6d4', 'Cyan'),
        ('#f97316', 'Portocaliu'),
        ('#84cc16', 'Lime'),
        ('#64748b', 'Gri'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True, verbose_name='Denumire raion')
    code = models.CharField(max_length=20, unique=True, verbose_name='Cod raion')
    color = models.CharField(max_length=7, default='#3b82f6', verbose_name='Culoare UI')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Raion'
        verbose_name_plural = 'Raioane'

    def __str__(self):
        return f'{self.name} ({self.code})'


class VirtualECC(models.Model):
    STATUS_CHOICES = [
        ('neconfigurat', 'Neconfigurat'),
        ('aplicatie_instalata', 'Aplicație instalată'),
        ('in_certificare', 'În certificare'),
        ('certificat', 'Certificat'),
        ('eroare_certificare', 'Eroare la certificare'),
        ('pus_in_exploatare', 'Pus în exploatare'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    terminal_id = models.CharField(max_length=100, unique=True, db_index=True, verbose_name='ID Terminal')
    oficiu = models.CharField(max_length=100, db_index=True, verbose_name='Oficiu')
    raion = models.ForeignKey(
        Raion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ecc_list',
        verbose_name='Raion',
    )
    tel_oficiu = models.CharField(max_length=50, blank=True, null=True, verbose_name='Telefon Oficiu')
    nr_inregistrare_sfs = models.CharField(max_length=100, blank=True, null=True, verbose_name='Nr. înregistrare SFS')
    nr_ordine = models.CharField(max_length=100, blank=True, null=True, verbose_name='Număr de ordine')
    data_inregistrare = models.DateField(blank=True, null=True, verbose_name='Data înregistrării')
    denumire_entitate = models.CharField(max_length=255, blank=True, null=True, verbose_name='Denumire entitate')
    idno = models.CharField(max_length=50, blank=True, null=True, verbose_name='IDNO')
    model_ecc = models.CharField(max_length=100, blank=True, null=True, verbose_name='Model ECC')
    adresa_ecc = models.TextField(blank=True, null=True, verbose_name='Adresă ECC')
    ip_adresa = models.CharField(max_length=50, blank=True, null=True, verbose_name='IP Adresă')
    encrypted_mev_key = models.TextField(blank=True, null=True, verbose_name='Cheie MEV Criptată')
    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default='neconfigurat',
        verbose_name='Statut'
    )
    comentarii = models.TextField(blank=True, null=True, verbose_name='Comentarii')
    pdf_file = models.FileField(upload_to='virtual_ecc_pdfs/', blank=True, null=True, verbose_name='Fișier PDF înregistrare')
    z_raport = models.BooleanField(default=False, db_index=True, verbose_name='Z Raport')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['oficiu', 'terminal_id']
        verbose_name = 'Echipament de Casă Virtual'
        verbose_name_plural = 'Echipamente de Casă Virtuale'

    def set_mev_key(self, plain_key: str) -> None:
        """Encrypt and store MEV key."""
        cleaned = str(plain_key).strip() if plain_key else ''
        if cleaned and cleaned not in ['—', '-', '–', 'N/A', 'n/a', 'null', 'None']:
            cryptor = VaultCryptor()
            self.encrypted_mev_key = cryptor.encrypt(cleaned)
        else:
            self.encrypted_mev_key = None

    def get_mev_key(self) -> str:
        """Decrypt and return plain text MEV key."""
        if not self.encrypted_mev_key:
            return ''
        cryptor = VaultCryptor()
        try:
            val = cryptor.decrypt(self.encrypted_mev_key)
            if not val or val.strip() in ['—', '-', '–', 'N/A', 'n/a', 'null', 'None']:
                return ''
            return val.strip()
        except Exception:
            return 'Decryption Error'

    def __str__(self):
        return f'{self.terminal_id} - {self.oficiu} ({self.status})'
