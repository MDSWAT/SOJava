from datetime import date as date_cls
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.duty_days.models import (
    CalendarEvent, SaturdayDuty, SaturdayBooking,
    UserDutyBalance, DutyActivityLog, LeaveRequest
)
from apps.duty_days.serializers import (
    CalendarEventSerializer, SaturdayDutySerializer,
    UserDutyBalanceSerializer, DutyActivityLogSerializer,
    UserBalanceKPISerializer, LeaveRequestSerializer
)

User = get_user_model()


# ─── Permission Helpers ──────────────────────────────────────────────────────

class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user and request.user.is_authenticated and
            request.user.role and request.user.role.name == 'Super Admin'
        )


def _log(action, user, performed_by=None, saturday=None, free_day_date=None, details=''):
    """Helper to create a DutyActivityLog entry."""
    DutyActivityLog.objects.create(
        user=user,
        performed_by=performed_by if performed_by != user else None,
        action=action,
        saturday=saturday,
        free_day_date=free_day_date,
        details=details,
    )


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
            details=f"A creat evenimentul '{event.title}' pentru {event.event_date.strftime('%d.%m.%Y')}."
        )

    def perform_destroy(self, instance):
        _log(
            action='event_deleted',
            user=self.request.user,
            details=f"A șters evenimentul '{instance.title}' din {instance.event_date.strftime('%d.%m.%Y')}."
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
            details=f"A creat sâmbăta de serviciu pentru {saturday.date.strftime('%d.%m.%Y')}. Label: '{saturday.label}'."
        )

    def perform_destroy(self, instance):
        date_str = instance.date.strftime('%d.%m.%Y')
        _log(
            action='saturday_deleted',
            user=self.request.user,
            details=f"A șters sâmbăta de serviciu din {date_str}."
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

        # Create booking
        SaturdayBooking.objects.create(saturday=saturday, user=user)

        # Update balance: reduce days_to_recover by 1 (if any), else increase free_days_available
        balance, _ = UserDutyBalance.objects.get_or_create(user=user)
        if balance.days_to_recover > 0:
            balance.days_to_recover -= 1
            balance.save()
            balance_effect = "Zi de recuperare marcată ca îndeplinită (-1 zile lipsite)."
        else:
            balance.free_days_available += 1
            balance.save()
            balance_effect = "Zi liberă disponibilă adăugată (+1 zile libere disponibile)."

        _log(
            action='saturday_booked',
            user=user,
            performed_by=request.user if request.user != user else None,
            saturday=saturday,
            details=f"{'Admin a alocat' if request.user != user else 'Și-a ales'} sâmbăta de serviciu din {saturday.date.strftime('%d.%m.%Y')}. {balance_effect}"
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
            )
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
                    )
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
            recovery_date=recovery_date
        )

        balance, _ = UserDutyBalance.objects.get_or_create(user=user)
        balance_effect = ""
        if comp_option == 'recovery':
            if balance.days_to_recover > 0:
                balance.days_to_recover -= 1
                balance.save()
            balance_effect = f"Zi de recuperare marcată pentru data {rec_date_str} (-1 zile lipsite)."
        else:
            balance.free_days_available += 1
            balance.save()
            balance_effect = "Zi liberă disponibilă adăugată (+1 zile libere)."

        _log(
            action='saturday_booked',
            user=user,
            performed_by=request.user if request.user != user else None,
            saturday=saturday,
            details=(
                f"{'Admin a alocat' if request.user != user else 'Și-a ales'} sâmbăta de serviciu din "
                f"{saturday.date.strftime('%d.%m.%Y')}. Opțiune: {booking.get_comp_option_display()}. {balance_effect}"
            )
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
            details=f"A marcat ziua liberă din {free_day_date} ca luată. Zile libere rămase: {balance.free_days_available}."
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
            )
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

        # Increment days_to_recover
        balance, _ = UserDutyBalance.objects.get_or_create(user=target_user)
        balance.days_to_recover += 1
        balance.save()

        # Log it
        _log(
            action='balance_adjusted',
            user=target_user,
            performed_by=request.user,
            details=f"Admin l-a marcat absent pe {target_user.username} în data {absent_date.strftime('%d.%m.%Y')} (+1 zile lipsite de recuperat)."
        )

        return Response({
            'detail': f'Utilizatorul {target_user.username} a fost marcat ca absent pe data {date_str}.',
            'days_to_recover': balance.days_to_recover
        }, status=status.HTTP_200_OK)


# ─── Activity Logs ────────────────────────────────────────────────────────────

class ActivityLogsView(APIView):
    """
    GET /duty-days/logs/         — Super Admin sees all; regular users see own logs
    GET /duty-days/logs/?user_id=X — Super Admin filter by user
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

        # Limit to 200 most recent
        qs = qs[:200]

        return Response(DutyActivityLogSerializer(qs, many=True).data)


# ─── User Detail (Super Admin) ────────────────────────────────────────────────

class UserDetailView(APIView):
    """GET /duty-days/users/{user_id}/detail/ — Super Admin: full detail per user."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get(self, request, user_id):
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Utilizatorul nu a fost găsit.'},
                status=status.HTTP_404_NOT_FOUND
            )

        balance, _ = UserDutyBalance.objects.get_or_create(user=target_user)
        today = date_cls.today()

        # All bookings
        bookings = SaturdayBooking.objects.filter(
            user=target_user
        ).select_related('saturday').order_by('-saturday__date')

        bookings_data = [
            {
                'id': str(b.id),
                'saturday_id': str(b.saturday.id),
                'date': b.saturday.date.strftime('%Y-%m-%d'),
                'date_formatted': b.saturday.date.strftime('%d.%m.%Y'),
                'label': b.saturday.label,
                'is_past': b.saturday.date < today,
                'booked_at': b.booked_at.strftime('%d.%m.%Y %H:%M'),
            }
            for b in bookings
        ]

        # All activity logs
        logs = DutyActivityLog.objects.filter(
            user=target_user
        ).select_related('saturday', 'performed_by').order_by('-created_at')

        return Response({
            'user': {
                'id': str(target_user.id),
                'username': target_user.username,
                'full_name': f"{target_user.first_name} {target_user.last_name}".strip() or target_user.username,
                'email': target_user.email,
                'role': target_user.role.name if target_user.role else None,
            },
            'balance': UserDutyBalanceSerializer(balance).data,
            'bookings': bookings_data,
            'logs': DutyActivityLogSerializer(logs, many=True).data,
        })


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
            )
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
        leave.delete()

        _log(
            action='leave_cancelled',
            user=target_user,
            performed_by=user if user != target_user else None,
            details=f"{'Admin a șters' if user != target_user else 'A anulat'} {leave_desc}"
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

        _log(
            action='leave_approved',
            user=leave.user,
            performed_by=request.user,
            details=(
                f"Admin a aprobat cererea de concediu '{leave.get_leave_type_display()}' "
                f"{leave.start_date.strftime('%d.%m.%Y')} → {leave.end_date.strftime('%d.%m.%Y')} "
                f"pentru {leave.user.username}."
            )
        )
        return Response(LeaveRequestSerializer(leave).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsSuperAdmin])
    def reject(self, request, pk=None):
        """POST /duty-days/leaves/{id}/reject/ — Super Admin rejects."""
        leave = self.get_object()
        if leave.status == 'rejected':
            return Response({'detail': 'Cererea este deja respinsă.'}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', '')
        leave.status = 'rejected'
        leave.rejection_reason = reason
        leave.approved_by = None
        leave.approved_at = None
        leave.save()

        _log(
            action='leave_rejected',
            user=leave.user,
            performed_by=request.user,
            details=(
                f"Admin a respins cererea de concediu '{leave.get_leave_type_display()}' "
                f"{leave.start_date.strftime('%d.%m.%Y')} → {leave.end_date.strftime('%d.%m.%Y')} "
                f"pentru {leave.user.username}. Motiv: {reason or '-'}."
            )
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

