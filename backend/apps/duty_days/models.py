import uuid
from django.db import models
from django.conf import settings


class CalendarEvent(models.Model):
    """
    Eveniment / anunț / meeting pentru tab-ul Calendar.
    Creat și gestionat de Super Admin.
    """
    EVENT_TYPE_CHOICES = [
        ('announcement', 'Anunț'),
        ('meeting', 'Ședință'),
        ('reminder', 'Reminder'),
        ('other', 'Altele'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    event_date = models.DateField(db_index=True)
    event_type = models.CharField(max_length=20, choices=EVENT_TYPE_CHOICES, default='announcement')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='created_calendar_events'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['event_date', 'created_at']
        verbose_name = 'Eveniment Calendar'
        verbose_name_plural = 'Evenimente Calendar'

    def __str__(self):
        return f"{self.event_date.strftime('%d.%m.%Y')} — {self.title}"


class SaturdayDuty(models.Model):
    """
    O sâmbătă de serviciu disponibilă, creată de Super Admin.
    Angajații pot alege (book) una din lista disponibilă.
    O sâmbătă = maxim 1 angajat (unicitate garantată prin SaturdayBooking).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date = models.DateField(unique=True, db_index=True)
    label = models.CharField(
        max_length=200, blank=True, default='',
        help_text='Ex: Sâmbătă recuperare T1 2026'
    )
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_saturday_duties'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date']
        verbose_name = 'Sâmbătă de Serviciu'
        verbose_name_plural = 'Sâmbete de Serviciu'

    def __str__(self):
        label = self.label or 'Sâmbătă de serviciu'
        return f"{self.date.strftime('%d.%m.%Y')} — {label}"

    @property
    def is_booked(self):
        return self.bookings.exists()

    @property
    def booked_by(self):
        booking = self.bookings.select_related('user').first()
        return booking.user if booking else None


class SaturdayBooking(models.Model):
    """
    Rezervarea unei sâmbete de serviciu de către un angajat.
    Un angajat poate rezerva o singură sâmbătă la un moment dat per sâmbătă.
    O sâmbătă poate fi rezervată de maxim 1 persoană.
    """
    COMP_OPTION_CHOICES = [
        ('recovery', 'Recuperare zi lipsă'),
        ('decide_later', 'Decide mai târziu'),
        ('free_day', 'Zi liberă'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    saturday = models.ForeignKey(
        SaturdayDuty, on_delete=models.CASCADE, related_name='bookings'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='saturday_bookings'
    )
    comp_option = models.CharField(
        max_length=20, choices=COMP_OPTION_CHOICES, default='decide_later'
    )
    recovery_date = models.DateField(null=True, blank=True)
    booked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('saturday', 'user')
        ordering = ['saturday__date']
        verbose_name = 'Rezervare Sâmbătă'
        verbose_name_plural = 'Rezervări Sâmbete'

    def __str__(self):
        return f"{self.user.username} → {self.saturday.date.strftime('%d.%m.%Y')}"


class UserDutyBalance(models.Model):
    """
    Balanța zilelor de serviciu per angajat.

    days_to_recover:   Zile lipsite (sâmbete ratate ce trebuie recuperate prin muncă)
    free_days_available: Zile libere disponibile (sâmbete lucrate, neluate ca zi liberă)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='duty_balance'
    )
    days_to_recover = models.IntegerField(
        default=0,
        help_text='Zile lipsite — sâmbete ratate ce trebuie recuperate (lucrate)'
    )
    free_days_available = models.IntegerField(
        default=0,
        help_text='Zile libere disponibile — sâmbete lucrate ce nu au fost luate ca liber'
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Balanță Serviciu'
        verbose_name_plural = 'Balanțe Serviciu'

    def __str__(self):
        return (
            f"{self.user.username}: "
            f"Lipsite={self.days_to_recover}, "
            f"Libere={self.free_days_available}"
        )


class DutyActivityLog(models.Model):
    """
    Jurnal de activitate pentru modulul Evidența Zilelor de Serviciu.
    Înregistrează toate acțiunile: rezervări, anulări, zile libere luate, ajustări admin, concedii etc.
    """
    ACTION_CHOICES = [
        ('saturday_booked', 'A ales sâmbăta de serviciu'),
        ('saturday_cancelled', 'A anulat sâmbăta de serviciu'),
        ('free_day_taken', 'A marcat o zi liberă ca luată'),
        ('balance_adjusted', 'Admin a ajustat balanța'),
        ('saturday_created', 'Admin a creat o sâmbătă'),
        ('saturday_deleted', 'Admin a șters o sâmbătă'),
        ('event_created', 'Admin a creat un eveniment în calendar'),
        ('event_deleted', 'Admin a șters un eveniment din calendar'),
        ('leave_added', 'A adăugat o cerere de concediu'),
        ('leave_approved', 'Concediu aprobat'),
        ('leave_rejected', 'Concediu respins'),
        ('leave_cancelled', 'Concediu anulat/șters'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='duty_activity_logs',
        help_text='Utilizatorul vizat de acțiune (despre cine e vorba)'
    )
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='duty_actions_performed',
        help_text='Cine a efectuat acțiunea (dacă admin a acționat pentru alt user)'
    )
    action = models.CharField(max_length=30, choices=ACTION_CHOICES, db_index=True)
    saturday = models.ForeignKey(
        SaturdayDuty, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='activity_logs',
        help_text='Sâmbăta implicată în acțiune (dacă e cazul)'
    )
    free_day_date = models.DateField(
        null=True, blank=True,
        help_text='Data zilei libere luate (pentru acțiunea free_day_taken)'
    )
    details = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Jurnal Activitate Serviciu'
        verbose_name_plural = 'Jurnale Activitate Serviciu'

    def __str__(self):
        actor = self.user.username if self.user else 'unknown'
        return f"[{self.action}] {actor} — {self.created_at.strftime('%d.%m.%Y %H:%M')}"


class LeaveRequest(models.Model):
    """
    Cerere de concediu a unui angajat.
    Tipuri: odihnă, studii, medical, fără plată, altul.
    Status flow: draft → pending → approved / rejected
    Super Admin adaugă direct ca 'approved'.
    """
    LEAVE_TYPE_CHOICES = [
        ('rest',    'Concediu de Odihnă'),
        ('study',   'Concediu de Studii'),
        ('medical', 'Concediu Medical'),
        ('unpaid',  'Concediu Fără Plată'),
        ('other',   'Alt Concediu'),
    ]
    STATUS_CHOICES = [
        ('draft',    'Ciornă'),
        ('pending',  'În Așteptare'),
        ('approved', 'Aprobat'),
        ('rejected', 'Respins'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='leave_requests',
        help_text='Angajatul pentru care este cererea de concediu'
    )
    leave_type = models.CharField(
        max_length=20, choices=LEAVE_TYPE_CHOICES, default='rest',
        db_index=True
    )
    start_date = models.DateField(db_index=True)
    end_date = models.DateField(db_index=True)
    notes = models.TextField(blank=True, default='')
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='approved',
        db_index=True
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_leave_requests',
        help_text='Cine a creat cererea (poate fi admin pt alt user)'
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='approved_leave_requests'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_date']
        verbose_name = 'Cerere Concediu'
        verbose_name_plural = 'Cereri Concediu'
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['start_date', 'end_date']),
        ]

    def __str__(self):
        return (
            f"{self.user.username} — {self.get_leave_type_display()} "
            f"({self.start_date.strftime('%d.%m.%Y')} → {self.end_date.strftime('%d.%m.%Y')})"
        )

    @property
    def duration_days(self):
        """Calendar days (inclusive)."""
        return (self.end_date - self.start_date).days + 1


# ─── Signal: auto-create UserDutyBalance when a new user is created ───
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_duty_balance(sender, instance, created, **kwargs):
    if created:
        UserDutyBalance.objects.get_or_create(user=instance)

