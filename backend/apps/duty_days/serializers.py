from rest_framework import serializers
from django.contrib.auth import get_user_model
from apps.duty_days.models import (
    CalendarEvent, SaturdayDuty, SaturdayBooking,
    UserDutyBalance, DutyActivityLog, LeaveRequest
)

User = get_user_model()


class SimpleUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'full_name']

    def get_full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name or obj.username


class CalendarEventSerializer(serializers.ModelSerializer):
    created_by_detail = SimpleUserSerializer(source='created_by', read_only=True)

    class Meta:
        model = CalendarEvent
        fields = [
            'id', 'title', 'description', 'event_date',
            'event_type', 'created_by', 'created_by_detail',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']


class SaturdayBookingSerializer(serializers.ModelSerializer):
    user_detail = SimpleUserSerializer(source='user', read_only=True)
    comp_option_display = serializers.CharField(source='get_comp_option_display', read_only=True)

    class Meta:
        model = SaturdayBooking
        fields = [
            'id', 'user', 'user_detail', 'comp_option',
            'comp_option_display', 'recovery_date', 'booked_at'
        ]
        read_only_fields = ['id', 'user', 'comp_option_display', 'booked_at']


class SaturdayDutySerializer(serializers.ModelSerializer):
    booking = serializers.SerializerMethodField()
    is_booked = serializers.BooleanField(read_only=True)
    created_by_detail = SimpleUserSerializer(source='created_by', read_only=True)

    class Meta:
        model = SaturdayDuty
        fields = [
            'id', 'date', 'label', 'notes',
            'is_booked', 'booking',
            'created_by', 'created_by_detail',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_booking(self, obj):
        booking = obj.bookings.select_related('user').first()
        if booking:
            return SaturdayBookingSerializer(booking).data
        return None


class UserDutyBalanceSerializer(serializers.ModelSerializer):
    user_detail = SimpleUserSerializer(source='user', read_only=True)

    class Meta:
        model = UserDutyBalance
        fields = [
            'id', 'user', 'user_detail',
            'days_to_recover', 'free_days_available',
            'updated_at'
        ]
        read_only_fields = ['id', 'user', 'updated_at']


class DutyActivityLogSerializer(serializers.ModelSerializer):
    user_detail = SimpleUserSerializer(source='user', read_only=True)
    performed_by_detail = SimpleUserSerializer(source='performed_by', read_only=True)
    saturday_detail = serializers.SerializerMethodField()
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = DutyActivityLog
        fields = [
            'id', 'user', 'user_detail',
            'performed_by', 'performed_by_detail',
            'action', 'action_display',
            'saturday', 'saturday_detail',
            'free_day_date', 'details',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_saturday_detail(self, obj):
        if obj.saturday:
            return {
                'id': str(obj.saturday.id),
                'date': obj.saturday.date.strftime('%Y-%m-%d'),
                'date_formatted': obj.saturday.date.strftime('%d.%m.%Y'),
                'label': obj.saturday.label,
            }
        return None


class UserBalanceKPISerializer(serializers.Serializer):
    """KPI serializer for Super Admin overview — one row per user."""
    user_id = serializers.UUIDField()
    username = serializers.CharField()
    full_name = serializers.CharField()
    days_to_recover = serializers.IntegerField()
    free_days_available = serializers.IntegerField()
    saturdays_booked = serializers.IntegerField()
    saturdays_booked_upcoming = serializers.IntegerField()


# ─── Leave Request ────────────────────────────────────────────────────────────

class LeaveRequestSerializer(serializers.ModelSerializer):
    user_detail = SimpleUserSerializer(source='user', read_only=True)
    created_by_detail = SimpleUserSerializer(source='created_by', read_only=True)
    approved_by_detail = SimpleUserSerializer(source='approved_by', read_only=True)
    leave_type_display = serializers.CharField(source='get_leave_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    duration_days = serializers.IntegerField(read_only=True)

    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'user', 'user_detail',
            'leave_type', 'leave_type_display',
            'start_date', 'end_date', 'duration_days',
            'notes', 'status', 'status_display',
            'created_by', 'created_by_detail',
            'approved_by', 'approved_by_detail',
            'approved_at', 'rejection_reason',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'user', 'created_by', 'approved_by', 'approved_at',
            'leave_type_display', 'status_display', 'duration_days',
            'created_at', 'updated_at',
        ]

    def validate(self, data):
        start = data.get('start_date')
        end = data.get('end_date')
        if start and end and end < start:
            raise serializers.ValidationError(
                {'end_date': 'Data de final trebuie să fie după data de start.'}
            )
        return data
