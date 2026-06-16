import { create } from 'zustand';
import api from '@/services/api';
import {
  CalendarEvent, Saturday, MyBalanceResponse,
  UserBalanceKPI, ActivityLog, LeaveRequest, LeaveSummaryUser
} from '@/types';

interface DutyDaysState {
  // ── Tab 1: Calendar ──────────────────────────────────────────────────────
  calendarEvents: CalendarEvent[];
  calendarYear: number;
  calendarMonth: number;

  // ── Tab 2: Zile de Serviciu ──────────────────────────────────────────────
  saturdays: Saturday[];
  saturdaysYear: number;

  // ── My data ──────────────────────────────────────────────────────────────
  myData: MyBalanceResponse | null;

  // ── Admin ─────────────────────────────────────────────────────────────────
  allBalances: UserBalanceKPI[];
  adminLogs: ActivityLog[];

  // ── Leave (Concediu) ──────────────────────────────────────────────────────
  myLeaves: LeaveRequest[];
  allLeaves: LeaveRequest[];
  calendarLeaves: LeaveRequest[];  // approved, for current calendar month
  leaveSummary: LeaveSummaryUser[];

  isLoading: boolean;
  error: string | null;

  // ── Actions ───────────────────────────────────────────────────────────────

  // Calendar
  fetchCalendarEvents: (year: number, month: number) => Promise<void>;
  setCalendarMonth: (year: number, month: number) => void;
  createCalendarEvent: (data: {
    title: string;
    description?: string;
    event_date: string;
    event_type: string;
  }) => Promise<boolean>;
  deleteCalendarEvent: (id: string) => Promise<boolean>;

  // Saturdays
  fetchSaturdays: (year?: number) => Promise<void>;
  setSaturdaysYear: (year: number) => void;
  createSaturday: (data: { date: string; label?: string; notes?: string }) => Promise<boolean>;
  deleteSaturday: (id: string) => Promise<boolean>;
  bookSaturday: (saturdayId: string, userId?: string) => Promise<boolean>;
  bookSaturdayDate: (data: {
    date: string;
    userId?: string;
    compOption: 'recovery' | 'decide_later' | 'free_day';
    recoveryDate?: string;
  }) => Promise<boolean>;
  cancelSaturday: (saturdayId: string, userId?: string) => Promise<boolean>;

  // Balance
  fetchMyData: () => Promise<void>;
  takeFreeDays: (freeDayDate: string) => Promise<boolean>;

  // Admin
  fetchAllBalances: () => Promise<void>;
  adjustBalance: (userId: string, daysToRecover: number, freeDaysAvailable: number, reason?: string) => Promise<boolean>;
  markUserAbsent: (userId: string, date: string) => Promise<boolean>;
  fetchAdminLogs: (userId?: string) => Promise<void>;

  // Leave (Concediu)
  fetchMyLeaves: () => Promise<void>;
  fetchAllLeaves: (filters?: { userId?: string; status?: string; year?: string }) => Promise<void>;
  fetchCalendarLeaves: (start: string, end: string) => Promise<void>;
  fetchLeaveSummary: () => Promise<void>;
  createLeave: (data: {
    leave_type: string;
    start_date: string;
    end_date: string;
    notes?: string;
    user_id?: string;
  }) => Promise<boolean>;
  updateLeave: (id: string, data: { leave_type?: string; start_date?: string; end_date?: string; notes?: string }) => Promise<boolean>;
  deleteLeave: (id: string) => Promise<boolean>;
  approveLeave: (id: string) => Promise<boolean>;
  rejectLeave: (id: string, reason?: string) => Promise<boolean>;

  clearError: () => void;
}

const now = new Date();

export const useDutyDaysStore = create<DutyDaysState>((set, get) => ({
  calendarEvents: [],
  calendarYear: now.getFullYear(),
  calendarMonth: now.getMonth() + 1,

  saturdays: [],
  saturdaysYear: now.getFullYear(),

  myData: null,
  allBalances: [],
  adminLogs: [],

  myLeaves: [],
  allLeaves: [],
  calendarLeaves: [],
  leaveSummary: [],

  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  // ── Calendar ─────────────────────────────────────────────────────────────

  setCalendarMonth: (year, month) => {
    set({ calendarYear: year, calendarMonth: month });
  },

  fetchCalendarEvents: async (year, month) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get('/duty-days/events/', { params: { year, month } });
      set({ calendarEvents: res.data, isLoading: false });
    } catch {
      set({ error: 'Eroare la încărcarea evenimentelor.', isLoading: false });
    }
  },

  createCalendarEvent: async (data) => {
    try {
      await api.post('/duty-days/events/', data);
      const { calendarYear, calendarMonth } = get();
      await get().fetchCalendarEvents(calendarYear, calendarMonth);
      return true;
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      set({ error: detail || 'Eroare la crearea evenimentului.' });
      return false;
    }
  },

  deleteCalendarEvent: async (id) => {
    try {
      await api.delete(`/duty-days/events/${id}/`);
      const { calendarYear, calendarMonth } = get();
      await get().fetchCalendarEvents(calendarYear, calendarMonth);
      return true;
    } catch {
      set({ error: 'Eroare la ștergerea evenimentului.' });
      return false;
    }
  },

  // ── Saturdays ─────────────────────────────────────────────────────────────

  setSaturdaysYear: (year) => {
    set({ saturdaysYear: year });
    get().fetchSaturdays(year);
  },

  fetchSaturdays: async (year) => {
    set({ isLoading: true, error: null });
    try {
      const y = year ?? get().saturdaysYear;
      const res = await api.get('/duty-days/saturdays/', { params: { year: y } });
      set({ saturdays: res.data, isLoading: false });
    } catch {
      set({ error: 'Eroare la încărcarea sâmbetelor.', isLoading: false });
    }
  },

  createSaturday: async (data) => {
    try {
      await api.post('/duty-days/saturdays/', data);
      await get().fetchSaturdays();
      return true;
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      set({ error: detail || 'Eroare la crearea sâmbetei.' });
      return false;
    }
  },

  deleteSaturday: async (id) => {
    try {
      await api.delete(`/duty-days/saturdays/${id}/`);
      await get().fetchSaturdays();
      await get().fetchAllBalances();
      return true;
    } catch {
      set({ error: 'Eroare la ștergerea sâmbetei.' });
      return false;
    }
  },

  bookSaturday: async (saturdayId, userId) => {
    try {
      const payload: Record<string, string> = {};
      if (userId) payload.user_id = userId;
      await api.post(`/duty-days/saturdays/${saturdayId}/book/`, payload);
      await get().fetchSaturdays();
      await get().fetchMyData();
      return true;
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      set({ error: detail || 'Eroare la rezervarea sâmbetei.' });
      return false;
    }
  },

  bookSaturdayDate: async (data) => {
    try {
      const payload: Record<string, string> = {
        date: data.date,
        comp_option: data.compOption,
      };
      if (data.userId) payload.user_id = data.userId;
      if (data.recoveryDate) payload.recovery_date = data.recoveryDate;

      await api.post('/duty-days/saturdays/book-date/', payload);
      await get().fetchSaturdays();
      await get().fetchMyData();
      return true;
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      set({ error: detail || 'Eroare la rezervarea sâmbetei.' });
      return false;
    }
  },

  cancelSaturday: async (saturdayId, userId) => {
    try {
      const payload: Record<string, string> = {};
      if (userId) payload.user_id = userId;
      await api.post(`/duty-days/saturdays/${saturdayId}/cancel/`, payload);
      await get().fetchSaturdays();
      await get().fetchMyData();
      await get().fetchAllBalances();
      return true;
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      set({ error: detail || 'Eroare la anularea rezervării.' });
      return false;
    }
  },

  // ── Balance ───────────────────────────────────────────────────────────────

  fetchMyData: async () => {
    try {
      const res = await api.get('/duty-days/balance/me/');
      set({ myData: res.data });
    } catch {
      // Silently fail
    }
  },

  takeFreeDays: async (freeDayDate) => {
    try {
      await api.post('/duty-days/balance/take-free-day/', { free_day_date: freeDayDate });
      await get().fetchMyData();
      return true;
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      set({ error: detail || 'Eroare la marcarea zilei libere.' });
      return false;
    }
  },

  // ── Admin ─────────────────────────────────────────────────────────────────

  fetchAllBalances: async () => {
    try {
      const res = await api.get('/duty-days/balance/all/');
      set({ allBalances: res.data });
    } catch {
      // Silently fail — non-admin will get 403, that's fine
    }
  },

  adjustBalance: async (userId, daysToRecover, freeDaysAvailable, reason) => {
    try {
      await api.post('/duty-days/balance/adjust/', {
        user_id: userId,
        days_to_recover: daysToRecover,
        free_days_available: freeDaysAvailable,
        reason: reason || '',
      });
      await get().fetchAllBalances();
      await get().fetchMyData();
      return true;
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      set({ error: detail || 'Eroare la ajustarea balanței.' });
      return false;
    }
  },

  fetchAdminLogs: async (userId) => {
    try {
      const params = userId ? { user_id: userId } : {};
      const res = await api.get('/duty-days/logs/', { params });
      set({ adminLogs: res.data });
    } catch {
      // Silently fail
    }
  },

  markUserAbsent: async (userId, date) => {
    try {
      await api.post('/duty-days/balance/mark-absent/', {
        user_id: userId,
        date: date,
      });
      await get().fetchAllBalances();
      await get().fetchMyData();
      return true;
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      set({ error: detail || 'Eroare la marcarea ca absent.' });
      return false;
    }
  },

  // ── Leave ─────────────────────────────────────────────────────────────────

  fetchMyLeaves: async () => {
    try {
      const res = await api.get('/duty-days/leaves/');
      set({ myLeaves: res.data });
    } catch {
      // Silently fail
    }
  },

  fetchAllLeaves: async (filters) => {
    try {
      const params: Record<string, string> = {};
      if (filters?.userId) params.user_id = filters.userId;
      if (filters?.status) params.status = filters.status;
      if (filters?.year) params.year = filters.year;
      const res = await api.get('/duty-days/leaves/', { params });
      set({ allLeaves: res.data });
    } catch {
      // Silently fail
    }
  },

  fetchCalendarLeaves: async (start, end) => {
    try {
      const res = await api.get('/duty-days/leaves/calendar/', { params: { start, end } });
      set({ calendarLeaves: res.data });
    } catch {
      // Silently fail
    }
  },

  fetchLeaveSummary: async () => {
    try {
      const res = await api.get('/duty-days/leaves/summary/');
      set({ leaveSummary: res.data });
    } catch {
      // Silently fail — non-admin will get 403
    }
  },

  createLeave: async (data) => {
    try {
      const payload: Record<string, string> = {
        leave_type: data.leave_type,
        start_date: data.start_date,
        end_date: data.end_date,
      };
      if (data.notes) payload.notes = data.notes;
      if (data.user_id) payload.user_id = data.user_id;
      await api.post('/duty-days/leaves/', payload);
      await get().fetchMyLeaves();
      return true;
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      set({ error: detail || 'Eroare la adăugarea concediului.' });
      return false;
    }
  },

  updateLeave: async (id, data) => {
    try {
      await api.patch(`/duty-days/leaves/${id}/`, data);
      await get().fetchMyLeaves();
      return true;
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      set({ error: detail || 'Eroare la editarea concediului.' });
      return false;
    }
  },

  deleteLeave: async (id) => {
    try {
      await api.delete(`/duty-days/leaves/${id}/`);
      await get().fetchMyLeaves();
      return true;
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      set({ error: detail || 'Eroare la ștergerea concediului.' });
      return false;
    }
  },

  approveLeave: async (id) => {
    try {
      await api.post(`/duty-days/leaves/${id}/approve/`);
      await get().fetchAllLeaves();
      await get().fetchLeaveSummary();
      return true;
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      set({ error: detail || 'Eroare la aprobarea concediului.' });
      return false;
    }
  },

  rejectLeave: async (id, reason) => {
    try {
      await api.post(`/duty-days/leaves/${id}/reject/`, { reason: reason || '' });
      await get().fetchAllLeaves();
      await get().fetchLeaveSummary();
      return true;
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      set({ error: detail || 'Eroare la respingerea concediului.' });
      return false;
    }
  },
}));
