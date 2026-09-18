from datetime import date as date_cls
from io import BytesIO
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from apps.duty_days.models import (
    CalendarEvent, SaturdayDuty, SaturdayBooking,
    UserDutyBalance, DutyActivityLog, LeaveRequest
)
from apps.duty_days.serializers import (
    CalendarEventSerializer, SaturdayDutySerializer,
    UserDutyBalanceSerializer, DutyActivityLogSerializer,
    UserBalanceKPISerializer, LeaveRequestSerializer
)
from apps.audit.models import AuditLog

User = get_user_model()


# ─── Permission Helpers ──────────────────────────────────────────────────────

class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user and request.user.is_authenticated and
            request.user.role and request.user.role.name == 'Super Admin'
        )


def _log(action, user, performed_by=None, saturday=None, free_day_date=None, details='', request=None):
    """Helper to create a DutyActivityLog entry and mirror to central AuditLog."""
    DutyActivityLog.objects.create(
        user=user,
        performed_by=performed_by if performed_by != user else None,
        action=action,
        saturday=saturday,
        free_day_date=free_day_date,
        details=details,
    )
    actor = performed_by or user
    AuditLog.objects.create(
        user=actor,
        username_display=actor.username if actor else 'system',
        action=action,
        module='duty_days',
        ip_address=getattr(request, 'client_ip', '0.0.0.0') if request else '0.0.0.0',
        user_agent=(getattr(request, 'user_agent', 'system') or 'system')[:512] if request else 'system',
        details={
            'description': details,
            'target_user': user.username if user else None,
            'saturday': str(saturday.id) if saturday else None,
            'free_day_date': str(free_day_date) if free_day_date else None,
        }
    )


def credit_passed_saturdays_for_all_users():
    """
    Groups all pending past Saturday bookings that haven't been credited yet,
    increments UserDutyBalance.free_days_available for those users,
    and updates the bookings to free_day_credited=True.
    """
    from django.db import transaction
    from django.db.models import Count

    today = date_cls.today()
    bookings_to_credit = SaturdayBooking.objects.filter(
        saturday__date__lt=today,
        comp_option__in=['decide_later', 'free_day'],
        free_day_credited=False
    )
    if bookings_to_credit.exists():
        with transaction.atomic():
            user_counts = bookings_to_credit.values('user').annotate(cnt=Count('id'))
            for item in user_counts:
                u_id = item['user']
                cnt = item['cnt']
                balance, _ = UserDutyBalance.objects.get_or_create(user_id=u_id)
                balance.free_days_available += cnt
                balance.save()
            bookings_to_credit.update(free_day_credited=True)


# ─── Calendar Events ─────────────────────────────────────────────────────────

class CalendarEventViewSet(viewsets.ModelViewSet):
    """
    GET  /duty-days/events/          — all users, list events (filter by year/month)
    POST /duty-days/events/          — Super Admin only, create event
    PATCH/DELETE /duty-days/events/{id}/ — Super Admin only
    """
    serializer_class = CalendarEventSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsSuperAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = CalendarEvent.objects.select_related('created_by').order_by('event_date')
        year = self.request.query_params.get('year')
        month = self.request.query_params.get('month')
        if year:
            qs = qs.filter(event_date__year=int(year))
        if month:
            qs = qs.filter(event_date__month=int(month))
        return qs

    def perform_create(self, serializer):
        event = serializer.save(created_by=self.request.user)
        _log(
            action='event_created',
            user=self.request.user,
            details=f"A creat evenimentul '{event.title}' pentru {event.event_date.strftime('%d.%m.%Y')}.",
            request=self.request
        )

    def perform_destroy(self, instance):
        _log(
            action='event_deleted',
            user=self.request.user,
            details=f"A șters evenimentul '{instance.title}' din {instance.event_date.strftime('%d.%m.%Y')}.",
            request=self.request
        )
        instance.delete()


# ─── Saturday Duties ─────────────────────────────────────────────────────────

class SaturdayDutyViewSet(viewsets.ModelViewSet):
    """
    GET    /duty-days/saturdays/         — all users, list Saturdays (filter year)
    POST   /duty-days/saturdays/         — Super Admin: create Saturday
    PATCH  /duty-days/saturdays/{id}/    — Super Admin: edit Saturday
    DELETE /duty-days/saturdays/{id}/    — Super Admin: delete Saturday
    POST   /duty-days/saturdays/{id}/book/   — any user: book this Saturday
    POST   /duty-days/saturdays/{id}/cancel/ — user (own) or Super Admin (any): cancel booking
    """
    serializer_class = SaturdayDutySerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsSuperAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = SaturdayDuty.objects.prefetch_related(
            'bookings__user', 'created_by'
        ).order_by('date')
        year = self.request.query_params.get('year')
        if year:
            try:
                qs = qs.filter(date__year=int(year))
            except (ValueError, TypeError):
                pass
        return qs

    def perform_create(self, serializer):
        saturday = serializer.save(created_by=self.request.user)
        _log(
            action='saturday_created',
            user=self.request.user,
            saturday=saturday,
            details=f"A creat sâmbăta de serviciu pentru {saturday.date.strftime('%d.%m.%Y')}. Label: '{saturday.label}'.",
            request=self.request
        )

    def perform_destroy(self, instance):
        date_str = instance.date.strftime('%d.%m.%Y')
        _log(
            action='saturday_deleted',
            user=self.request.user,
            details=f"A șters sâmbăta de serviciu din {date_str}.",
            request=self.request
        )
        instance.delete()

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def book(self, request, pk=None):
        """User books (chooses) this Saturday as their duty day. Admin can book for other users."""
        saturday = self.get_object()
        user = request.user

        # If Super Admin, allow booking for another user
        target_user_id = request.data.get('user_id')
        is_super = user.role and user.role.name == 'Super Admin'
        if target_user_id and is_super:
            try:
                user = User.objects.get(id=target_user_id, is_active=True)
            except User.DoesNotExist:
                return Response(
                    {'detail': 'Utilizatorul specificat nu a fost găsit sau este inactiv.'},
                    status=status.HTTP_404_NOT_FOUND
                )

        # Check if already booked by someone
        if saturday.bookings.exists():
            existing = saturday.bookings.select_related('user').first()
            if existing.user == user:
                return Response(
                    {'detail': f"{'Utilizatorul specificat' if target_user_id else 'Ai'} ales deja această sâmbătă."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response(
                {
                    'detail': f"Această sâmbătă este deja rezervată de {existing.user.first_name} {existing.user.last_name} (@{existing.user.username})."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        is_past = saturday.date < date_cls.today()
        # Create booking
        booking = SaturdayBooking.objects.create(
            saturday=saturday,
            user=user,
            comp_option='decide_later',
            free_day_credited=False
        )

        # Update balance: reduce days_to_recover by 1 (if any), else increase free_days_available
        balance, _ = UserDutyBalance.objects.get_or_create(user=user)
        if balance.days_to_recover > 0:
            balance.days_to_recover -= 1
            balance.save()
            balance_effect = "Zi de recuperare marcată ca îndeplinită (-1 zile lipsite)."
        else:
            if is_past:
                balance.free_days_available += 1
                balance.save()
                booking.free_day_credited = True
                booking.save()
                balance_effect = "Zi liberă disponibilă adăugată (+1 zile libere disponibile)."
            else:
                balance_effect = "Sâmbătă viitoare rezervată. Ziua liberă va fi adăugată în balanță după ce trece această sâmbătă."

        _log(
            action='saturday_booked',
            user=user,
            performed_by=request.user if request.user != user else None,
            saturday=saturday,
            details=f"{'Admin a alocat' if request.user != user else 'Și-a ales'} sâmbăta de serviciu din {saturday.date.strftime('%d.%m.%Y')}. {balance_effect}",
            request=request
        )

        return Response(
            SaturdayDutySerializer(saturday).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def cancel(self, request, pk=None):
        """User cancels their own booking. Super Admin can cancel any."""
        saturday = self.get_object()
        user = request.user
        is_super = user.role and user.role.name == 'Super Admin'

        # Determine which booking to cancel
        target_user_id = request.data.get('user_id')
        if target_user_id and is_super:
            try:
                booking = saturday.bookings.get(user_id=target_user_id)
            except SaturdayBooking.DoesNotExist:
                return Response(
                    {'detail': 'Nu există rezervare pentru utilizatorul specificat.'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            try:
                booking = saturday.bookings.get(user=user)
            except SaturdayBooking.DoesNotExist:
                return Response(
                    {'detail': 'Nu ai o rezervare activă pentru această sâmbătă.'},
                    status=status.HTTP_404_NOT_FOUND
                )

        # Regular users can only cancel future Saturdays
        if not is_super and saturday.date < date_cls.today():
            return Response(
                {'detail': 'Nu poți anula o sâmbătă din trecut. Contactează Super Admin.'},
                status=status.HTTP_403_FORBIDDEN
            )

        target_user = booking.user

        # Reverse balance effect
        balance, _ = UserDutyBalance.objects.get_or_create(user=target_user)
        if booking.comp_option == 'recovery':
            balance.days_to_recover += 1
            balance.save()
        else:
            if booking.free_day_credited:
                if balance.free_days_available > 0:
                    balance.free_days_available -= 1
                    balance.save()

        _log(
            action='saturday_cancelled',
            user=target_user,
            performed_by=user if user != target_user else None,
            saturday=saturday,
            details=(
                f"{'Admin a anulat' if user != target_user else 'A anulat'} rezervarea sâmbetei din "
                f"{saturday.date.strftime('%d.%m.%Y')} pentru {target_user.username}."
            ),
            request=request
        )

        booking.delete()
        return Response({'detail': 'Rezervarea a fost anulată.'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='book-date')
    def book_date(self, request):
        """Allows booking a Saturday by specifying the date string (YYYY-MM-DD)."""
        user = request.user
        date_str = request.data.get('date')
        if not date_str:
            return Response(
                {'detail': 'Date-ul sâmbetei este obligatoriu.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from datetime import datetime
        try:
            sat_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'detail': 'Formatul datei este invalid. Folosiți YYYY-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if sat_date.weekday() != 5:
            return Response(
                {'detail': 'Data specificată nu este o sâmbătă.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        target_user_id = request.data.get('user_id')
        is_super = user.role and user.role.name == 'Super Admin'
        if target_user_id and is_super:
            try:
                user = User.objects.get(id=target_user_id, is_active=True)
            except User.DoesNotExist:
                return Response(
                    {'detail': 'Utilizatorul specificat nu a fost găsit sau este inactiv.'},
                    status=status.HTTP_404_NOT_FOUND
                )

        saturday, created = SaturdayDuty.objects.get_or_create(
            date=sat_date,
            defaults={'created_by': request.user if is_super else None}
        )

        if saturday.bookings.exists():
            existing = saturday.bookings.select_related('user').first()
            
            # If Super Admin, they can replace the existing booking (even for the same user, to update options)
            if is_super:
                old_user = existing.user
                old_balance, _ = UserDutyBalance.objects.get_or_create(user=old_user)
                if existing.comp_option == 'recovery':
                    old_balance.days_to_recover += 1
                    old_balance.save()
                else:
                    if existing.free_day_credited:
                        if old_balance.free_days_available > 0:
                            old_balance.free_days_available -= 1
                            old_balance.save()
                
                existing.delete()
                
                _log(
                    action='saturday_cancelled',
                    user=old_user,
                    performed_by=request.user,
                    saturday=saturday,
                    details=(
                        f"Admin a anulat programarea din {saturday.date.strftime('%d.%m.%Y')} "
                        f"pentru {old_user.username} deoarece a re-alocat sau modificat detaliile."
                    ),
                    request=request
                )
            else:
                if existing.user == user:
                    return Response(
                        {'detail': f"{'Utilizatorul specificat' if target_user_id else 'Ai'} ales deja această sâmbătă."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                return Response(
                    {
                        'detail': f"Această sâmbătă este deja rezervată de {existing.user.first_name} {existing.user.last_name} (@{existing.user.username})."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        comp_option = request.data.get('comp_option', 'decide_later')
        if comp_option not in ['recovery', 'decide_later', 'free_day']:
            comp_option = 'decide_later'

        rec_date_str = request.data.get('recovery_date')
        recovery_date = None
        if comp_option == 'recovery':
            if not rec_date_str:
                return Response(
                    {'detail': 'Data zilei lipsă pe care o recuperați este obligatorie.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            try:
                recovery_date = datetime.strptime(rec_date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'detail': 'Formatul datei de recuperare este invalid. Folosiți YYYY-MM-DD.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        booking = SaturdayBooking.objects.create(
            saturday=saturday,
            user=user,
            comp_option=comp_option,
            recovery_date=recovery_date,
            free_day_credited=False
        )

        balance, _ = UserDutyBalance.objects.get_or_create(user=user)
        balance_effect = ""
        if comp_option == 'recovery':
            if balance.days_to_recover > 0:
                balance.days_to_recover -= 1
                balance.save()
            balance_effect = f"Zi de recuperare marcată pentru data {rec_date_str} (-1 zile lipsite)."
        else:
            is_past = saturday.date < date_cls.today()
            if is_past:
                balance.free_days_available += 1
                balance.save()
                booking.free_day_credited = True
                booking.save()
                balance_effect = "Zi liberă disponibilă adăugată (+1 zile libere)."
            else:
                balance_effect = "Sâmbătă viitoare rezervată. Ziua liberă va fi adăugată în balanță după ce trece această sâmbătă."

        _log(
            action='saturday_booked',
            user=user,
            performed_by=request.user if request.user != user else None,
            saturday=saturday,
            details=(
                f"{'Admin a alocat' if request.user != user else 'Și-a ales'} sâmbăta de serviciu din "
                f"{saturday.date.strftime('%d.%m.%Y')}. Opțiune: {booking.get_comp_option_display()}. {balance_effect}"
            ),
            request=request
        )

        return Response(
            SaturdayDutySerializer(saturday).data,
            status=status.HTTP_201_CREATED
        )


# ─── Balance ─────────────────────────────────────────────────────────────────

class MyBalanceView(APIView):
    """
    GET  /duty-days/balance/me/         — returns current user's balance + personal activity log
    POST /duty-days/balance/take-free-day/ — marks a free day as taken (-1 free_days_available)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        credit_passed_saturdays_for_all_users()
        balance, _ = UserDutyBalance.objects.get_or_create(user=user)

        # Personal activity log
        logs = DutyActivityLog.objects.filter(user=user).select_related(
            'saturday', 'performed_by'
        ).order_by('-created_at')[:50]

        # Upcoming booked Saturdays
        today = date_cls.today()
        upcoming = SaturdayBooking.objects.filter(
            user=user,
            saturday__date__gte=today
        ).select_related('saturday').order_by('saturday__date')

        return Response({
            'balance': UserDutyBalanceSerializer(balance).data,
            'logs': DutyActivityLogSerializer(logs, many=True).data,
            'upcoming_saturdays': [
                {
                    'id': str(b.saturday.id),
                    'date': b.saturday.date.strftime('%Y-%m-%d'),
                    'date_formatted': b.saturday.date.strftime('%d.%m.%Y'),
                    'label': b.saturday.label,
                    'booked_at': b.booked_at.strftime('%d.%m.%Y %H:%M'),
                }
                for b in upcoming
            ],
        })


class TakeFreeDayView(APIView):
    """POST /duty-days/balance/take-free-day/ — user marks a free day as taken."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        free_day_date = request.data.get('free_day_date')
        if not free_day_date:
            return Response(
                {'detail': 'free_day_date este obligatoriu (format: YYYY-MM-DD).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from datetime import datetime
        try:
            parsed_date = datetime.strptime(free_day_date, "%Y-%m-%d").date()
        except ValueError:
            return Response(
                {'detail': 'Formatul datei este invalid (YYYY-MM-DD).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if parsed_date.weekday() in (5, 6):
            return Response(
                {'detail': 'Nu poți lua zi liberă în weekend (sâmbătă sau duminică).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        balance, _ = UserDutyBalance.objects.get_or_create(user=user)

        if balance.free_days_available <= 0:
            return Response(
                {'detail': 'Nu ai zile libere disponibile de luat.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        balance.free_days_available -= 1
        balance.save()

        _log(
            action='free_day_taken',
            user=user,
            free_day_date=free_day_date,
            details=f"A marcat ziua liberă din {free_day_date} ca luată. Zile libere rămase: {balance.free_days_available}.",
            request=request
        )

        return Response({
            'detail': 'Zi liberă marcată ca luată.',
            'free_days_available': balance.free_days_available,
        })


class AllBalancesView(APIView):
    """
    GET  /duty-days/balance/all/      — Super Admin: KPI table for all users
    POST /duty-days/balance/adjust/   — Super Admin: adjust a user's balance
    """
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        credit_passed_saturdays_for_all_users()
        today = date_cls.today()
        users = User.objects.filter(is_active=True).order_by('last_name', 'first_name', 'username')
        result = []

        for u in users:
            balance, _ = UserDutyBalance.objects.get_or_create(user=u)
            saturdays_booked = SaturdayBooking.objects.filter(user=u).count()
            saturdays_booked_upcoming = SaturdayBooking.objects.filter(
                user=u, saturday__date__gte=today
            ).count()

            full_name = f"{u.first_name} {u.last_name}".strip() or u.username

            result.append({
                'user_id': u.id,
                'username': u.username,
                'full_name': full_name,
                'days_to_recover': balance.days_to_recover,
                'free_days_available': balance.free_days_available,
                'saturdays_booked': saturdays_booked,
                'saturdays_booked_upcoming': saturdays_booked_upcoming,
            })

        return Response(result)


class AdjustBalanceView(APIView):
    """POST /duty-days/balance/adjust/ — Super Admin adjusts a user's balance."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def post(self, request):
        user_id = request.data.get('user_id')
        days_to_recover = request.data.get('days_to_recover')
        free_days_available = request.data.get('free_days_available')
        reason = request.data.get('reason', '')

        if not user_id:
            return Response(
                {'detail': 'user_id este obligatoriu.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Utilizatorul nu a fost găsit.'},
                status=status.HTTP_404_NOT_FOUND
            )

        balance, _ = UserDutyBalance.objects.get_or_create(user=target_user)

        old_recover = balance.days_to_recover
        old_free = balance.free_days_available

        if days_to_recover is not None:
            balance.days_to_recover = int(days_to_recover)
        if free_days_available is not None:
            balance.free_days_available = int(free_days_available)
        balance.save()

        _log(
            action='balance_adjusted',
            user=target_user,
            performed_by=request.user,
            details=(
                f"Admin a ajustat balanța lui {target_user.username}: "
                f"Lipsite: {old_recover}→{balance.days_to_recover}, "
                f"Libere: {old_free}→{balance.free_days_available}. "
                f"Motiv: {reason or '-'}"
            ),
            request=request
        )

        return Response(UserDutyBalanceSerializer(balance).data)


class MarkAbsentView(APIView):
    """POST /duty-days/balance/mark-absent/ — Super Admin marks a user as absent on a specific date (+1 days_to_recover)"""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def post(self, request):
        user_id = request.data.get('user_id')
        date_str = request.data.get('date')

        if not user_id or not date_str:
            return Response(
                {'detail': 'user_id și date sunt obligatorii.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Utilizatorul nu a fost găsit.'},
                status=status.HTTP_404_NOT_FOUND
            )

        from datetime import datetime
        try:
            absent_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'detail': 'Formatul datei este invalid. Folosiți YYYY-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if an absence already exists for this user on this date
        existing_absences = LeaveRequest.objects.filter(
            user=target_user,
            start_date=absent_date,
            end_date=absent_date,
            leave_type='absence'
        )
        if existing_absences.exists():
            return Response(
                {'detail': 'Utilizatorul este deja marcat absent în această zi.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Increment days_to_recover
        balance, _ = UserDutyBalance.objects.get_or_create(user=target_user)
        balance.days_to_recover += 1
        balance.save()

        # Create a LeaveRequest for the calendar to display it
        from django.utils import timezone
        LeaveRequest.objects.create(
            user=target_user,
            leave_type='absence',
            start_date=absent_date,
            end_date=absent_date,
            notes='Marcat absent de către admin.',
            status='approved',
            created_by=request.user,
            approved_by=request.user,
            approved_at=timezone.now()
        )

        # Log it
        _log(
            action='balance_adjusted',
            user=target_user,
            performed_by=request.user,
            details=f"Admin l-a marcat absent pe {target_user.username} în data {absent_date.strftime('%d.%m.%Y')} (+1 zile lipsite de recuperat).",
            request=request
        )

        return Response({
            'detail': f'Utilizatorul {target_user.username} a fost marcat ca absent pe data {date_str}.',
            'days_to_recover': balance.days_to_recover
        }, status=status.HTTP_200_OK)


# ─── Detailed Report Builder & Excel Exporters ───────────────────────────────

def _apply_excel_header(ws, title, subtitle, max_col=7):
    col_letter = get_column_letter(max_col)
    ws.merge_cells(f"A1:{col_letter}1")
    cell = ws["A1"]
    cell.value = title
    cell.font = Font(name="Calibri", size=13, bold=True, color="FFFFFF")
    cell.fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 34

    ws.merge_cells(f"A2:{col_letter}2")
    cell_sub = ws["A2"]
    cell_sub.value = subtitle
    cell_sub.font = Font(name="Calibri", size=10, italic=True, color="CBD5E1")
    cell_sub.fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    cell_sub.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[2].height = 22


def _apply_section_header(ws, row_idx, section_title, max_col=7):
    col_letter = get_column_letter(max_col)
    ws.merge_cells(f"A{row_idx}:{col_letter}{row_idx}")
    cell = ws[f"A{row_idx}"]
    cell.value = section_title
    cell.font = Font(name="Calibri", size=11, bold=True, color="1E293B")
    cell.fill = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")
    cell.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[row_idx].height = 24


def _auto_adjust_column_widths(ws, min_width=12, max_width=45):
    for col in ws.columns:
        first_cell = col[0]
        col_letter = get_column_letter(first_cell.column)
        max_len = 0
        for cell in col:
            # Skip merged title rows
            if cell.row in (1, 2):
                continue
            if cell.value:
                val_str = str(cell.value)
                max_len = max(max_len, len(val_str))
        ws.column_dimensions[col_letter].width = max(min(max_len + 3, max_width), min_width)


def build_user_duty_report(target_user, year=None):
    """
    Builds a full detailed report for a specific user:
    - Current balance
    - Consolidated timeline of days taken (Leaves, Free days taken, Saturdays worked)
    - Complete leaves list
    - Booked saturdays
    - Activity logs
    - Synthesized KPIs
    """
    credit_passed_saturdays_for_all_users()
    balance, _ = UserDutyBalance.objects.get_or_create(user=target_user)
    today = date_cls.today()

    leaves_qs = LeaveRequest.objects.filter(user=target_user).select_related('approved_by', 'created_by')
    free_days_qs = DutyActivityLog.objects.filter(user=target_user, action='free_day_taken').select_related('performed_by')
    bookings_qs = SaturdayBooking.objects.filter(user=target_user).select_related('saturday')
    logs_qs = DutyActivityLog.objects.filter(user=target_user).select_related('performed_by', 'saturday')

    if year:
        try:
            year_int = int(year)
            leaves_qs = leaves_qs.filter(Q(start_date__year=year_int) | Q(end_date__year=year_int))
            free_days_qs = free_days_qs.filter(Q(free_day_date__year=year_int) | Q(created_at__year=year_int))
            bookings_qs = bookings_qs.filter(saturday__date__year=year_int)
            logs_qs = logs_qs.filter(created_at__year=year_int)
        except (ValueError, TypeError):
            pass

    leaves = list(leaves_qs.order_by('-start_date'))
    free_days = list(free_days_qs.order_by('-created_at'))
    bookings = list(bookings_qs.order_by('-saturday__date'))
    logs = list(logs_qs.order_by('-created_at'))

    # Calculate KPIs
    approved_leaves = [l for l in leaves if l.status == 'approved']
    total_approved_leave_days = sum(l.duration_days for l in approved_leaves)

    leave_days_by_type = {}
    for code, label in LeaveRequest.LEAVE_TYPE_CHOICES:
        leave_days_by_type[code] = sum(l.duration_days for l in approved_leaves if l.leave_type == code)

    total_free_days_taken = len(free_days)
    saturdays_worked_count = sum(1 for b in bookings if b.saturday.date < today)
    saturdays_upcoming_count = sum(1 for b in bookings if b.saturday.date >= today)

    # Consolidated timeline items (what and when the user took)
    timeline_items = []

    # 1. Leaves (concedii)
    for l in leaves:
        timeline_items.append({
            'id': f"leave_{l.id}",
            'category': 'leave',
            'type_code': l.leave_type,
            'type_label': l.get_leave_type_display(),
            'start_date': l.start_date.strftime('%Y-%m-%d'),
            'end_date': l.end_date.strftime('%Y-%m-%d'),
            'date_display': (
                f"{l.start_date.strftime('%d.%m.%Y')} → {l.end_date.strftime('%d.%m.%Y')}"
                if l.start_date != l.end_date else l.start_date.strftime('%d.%m.%Y')
            ),
            'days_count': l.duration_days,
            'status': l.status,
            'status_label': l.get_status_display(),
            'details': l.notes or 'Fără mențiuni',
            'approved_by': (f"{l.approved_by.first_name} {l.approved_by.last_name}".strip() or l.approved_by.username) if l.approved_by else None,
            'approved_at': l.approved_at.strftime('%d.%m.%Y %H:%M') if l.approved_at else None,
            'created_at': l.created_at.strftime('%d.%m.%Y %H:%M'),
            'sort_date': l.start_date,
        })

    # 2. Free days taken (zile libere luate ca recuperare)
    for f in free_days:
        f_date = f.free_day_date or f.created_at.date()
        timeline_items.append({
            'id': f"freeday_{f.id}",
            'category': 'free_day',
            'type_code': 'free_day',
            'type_label': 'Zi Liberă (Recuperare Sâmbătă)',
            'start_date': f_date.strftime('%Y-%m-%d'),
            'end_date': f_date.strftime('%Y-%m-%d'),
            'date_display': f_date.strftime('%d.%m.%Y'),
            'days_count': 1,
            'status': 'taken',
            'status_label': 'Luată / Efectuată',
            'details': f.details or 'Zi liberă marcată din balanță (recuperare sâmbătă)',
            'approved_by': (f"{f.performed_by.first_name} {f.performed_by.last_name}".strip() or f.performed_by.username) if f.performed_by else None,
            'approved_at': None,
            'created_at': f.created_at.strftime('%d.%m.%Y %H:%M'),
            'sort_date': f_date,
        })

    # 3. Saturdays served / booked
    for b in bookings:
        is_past = b.saturday.date < today
        timeline_items.append({
            'id': f"sat_{b.id}",
            'category': 'saturday_duty',
            'type_code': 'saturday_duty',
            'type_label': f"Sâmbătă Serviciu ({b.saturday.label or 'Serviciu'})",
            'start_date': b.saturday.date.strftime('%Y-%m-%d'),
            'end_date': b.saturday.date.strftime('%Y-%m-%d'),
            'date_display': b.saturday.date.strftime('%d.%m.%Y'),
            'days_count': 1,
            'status': 'completed' if is_past else 'upcoming',
            'status_label': 'Lucrată (Creditată)' if b.free_day_credited else ('Efectuată' if is_past else 'Programată'),
            'details': f"Compensare: {b.get_comp_option_display()}" + (f" (Recup: {b.recovery_date.strftime('%d.%m.%Y')})" if b.recovery_date else ''),
            'approved_by': None,
            'approved_at': None,
            'created_at': b.booked_at.strftime('%d.%m.%Y %H:%M'),
            'sort_date': b.saturday.date,
        })

    timeline_items.sort(key=lambda x: x['sort_date'], reverse=True)
    for item in timeline_items:
        del item['sort_date']

    return {
        'user': {
            'id': str(target_user.id),
            'username': target_user.username,
            'full_name': f"{target_user.first_name} {target_user.last_name}".strip() or target_user.username,
            'email': target_user.email,
            'role': target_user.role.name if target_user.role else None,
        },
        'period': {
            'year': int(year) if year else None,
            'year_label': str(year) if year else 'Toată perioada',
        },
        'kpi': {
            'days_to_recover': balance.days_to_recover,
            'free_days_available': balance.free_days_available,
            'total_free_days_taken': total_free_days_taken,
            'total_approved_leave_days': total_approved_leave_days,
            'leave_days_by_type': leave_days_by_type,
            'saturdays_worked_count': saturdays_worked_count,
            'saturdays_upcoming_count': saturdays_upcoming_count,
            'saturdays_total_count': len(bookings),
        },
        'timeline': timeline_items,
        'leaves': LeaveRequestSerializer(leaves, many=True).data,
        'free_days_taken': [
            {
                'id': str(f.id),
                'date': (f.free_day_date or f.created_at.date()).strftime('%Y-%m-%d'),
                'date_formatted': (f.free_day_date or f.created_at.date()).strftime('%d.%m.%Y'),
                'details': f.details,
                'created_at': f.created_at.strftime('%d.%m.%Y %H:%M'),
            }
            for f in free_days
        ],
        'bookings': [
            {
                'id': str(b.id),
                'saturday_id': str(b.saturday.id),
                'date': b.saturday.date.strftime('%Y-%m-%d'),
                'date_formatted': b.saturday.date.strftime('%d.%m.%Y'),
                'label': b.saturday.label,
                'comp_option': b.comp_option,
                'comp_option_display': b.get_comp_option_display(),
                'recovery_date': b.recovery_date.strftime('%Y-%m-%d') if b.recovery_date else None,
                'recovery_date_formatted': b.recovery_date.strftime('%d.%m.%Y') if b.recovery_date else None,
                'free_day_credited': b.free_day_credited,
                'is_past': b.saturday.date < today,
                'booked_at': b.booked_at.strftime('%d.%m.%Y %H:%M'),
            }
            for b in bookings
        ],
        'logs': DutyActivityLogSerializer(logs, many=True).data,
    }


# ─── Activity Logs ────────────────────────────────────────────────────────────

class ActivityLogsView(APIView):
    """
    GET /duty-days/logs/
    Query params:
        user_id: filter by user
        action: filter by action
        search: keyword in details or username
        start_date: YYYY-MM-DD
        end_date: YYYY-MM-DD
        limit: int (default 100, max 1000)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        is_super = user.role and user.role.name == 'Super Admin'

        qs = DutyActivityLog.objects.select_related(
            'user', 'performed_by', 'saturday'
        ).order_by('-created_at')

        if is_super:
            user_id = request.query_params.get('user_id')
            if user_id:
                qs = qs.filter(user_id=user_id)
        else:
            qs = qs.filter(user=user)

        action = request.query_params.get('action')
        if action:
            qs = qs.filter(action=action)

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(details__icontains=search) |
                Q(user__username__icontains=search) |
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search) |
                Q(performed_by__username__icontains=search)
            )

        start_date = request.query_params.get('start_date')
        if start_date:
            qs = qs.filter(created_at__date__gte=start_date)

        end_date = request.query_params.get('end_date')
        if end_date:
            qs = qs.filter(created_at__date__lte=end_date)

        total_count = qs.count()
        limit = min(int(request.query_params.get('limit', 150)), 1000)
        logs = qs[:limit]

        return Response({
            'count': total_count,
            'limit': limit,
            'results': DutyActivityLogSerializer(logs, many=True).data
        })


class ActivityLogsExportView(APIView):
    """GET /duty-days/logs/export/ — Super Admin: export activity logs to Excel."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        qs = DutyActivityLog.objects.select_related('user', 'performed_by', 'saturday').order_by('-created_at')

        user_id = request.query_params.get('user_id')
        if user_id:
            qs = qs.filter(user_id=user_id)

        action = request.query_params.get('action')
        if action:
            qs = qs.filter(action=action)

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(details__icontains=search) |
                Q(user__username__icontains=search) |
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search)
            )

        start_date = request.query_params.get('start_date')
        if start_date:
            qs = qs.filter(created_at__date__gte=start_date)

        end_date = request.query_params.get('end_date')
        if end_date:
            qs = qs.filter(created_at__date__lte=end_date)

        logs = qs[:2000]

        wb = Workbook()
        ws = wb.active
        ws.title = "Jurnal Activitate"

        _apply_excel_header(
            ws,
            title="SIDESI — JURNAL DE ACTIVITATE ȘI AUDIT (ZILE DE SERVICIU & CONCEDII)",
            subtitle=f"Exportat la: {date_cls.today().strftime('%d.%m.%Y')} | Total înregistrări: {len(logs)}",
            max_col=5
        )

        headers = ["Data și Ora", "Angajat Vizat", "Efectuat de", "Acțiune", "Detalii Complete"]
        header_row = 4
        ws.row_dimensions[header_row].height = 26

        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="334155", end_color="334155", fill_type="solid")
        border_side = Side(border_style="thin", color="CBD5E1")
        border = Border(left=border_side, right=border_side, top=border_side, bottom=border_side)
        alt_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

        for col_num, h_text in enumerate(headers, 1):
            cell = ws.cell(row=header_row, column=col_num, value=h_text)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = border

        for row_idx, log in enumerate(logs, start=header_row + 1):
            target_name = f"{log.user.first_name} {log.user.last_name}".strip() or log.user.username if log.user else '—'
            actor_name = f"{log.performed_by.first_name} {log.performed_by.last_name}".strip() or log.performed_by.username if log.performed_by else target_name

            row_data = [
                log.created_at.strftime('%d.%m.%Y %H:%M'),
                target_name,
                actor_name,
                log.get_action_display(),
                log.details or '—',
            ]
            ws.row_dimensions[row_idx].height = 20
            is_alt = (row_idx % 2 == 0)

            for col_num, val in enumerate(row_data, 1):
                cell = ws.cell(row=row_idx, column=col_num, value=val)
                cell.font = Font(name="Calibri", size=10)
                cell.border = border
                if is_alt:
                    cell.fill = alt_fill
                if col_num in (1, 2, 3, 4):
                    cell.alignment = Alignment(horizontal="center" if col_num == 1 else "left", vertical="center")
                else:
                    cell.alignment = Alignment(horizontal="left", vertical="center")

        _auto_adjust_column_widths(ws, min_width=15, max_width=60)

        output = BytesIO()
        wb.save(output)
        output.seek(0)

        filename = f"jurnal_activitate_duty_days_{date_cls.today().strftime('%Y%m%d')}.xlsx"
        response = HttpResponse(
            output.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


# ─── User Detail & Report Views (Super Admin) ──────────────────────────────────

class UserDetailView(APIView):
    """GET /duty-days/users/{user_id}/detail/ — Super Admin: full detailed report per user."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get(self, request, user_id):
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Utilizatorul nu a fost găsit.'},
                status=status.HTTP_404_NOT_FOUND
            )

        year = request.query_params.get('year')
        report_data = build_user_duty_report(target_user, year=year)
        return Response(report_data)


class UserReportView(APIView):
    """GET /duty-days/users/{user_id}/report/?year=YYYY — Dedicated endpoint for user detailed report."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get(self, request, user_id):
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Utilizatorul nu a fost găsit.'},
                status=status.HTTP_404_NOT_FOUND
            )

        year = request.query_params.get('year')
        report_data = build_user_duty_report(target_user, year=year)
        return Response(report_data)


class UserReportExportView(APIView):
    """GET /duty-days/users/{user_id}/report/export/?year=YYYY — Download Excel report for user."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get(self, request, user_id):
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'Utilizatorul nu a fost găsit.'}, status=status.HTTP_404_NOT_FOUND)

        year = request.query_params.get('year')
        data = build_user_duty_report(target_user, year)
        u_info = data['user']
        kpi = data['kpi']
        timeline = data['timeline']
        bookings = data['bookings']
        logs = data['logs']

        wb = Workbook()
        ws = wb.active
        ws.title = "Raport Zile"

        _apply_excel_header(
            ws,
            title="FIȘĂ INDIVIDUALĂ DE EVIDENȚĂ A ZILELOR DE SERVICIU ȘI CONCEDIILOR",
            subtitle=f"Angajat: {u_info['full_name']} (@{u_info['username']}) | Perioada: {data['period']['year_label']} | Generat la: {date_cls.today().strftime('%d.%m.%Y')}",
            max_col=7
        )

        border_side = Side(border_style="thin", color="CBD5E1")
        border = Border(left=border_side, right=border_side, top=border_side, bottom=border_side)
        header_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="334155", end_color="334155", fill_type="solid")
        alt_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

        # ── Section 1: Balanță & Sumar Zile
        cur_row = 4
        _apply_section_header(ws, cur_row, "1. SINTEZĂ BALANȚĂ ȘI TOTALURI ZILE", max_col=7)
        cur_row += 1

        kpi_headers = [
            "Zile Libere Disp.", "Zile Lipsă (Recup)", "Concediu Odihnă",
            "Concediu Medical", "Zile Libere Luate", "Sâmbete Lucrate", "Sâmbete Viitoare"
        ]
        ws.row_dimensions[cur_row].height = 22
        for col_idx, h in enumerate(kpi_headers, 1):
            cell = ws.cell(row=cur_row, column=col_idx, value=h)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = border

        cur_row += 1
        kpi_values = [
            kpi['free_days_available'],
            kpi['days_to_recover'],
            kpi['leave_days_by_type'].get('rest', 0),
            kpi['leave_days_by_type'].get('medical', 0),
            kpi['total_free_days_taken'],
            kpi['saturdays_worked_count'],
            kpi['saturdays_upcoming_count'],
        ]
        ws.row_dimensions[cur_row].height = 24
        for col_idx, val in enumerate(kpi_values, 1):
            cell = ws.cell(row=cur_row, column=col_idx, value=val)
            cell.font = Font(name="Calibri", size=12, bold=True, color="0F172A")
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = border
            if col_idx == 1:
                cell.fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
                cell.font = Font(name="Calibri", size=12, bold=True, color="166534")
            elif col_idx == 2 and val > 0:
                cell.fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
                cell.font = Font(name="Calibri", size=12, bold=True, color="991B1B")

        # ── Section 2: Evidență Cronologică (Ce și când și-a luat)
        cur_row += 2
        _apply_section_header(ws, cur_row, "2. EVIDENȚĂ DETALIATĂ A ZILELOR LUATE (CONCEDII, RECUPERĂRI, SÂMBETE)", max_col=7)
        cur_row += 1

        timeline_headers = ["Nr.", "Data / Perioada", "Categorie / Tip", "Zile", "Status", "Mențiuni / Justificare", "Înregistrat La"]
        ws.row_dimensions[cur_row].height = 22
        for col_idx, h in enumerate(timeline_headers, 1):
            cell = ws.cell(row=cur_row, column=col_idx, value=h)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = border

        if not timeline:
            cur_row += 1
            ws.merge_cells(f"A{cur_row}:G{cur_row}")
            cell = ws[f"A{cur_row}"]
            cell.value = "Nu există înregistrări de concedii sau zile libere pentru această perioadă."
            cell.font = Font(name="Calibri", size=10, italic=True, color="64748B")
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = border
            ws.row_dimensions[cur_row].height = 22
        else:
            for idx, item in enumerate(timeline, 1):
                cur_row += 1
                is_alt = (idx % 2 == 0)
                ws.row_dimensions[cur_row].height = 20
                row_data = [
                    idx,
                    item['date_display'],
                    item['type_label'],
                    item['days_count'],
                    item['status_label'],
                    item['details'],
                    item['created_at'],
                ]
                for col_idx, val in enumerate(row_data, 1):
                    cell = ws.cell(row=cur_row, column=col_idx, value=val)
                    cell.font = Font(name="Calibri", size=10)
                    cell.border = border
                    if is_alt:
                        cell.fill = alt_fill
                    if col_idx in (1, 4):
                        cell.alignment = Alignment(horizontal="center", vertical="center")
                    elif col_idx in (2, 5, 7):
                        cell.alignment = Alignment(horizontal="center", vertical="center")
                    else:
                        cell.alignment = Alignment(horizontal="left", vertical="center")

        # ── Section 3: Jurnal Activitate & Audit Persoană
        cur_row += 2
        _apply_section_header(ws, cur_row, "3. JURNAL DE ACTIVITATE ȘI AUDIT AL PERSOANEI", max_col=7)
        cur_row += 1

        log_headers = ["Nr.", "Data și Ora", "Acțiune", "Efectuat de", "Detalii Complete", "", ""]
        ws.merge_cells(f"E{cur_row}:G{cur_row}")
        ws.row_dimensions[cur_row].height = 22
        for col_idx, h in enumerate(log_headers[:5], 1):
            cell = ws.cell(row=cur_row, column=col_idx, value=h)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = border

        if not logs:
            cur_row += 1
            ws.merge_cells(f"A{cur_row}:G{cur_row}")
            cell = ws[f"A{cur_row}"]
            cell.value = "Nu există activitate înregistrată."
            cell.font = Font(name="Calibri", size=10, italic=True, color="64748B")
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = border
            ws.row_dimensions[cur_row].height = 22
        else:
            for idx, log_item in enumerate(logs[:100], 1):
                cur_row += 1
                ws.merge_cells(f"E{cur_row}:G{cur_row}")
                ws.row_dimensions[cur_row].height = 20
                is_alt = (idx % 2 == 0)
                actor = log_item.get('performed_by_detail', {})
                actor_name = actor.get('full_name') or actor.get('username') if actor else u_info['full_name']

                row_vals = [
                    idx,
                    log_item.get('created_at'),
                    log_item.get('action_display'),
                    actor_name,
                    log_item.get('details') or '—',
                ]
                for col_idx, val in enumerate(row_vals, 1):
                    cell = ws.cell(row=cur_row, column=col_idx, value=val)
                    cell.font = Font(name="Calibri", size=10)
                    cell.border = border
                    if is_alt:
                        cell.fill = alt_fill
                    if col_idx in (1, 2):
                        cell.alignment = Alignment(horizontal="center", vertical="center")
                    else:
                        cell.alignment = Alignment(horizontal="left", vertical="center")

        _auto_adjust_column_widths(ws, min_width=12, max_width=45)

        output = BytesIO()
        wb.save(output)
        output.seek(0)

        clean_name = u_info['username'].replace(' ', '_')
        filename = f"fisa_zile_{clean_name}_{data['period']['year_label']}.xlsx"
        response = HttpResponse(
            output.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class AllUsersReportExportView(APIView):
    """GET /duty-days/reports/all-users/export/?year=YYYY — Centralizer Excel report for all users."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        credit_passed_saturdays_for_all_users()
        year = request.query_params.get('year')
        today = date_cls.today()
        users = User.objects.filter(is_active=True).order_by('last_name', 'first_name', 'username')

        wb = Workbook()
        ws = wb.active
        ws.title = "Centralizator Zile"

        period_label = str(year) if year else "Toată perioada"
        _apply_excel_header(
            ws,
            title="SIDESI — RAPORT CENTRALIZATOR EVIDENȚĂ ZILE ȘI CONCEDII (TOȚI ANGAJAȚII)",
            subtitle=f"Perioada: {period_label} | Generat la: {date_cls.today().strftime('%d.%m.%Y')} | Total angajați: {users.count()}",
            max_col=12
        )

        headers = [
            "Nr.", "Nume și Prenume", "Utilizator",
            "Zile Libere Disp.", "Zile Lipsă (Recup)",
            "Concediu Odihnă (zile)", "Concediu Medical (zile)", "Concediu Studii (zile)",
            "Concediu Fără Plată (zile)", "Alte Concedii (zile)",
            "Zile Libere Luate", "Sâmbete Serviciu Lucrate"
        ]
        header_row = 4
        ws.row_dimensions[header_row].height = 26

        header_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        border_side = Side(border_style="thin", color="CBD5E1")
        border = Border(left=border_side, right=border_side, top=border_side, bottom=border_side)
        alt_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

        for col_idx, h in enumerate(headers, 1):
            cell = ws.cell(row=header_row, column=col_idx, value=h)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = border

        for idx, u in enumerate(users, 1):
            row_idx = header_row + idx
            ws.row_dimensions[row_idx].height = 20
            is_alt = (idx % 2 == 0)

            balance, _ = UserDutyBalance.objects.get_or_create(user=u)
            leaves_qs = LeaveRequest.objects.filter(user=u, status='approved')
            free_days_qs = DutyActivityLog.objects.filter(user=u, action='free_day_taken')
            bookings_qs = SaturdayBooking.objects.filter(user=u, saturday__date__lt=today)

            if year:
                try:
                    y_int = int(year)
                    leaves_qs = leaves_qs.filter(Q(start_date__year=y_int) | Q(end_date__year=y_int))
                    free_days_qs = free_days_qs.filter(Q(free_day_date__year=y_int) | Q(created_at__year=y_int))
                    bookings_qs = bookings_qs.filter(saturday__date__year=y_int)
                except (ValueError, TypeError):
                    pass

            approved_leaves = list(leaves_qs)
            rest_days = sum(l.duration_days for l in approved_leaves if l.leave_type == 'rest')
            medical_days = sum(l.duration_days for l in approved_leaves if l.leave_type == 'medical')
            study_days = sum(l.duration_days for l in approved_leaves if l.leave_type == 'study')
            unpaid_days = sum(l.duration_days for l in approved_leaves if l.leave_type == 'unpaid')
            other_days = sum(l.duration_days for l in approved_leaves if l.leave_type in ('other', 'absence'))

            free_days_taken_count = free_days_qs.count()
            saturdays_worked = bookings_qs.count()
            full_name = f"{u.first_name} {u.last_name}".strip() or u.username

            row_data = [
                idx,
                full_name,
                f"@{u.username}",
                balance.free_days_available,
                balance.days_to_recover,
                rest_days,
                medical_days,
                study_days,
                unpaid_days,
                other_days,
                free_days_taken_count,
                saturdays_worked,
            ]

            for col_idx, val in enumerate(row_data, 1):
                cell = ws.cell(row=row_idx, column=col_idx, value=val)
                cell.font = Font(name="Calibri", size=10)
                cell.border = border
                if is_alt:
                    cell.fill = alt_fill
                if col_idx in (1, 3):
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                elif col_idx in (4, 5, 6, 7, 8, 9, 10, 11, 12):
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                else:
                    cell.alignment = Alignment(horizontal="left", vertical="center")

        _auto_adjust_column_widths(ws, min_width=12, max_width=35)

        output = BytesIO()
        wb.save(output)
        output.seek(0)

        filename = f"centralizator_zile_serviciu_{period_label}.xlsx"
        response = HttpResponse(
            output.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


# ─── Leave Requests ───────────────────────────────────────────────────────────

class LeaveRequestViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for leave requests.

    GET    /duty-days/leaves/                — own leaves (or all for Super Admin)
    POST   /duty-days/leaves/                — create leave (target user_id for admin)
    PATCH  /duty-days/leaves/{id}/           — edit (owner if draft/pending; admin always)
    DELETE /duty-days/leaves/{id}/           — delete (owner if draft/pending; admin always)
    POST   /duty-days/leaves/{id}/approve/   — Super Admin: approve
    POST   /duty-days/leaves/{id}/reject/    — Super Admin: reject
    GET    /duty-days/leaves/calendar/       — approved leaves in date range (?start=&end=)
    GET    /duty-days/leaves/summary/        — Super Admin: aggregated stats per user
    """
    serializer_class = LeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        is_super = user.role and user.role.name == 'Super Admin'

        qs = LeaveRequest.objects.select_related(
            'user', 'created_by', 'approved_by'
        ).order_by('-start_date')

        if is_super:
            user_id = self.request.query_params.get('user_id')
            status_filter = self.request.query_params.get('status')
            leave_type = self.request.query_params.get('leave_type')
            year = self.request.query_params.get('year')
            if user_id:
                qs = qs.filter(user_id=user_id)
            if status_filter:
                qs = qs.filter(status=status_filter)
            if leave_type:
                qs = qs.filter(leave_type=leave_type)
            if year:
                try:
                    qs = qs.filter(start_date__year=int(year))
                except (ValueError, TypeError):
                    pass
        else:
            qs = qs.filter(user=user)

        return qs

    def perform_create(self, serializer):
        from datetime import timezone as tz, datetime as dt

        user = self.request.user
        is_super = user.role and user.role.name == 'Super Admin'

        target_user_id = self.request.data.get('user_id')
        target_user = user

        if target_user_id and is_super:
            try:
                target_user = User.objects.get(id=target_user_id, is_active=True)
            except User.DoesNotExist:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'user_id': 'Utilizatorul nu a fost găsit.'})

        # Super Admin adds directly as approved; regular users add as pending
        initial_status = 'approved' if is_super else 'pending'
        approved_by = user if is_super else None
        approved_at = dt.now(tz.utc) if is_super else None

        leave = serializer.save(
            user=target_user,
            created_by=user,
            status=initial_status,
            approved_by=approved_by,
            approved_at=approved_at,
        )

        _log(
            action='leave_added',
            user=target_user,
            performed_by=user if user != target_user else None,
            details=(
                f"{'Admin a adăugat' if user != target_user else 'A adăugat'} concediu de tip "
                f"'{leave.get_leave_type_display()}' — {leave.start_date.strftime('%d.%m.%Y')} "
                f"→ {leave.end_date.strftime('%d.%m.%Y')} ({leave.duration_days} zile). "
                f"Status: {leave.get_status_display()}."
            ),
            request=self.request
        )

    def update(self, request, *args, **kwargs):
        leave = self.get_object()
        user = request.user
        is_super = user.role and user.role.name == 'Super Admin'

        if not is_super:
            if leave.user != user:
                return Response(
                    {'detail': 'Nu ai permisiunea să editezi această cerere.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            if leave.status not in ('draft', 'pending'):
                return Response(
                    {'detail': 'Poți edita doar cereri în stare de ciornă sau așteptare.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        leave = self.get_object()
        user = request.user
        is_super = user.role and user.role.name == 'Super Admin'

        if not is_super:
            if leave.user != user:
                return Response(
                    {'detail': 'Nu ai permisiunea să ștergi această cerere.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            if leave.status not in ('draft', 'pending'):
                return Response(
                    {'detail': 'Poți șterge doar cereri în stare de ciornă sau așteptare.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        target_user = leave.user
        leave_desc = (
            f"Concediu '{leave.get_leave_type_display()}' "
            f"{leave.start_date.strftime('%d.%m.%Y')} → {leave.end_date.strftime('%d.%m.%Y')}."
        )

        # If it was an approved absence, decrement days_to_recover by 1
        if leave.leave_type == 'absence' and leave.status == 'approved':
            balance, _ = UserDutyBalance.objects.get_or_create(user=target_user)
            if balance.days_to_recover > 0:
                balance.days_to_recover -= 1
                balance.save()

        leave.delete()

        _log(
            action='leave_cancelled',
            user=target_user,
            performed_by=user if user != target_user else None,
            details=f"{'Admin a șters' if user != target_user else 'A anulat'} {leave_desc}",
            request=request
        )

        return Response({'detail': 'Cererea de concediu a fost ștearsă.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsSuperAdmin])
    def approve(self, request, pk=None):
        """POST /duty-days/leaves/{id}/approve/ — Super Admin approves."""
        from datetime import timezone as tz, datetime as dt

        leave = self.get_object()
        if leave.status == 'approved':
            return Response({'detail': 'Cererea este deja aprobată.'}, status=status.HTTP_400_BAD_REQUEST)

        leave.status = 'approved'
        leave.approved_by = request.user
        leave.approved_at = dt.now(tz.utc)
        leave.rejection_reason = ''
        leave.save()

        # If it's an absence, increment days_to_recover
        if leave.leave_type == 'absence':
            balance, _ = UserDutyBalance.objects.get_or_create(user=leave.user)
            balance.days_to_recover += 1
            balance.save()

        _log(
            action='leave_approved',
            user=leave.user,
            performed_by=request.user,
            details=(
                f"Admin a aprobat cererea de concediu '{leave.get_leave_type_display()}' "
                f"{leave.start_date.strftime('%d.%m.%Y')} → {leave.end_date.strftime('%d.%m.%Y')} "
                f"pentru {leave.user.username}."
            ),
            request=request
        )
        return Response(LeaveRequestSerializer(leave).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsSuperAdmin])
    def reject(self, request, pk=None):
        """POST /duty-days/leaves/{id}/reject/ — Super Admin rejects."""
        leave = self.get_object()
        if leave.status == 'rejected':
            return Response({'detail': 'Cererea este deja respinsă.'}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', '')
        old_status = leave.status
        leave.status = 'rejected'
        leave.rejection_reason = reason
        leave.approved_by = None
        leave.approved_at = None
        leave.save()

        # If it was an approved absence, decrement days_to_recover
        if leave.leave_type == 'absence' and old_status == 'approved':
            balance, _ = UserDutyBalance.objects.get_or_create(user=leave.user)
            if balance.days_to_recover > 0:
                balance.days_to_recover -= 1
                balance.save()

        _log(
            action='leave_rejected',
            user=leave.user,
            performed_by=request.user,
            details=(
                f"Admin a respins cererea de concediu '{leave.get_leave_type_display()}' "
                f"{leave.start_date.strftime('%d.%m.%Y')} → {leave.end_date.strftime('%d.%m.%Y')} "
                f"pentru {leave.user.username}. Motiv: {reason or '-'}."
            ),
            request=request
        )
        return Response(LeaveRequestSerializer(leave).data)

    @action(detail=False, methods=['get'], url_path='calendar')
    def calendar(self, request):
        """
        GET /duty-days/leaves/calendar/?start=YYYY-MM-DD&end=YYYY-MM-DD
        Returns all approved leaves that overlap with the date range.
        """
        from datetime import datetime as dt

        start_str = request.query_params.get('start')
        end_str = request.query_params.get('end')

        qs = LeaveRequest.objects.filter(status='approved').select_related('user')

        if start_str:
            try:
                start = dt.strptime(start_str, '%Y-%m-%d').date()
                qs = qs.filter(end_date__gte=start)
            except ValueError:
                pass

        if end_str:
            try:
                end = dt.strptime(end_str, '%Y-%m-%d').date()
                qs = qs.filter(start_date__lte=end)
            except ValueError:
                pass

        return Response(LeaveRequestSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'], url_path='summary',
            permission_classes=[permissions.IsAuthenticated, IsSuperAdmin])
    def summary(self, request):
        """
        GET /duty-days/leaves/summary/
        Super Admin: aggregated leave stats per user.
        """
        users = User.objects.filter(is_active=True).order_by('last_name', 'first_name', 'username')
        result = []

        for u in users:
            approved_leaves = LeaveRequest.objects.filter(user=u, status='approved')
            total_days = sum(l.duration_days for l in approved_leaves)
            by_type = {}
            for lt_code, lt_label in LeaveRequest.LEAVE_TYPE_CHOICES:
                days = sum(
                    l.duration_days for l in approved_leaves if l.leave_type == lt_code
                )
                if days > 0:
                    by_type[lt_code] = {'label': lt_label, 'days': days}

            all_leaves = LeaveRequest.objects.filter(user=u).select_related(
                'created_by', 'approved_by'
            ).order_by('-start_date')

            result.append({
                'user_id': str(u.id),
                'username': u.username,
                'full_name': f"{u.first_name} {u.last_name}".strip() or u.username,
                'total_approved_days': total_days,
                'by_type': by_type,
                'leaves': LeaveRequestSerializer(all_leaves, many=True).data,
            })

        return Response(result)

