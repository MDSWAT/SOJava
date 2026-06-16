import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sidesi_core.settings')
django.setup()

from django.contrib.auth import get_user_model
from apps.duty_days.models import DutyDay, DutyAssignment, CompensatoryDay, LeaveRequest

User = get_user_model()

print("--- USERS ---")
for u in User.objects.all():
    print(f"ID: {u.id}, Username: {u.username}, Name: {u.first_name} {u.last_name}, Role: {u.role.name if u.role else 'None'}")

print("\n--- DUTY DAYS ---")
print(f"Total Duty Days: {DutyDay.objects.count()}")
for dd in DutyDay.objects.order_by('date')[:10]:
    print(f"ID: {dd.id}, Date: {dd.date}, Type: {dd.day_type}, Max Slots: {dd.max_slots}")

print("\n--- ASSIGNMENTS ---")
print(f"Total Assignments: {DutyAssignment.objects.count()}")
for a in DutyAssignment.objects.select_related('duty_day', 'user')[:10]:
    print(f"ID: {a.id}, User: {a.user.username}, Date: {a.duty_day.date}, Status: {a.status}, Comp Option: {a.comp_option}")

print("\n--- COMPENSATORY DAYS ---")
print(f"Total Compensatory Days: {CompensatoryDay.objects.count()}")
for cd in CompensatoryDay.objects.select_related('assignment', 'assignment__user', 'assignment__duty_day')[:10]:
    print(f"ID: {cd.id}, User: {cd.assignment.user.username}, Date: {cd.assignment.duty_day.date}, Comp Date: {cd.compensatory_date}, Comp Type: {cd.comp_type}")

print("\n--- LEAVE REQUESTS ---")
print(f"Total Leave Requests: {LeaveRequest.objects.count()}")
for lr in LeaveRequest.objects.select_related('user')[:10]:
    print(f"ID: {lr.id}, User: {lr.user.username}, Start: {lr.start_date}, End: {lr.end_date}, Type: {lr.leave_type}")
