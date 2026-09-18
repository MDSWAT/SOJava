export interface Permission {
  id: string;
  code: string;
  module: string;
  description: string;
}

export interface RoleDetail {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  is_system: boolean;
  users_count?: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role_detail: RoleDetail;
  custom_permissions?: Permission[];
  is_active: boolean;
  is_ad_synced: boolean;
  last_sync_at: string | null;
  created_at_formatted: string;
  updated_at_formatted: string;
}

export interface Organization {
  id: string;
  name: string;
  code: string;
  created_at?: string;
  updated_at?: string;
}

export interface PasswordVaultItem {
  id: string;
  organization_id: string;
  organization_detail: Organization;
  title: string;
  login_username: string;
  masked_password: string;
  associated_email: string | null;
  associated_phone: string | null;
  created_by_user: string;
  modified_by_user: string | null;
  created_at_formatted: string;
  updated_at_formatted: string;
  last_accessed_formatted: string | null;
}

export interface PersonalVaultItem {
  id: string;
  title: string;
  login_username: string | null;
  masked_password: string;
  url: string | null;
  notes: string | null;
  category: 'login' | 'note' | 'link' | 'card';
  category_display: string;
  is_favorite: boolean;
  created_at_formatted: string;
  updated_at_formatted: string;
  username_display?: string;
}

export interface AuditLogItem {
  id: string;
  user: string | null;
  username_display: string;
  action: string;
  module: string;
  ip_address: string;
  user_agent: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface DashboardStats {
  totalPasswords: number;
  totalPersonalItems: number;
  totalUsers: number;
  activeSessions: number;
  recentActivity: AuditLogItem[];
  recentAccess: PasswordVaultItem[];
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ─── Duty Days (Zile de Serviciu) ───

export interface CompensatoryDay {
  id: string;
  compensatory_date: string | null;
  compensatory_date_formatted: string | null;
  comp_type: 'past_recovery' | 'future_day_off' | 'pending';
  notes: string;
  user_id: string;
  username: string;
  full_name: string;
  duty_date: string;
  duty_date_formatted: string;
}

export interface DutyAssignmentCalendar {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  replaces_username: string | null;
  replaces_full_name: string | null;
  status: 'confirmed' | 'pending_approval' | 'absent';
  comp_option: 'past_recovery' | 'future_day_off' | 'decide_later';
  has_compensatory_date: boolean;
  compensatory_date?: string | null;
  compensatory_date_formatted?: string | null;
  notes: string;
}

export interface DutyDayCalendar {
  id: string;
  date: string;
  day_type: 'saturday' | 'holiday' | 'event';
  holiday_name: string | null;
  max_slots: number;
  is_full: boolean;
  notes: string;
  assignments: DutyAssignmentCalendar[];
}

export interface DutyBalance {
  available_days: number;
  worked_days: number;
  taken_in_advance: number;
  leaves?: LeaveRequest[];
  upcoming_duties?: {
    id: string;
    date: string;
    date_formatted: string;
    day_type: string;
    holiday_name: string | null;
    notes: string;
  }[];
  absent_list?: {
    assignment_id: string;
    duty_date: string;
    duty_date_formatted: string;
    notes: string;
  }[];
}

export interface UserBalance {
  user_id: string;
  username: string;
  full_name: string;
  available_days: number;
  worked_days: number;
}

export interface DutyLog {
  id: string;
  user: string | null;
  user_detail: { id: string; username: string; full_name: string; } | null;
  target_user: string | null;
  target_user_detail: { id: string; username: string; full_name: string; } | null;
  action: string;
  action_display: string;
  duty_date: string | null;
  details: string;
  created_at: string;
  created_at_formatted: string;
}

export interface LeaveRequest {
  id: string;
  user: string;
  user_detail: { id: string; username: string; full_name: string };
  leave_type: 'rest' | 'study' | 'medical' | 'unpaid' | 'other' | 'absence';
  leave_type_display: string;
  start_date: string;   // YYYY-MM-DD
  end_date: string;     // YYYY-MM-DD
  duration_days: number;
  notes: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  status_display: string;
  created_by: string | null;
  created_by_detail: { id: string; username: string; full_name: string } | null;
  approved_by: string | null;
  approved_by_detail: { id: string; username: string; full_name: string } | null;
  approved_at: string | null;
  rejection_reason: string;
  created_at: string;
  updated_at: string;
}

export interface LeaveSummaryUser {
  user_id: string;
  username: string;
  full_name: string;
  total_approved_days: number;
  by_type: Record<string, { label: string; days: number }>;
  leaves: LeaveRequest[];
}

// ─── New Duty Days Module Types ───────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  event_date: string; // YYYY-MM-DD
  event_type: 'announcement' | 'meeting' | 'reminder' | 'other';
  created_by: string | null;
  created_by_detail: { id: string; username: string; full_name: string; } | null;
  created_at: string;
  updated_at: string;
}

export interface SimpleUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  full_name: string;
}

export interface SaturdayBooking {
  id: string;
  user: string;
  user_detail: SimpleUser;
  comp_option?: 'recovery' | 'decide_later' | 'free_day';
  comp_option_display?: string;
  recovery_date?: string | null;
  free_day_credited?: boolean;
  booked_at: string;
}

export interface Saturday {
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
  notes: string;
  is_booked: boolean;
  booking: SaturdayBooking | null;
  created_by: string | null;
  created_by_detail: SimpleUser | null;
  created_at: string;
  updated_at: string;
}

export interface UserDutyBalance {
  id: string;
  user: string;
  user_detail: SimpleUser;
  days_to_recover: number;
  free_days_available: number;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user: string | null;
  user_detail: SimpleUser | null;
  performed_by: string | null;
  performed_by_detail: SimpleUser | null;
  action: string;
  action_display: string;
  saturday: string | null;
  saturday_detail: {
    id: string;
    date: string;
    date_formatted: string;
    label: string;
  } | null;
  free_day_date: string | null;
  details: string;
  created_at: string;
}

export interface UpcomingSaturday {
  id: string;
  date: string;
  date_formatted: string;
  label: string;
  booked_at: string;
}

export interface MyBalanceResponse {
  balance: UserDutyBalance;
  logs: ActivityLog[];
  upcoming_saturdays: UpcomingSaturday[];
}

export interface UserBalanceKPI {
  user_id: string;
  username: string;
  full_name: string;
  days_to_recover: number;
  free_days_available: number;
  saturdays_booked: number;
  saturdays_booked_upcoming: number;
}

export interface ReportTimelineItem {
  id: string;
  event_type: 'leave' | 'free_day' | 'saturday';
  category: string;
  title: string;
  date_display: string;
  start_date: string;
  end_date: string | null;
  duration_days: number;
  status: string;
  status_display: string;
  notes: string;
  details: string;
  approved_by: string;
  timestamp: string;
}

export interface ReportKPI {
  total_leaves: number;
  leaves_by_type: {
    rest: number;
    medical: number;
    study: number;
    unpaid: number;
    absence: number;
    other: number;
  };
  free_days_taken: number;
  saturdays_served: number;
  saturdays_upcoming: number;
  current_free_days_balance: number;
  current_days_to_recover: number;
}

export interface UserDetailedReport {
  user: SimpleUser;
  year_filter: number | null;
  balance: {
    days_to_recover: number;
    free_days_available: number;
    updated_at: string;
  };
  kpi: ReportKPI;
  timeline: ReportTimelineItem[];
  leaves: any[];
  free_days: any[];
  saturdays: any[];
  activity_logs: ActivityLog[];
}

export interface PaginatedActivityLogs {
  count: number;
  limit: number;
  results: ActivityLog[];
}


export interface Raion {
  id: string;
  name: string;
  code: string;
  color: string;
  ecc_count: number;
  created_at: string;
}

export interface RaionStats {
  raioane: Raion[];
  unassigned: number;
}

export interface VirtualECCItem {
  id: string;
  terminal_id: string;
  oficiu: string;
  tel_oficiu: string | null;
  nr_inregistrare_sfs: string | null;
  nr_ordine: string | null;
  data_inregistrare: string | null;
  denumire_entitate: string | null;
  idno: string | null;
  model_ecc: string | null;
  adresa_ecc: string | null;
  ip_adresa: string | null;
  masked_mev_key: string;
  plain_mev_key?: string | null;
  status: 'neconfigurat' | 'aplicatie_instalata' | 'in_certificare' | 'certificat' | 'eroare_certificare' | 'pus_in_exploatare';
  raion_id: string | null;
  raion_detail: Raion | null;
  comentarii: string | null;
  pdf_file: string | null;
  pdf_file_url: string | null;
  z_raport: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardStatsData {
  users: {
    total: number;
    active: number;
  };
  vault: {
    shared_count: number;
    personal_count: number;
  };
  virtual_ecc: {
    total: number;
    by_status: {
      pus_in_exploatare: number;
      neconfigurat: number;
      certificat: number;
      in_certificare: number;
      eroare_certificare: number;
      aplicatie_instalata: number;
    };
    with_ip: number;
    without_ip: number;
    with_mev: number;
    without_mev: number;
    z_raport_count: number;
  };
  posta_contacts: {
    total_contacts: number;
    total_raioane: number;
    ingineri_count: number;
    oficii_count: number;
  };
  duty_days: {
    next_duty: {
      date: string;
      user_name: string;
      is_booked: boolean;
      label: string;
    } | null;
    active_leaves_today: number;
    upcoming_leaves_count: number;
  };
  inventory: {
    total_items: number;
  };
  chart_data: Array<{
    date: string;
    name: string;
    reveals: number;
    copies: number;
    updates: number;
    logins: number;
    total: number;
  }>;
  recent_logs: Array<{
    id: string;
    username_display: string;
    action: string;
    module: string;
    details: any;
    created_at: string;
  }>;
}

