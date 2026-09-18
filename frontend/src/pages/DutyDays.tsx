import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, CalendarDays, ChevronLeft, ChevronRight, Plus, X,
  AlertTriangle, CheckCircle2, Clock,
  Megaphone, Video, Bell, Star, Trash2, Edit3, CalendarCheck,
  Shield, BarChart3,
  SunDim, Loader2, Plane, BookOpen, Stethoscope, HelpCircle, RefreshCw,
  FileSpreadsheet, FileText, Download, Filter, Search,
  History
} from 'lucide-react';
import { useDutyDaysStore } from '@/context/dutyDaysStore';
import { useAuthStore } from '@/context/authStore';
import { CalendarEvent, UserBalanceKPI, LeaveRequest, ReportTimelineItem } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS_RO = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
];
const DAYS_RO = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];

const EVENT_COLORS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  announcement: { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-400', label: 'Anunț' },
  meeting:      { bg: 'bg-blue-500/15 border-blue-500/30',   text: 'text-blue-400',  dot: 'bg-blue-400',  label: 'Ședință' },
  reminder:     { bg: 'bg-violet-500/15 border-violet-500/30',text: 'text-violet-400',dot: 'bg-violet-400',label: 'Reminder' },
  other:        { bg: 'bg-slate-500/15 border-slate-500/30', text: 'text-slate-400', dot: 'bg-slate-400', label: 'Altele' },
};

const EVENT_ICONS: Record<string, React.ReactNode> = {
  announcement: <Megaphone className="w-3.5 h-3.5" />,
  meeting:      <Video className="w-3.5 h-3.5" />,
  reminder:     <Bell className="w-3.5 h-3.5" />,
  other:        <Star className="w-3.5 h-3.5" />,
};

const ACTION_COLORS: Record<string, string> = {
  saturday_booked:   'text-emerald-400',
  saturday_cancelled:'text-rose-400',
  free_day_taken:    'text-cyan-400',
  balance_adjusted:  'text-amber-400',
  saturday_created:  'text-blue-400',
  saturday_deleted:  'text-rose-400',
  event_created:     'text-violet-400',
  event_deleted:     'text-rose-400',
  leave_created:     'text-amber-400',
  leave_approved:    'text-emerald-400',
  leave_rejected:    'text-rose-400',
  leave_deleted:     'text-slate-400',
};

// ─── Small reusable components ────────────────────────────────────────────────

const Spinner = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="w-7 h-7 text-sidesi-400 animate-spin" />
  </div>
);

const ErrorBanner: React.FC<{ msg: string; onClose: () => void }> = ({ msg, onClose }) => (
  <motion.div
    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
    className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/30 text-rose-500 dark:text-rose-400 rounded-xl px-4 py-3 text-sm mb-4"
  >
    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
    <span className="flex-1">{msg}</span>
    <button onClick={onClose} className="hover:text-rose-300"><X className="w-4 h-4" /></button>
  </motion.div>
);

const Modal: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  headerExtra?: React.ReactNode;
}> = ({ title, onClose, children, maxWidth = 'max-w-md', headerExtra }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
      transition={{ type: 'spring', damping: 22, stiffness: 280 }}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl w-full ${maxWidth} shadow-2xl max-h-[92vh] flex flex-col`}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">{title}</h3>
          {headerExtra}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6 overflow-y-auto flex-1">{children}</div>
    </motion.div>
  </motion.div>
);

const inputCls = "w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sidesi-500/60 focus:ring-1 focus:ring-sidesi-500/30 transition-all";
const labelCls = "block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide";
const btnPrimary = "flex items-center gap-2 bg-sidesi-600 hover:bg-sidesi-500 text-white font-medium text-sm px-4 py-2 rounded-xl transition-all duration-150 disabled:opacity-50";
const btnSecondary = "flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700/60 transition-all duration-150";

// ─── Leave Type Config ────────────────────────────────────────────────────────

const LEAVE_CONFIG: Record<string, { label: string; icon: React.ReactNode; dot: string; bg: string; text: string; badge: string }> = {
  rest:    { label: 'Concediu Odihnă',   icon: <Plane       className="w-3.5 h-3.5" />, dot: 'bg-amber-400',  bg: 'bg-amber-500/10 border-amber-500/25',   text: 'text-amber-400',  badge: 'bg-amber-500/20 text-amber-300' },
  study:   { label: 'Concediu Studii',   icon: <BookOpen    className="w-3.5 h-3.5" />, dot: 'bg-blue-400',   bg: 'bg-blue-500/10 border-blue-500/25',     text: 'text-blue-400',   badge: 'bg-blue-500/20 text-blue-300' },
  medical: { label: 'Concediu Medical',  icon: <Stethoscope className="w-3.5 h-3.5" />, dot: 'bg-teal-400',   bg: 'bg-teal-500/10 border-teal-500/25',     text: 'text-teal-400',   badge: 'bg-teal-500/20 text-teal-300' },
  unpaid:  { label: 'Concediu Fără Plată', icon: <Clock     className="w-3.5 h-3.5" />, dot: 'bg-slate-400',  bg: 'bg-slate-200/60 border-slate-300 dark:bg-slate-700/40 border-slate-700/40',   text: 'text-slate-500 dark:text-slate-400',  badge: 'bg-slate-200/50 text-slate-500 dark:bg-slate-700/30 dark:text-slate-400' },
  other:   { label: 'Alt Concediu',      icon: <HelpCircle  className="w-3.5 h-3.5" />, dot: 'bg-purple-400', bg: 'bg-purple-500/10 border-purple-500/25', text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-300' },
  absence: { label: 'Absență / Lipsă',   icon: <AlertTriangle className="w-3.5 h-3.5" />, dot: 'bg-rose-500', bg: 'bg-rose-500/10 border-rose-500/25',   text: 'text-rose-400',   badge: 'bg-rose-500/20 text-rose-300' },
};

const STATUS_BADGE: Record<string, string> = {
  draft:    'bg-slate-200/60 text-slate-500 dark:bg-slate-700/60 dark:text-slate-400',
  pending:  'bg-amber-500/20 text-amber-300',
  approved: 'bg-emerald-500/20 text-emerald-300',
  rejected: 'bg-rose-500/20 text-rose-300',
};

// ─── Calendar Tab ─────────────────────────────────────────────────────────────

const CalendarTab: React.FC<{ onRedirectToSaturday?: (date: string) => void }> = ({ onRedirectToSaturday: _onRedirectToSaturday }) => {
  const {
    calendarEvents, calendarYear, calendarMonth, setCalendarMonth,
    createCalendarEvent, deleteCalendarEvent, isLoading, error, clearError,
    saturdays, allBalances, fetchAllBalances, markUserAbsent,
    calendarLeaves, fetchCalendarLeaves, bookSaturdayDate, cancelSaturday, fetchSaturdays
  } = useDutyDaysStore();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role_detail?.name === 'Super Admin';

  const [absentUserId, setAbsentUserId] = useState('');
  const [markingAbsent, setMarkingAbsent] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', event_date: '', event_type: 'announcement' });
  const [saving, setSaving] = useState(false);

  // Book Saturday directly in Calendar
  const [showCalendarBookModal, setShowCalendarBookModal] = useState<{ date: string } | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [compOption, setCompOption] = useState<'recovery' | 'decide_later' | 'free_day'>('decide_later');
  const [recoveryDate, setRecoveryDate] = useState<string>('');
  const [bookingSaving, setBookingSaving] = useState(false);

  const handleCalendarBookSubmit = async () => {
    if (!showCalendarBookModal) return;
    setBookingSaving(true);
    const ok = await bookSaturdayDate({
      date: showCalendarBookModal.date,
      userId: isSuperAdmin && selectedUser ? selectedUser : undefined,
      compOption,
      recoveryDate: compOption === 'recovery' ? recoveryDate : undefined,
    });
    setBookingSaving(false);
    if (ok) {
      setShowCalendarBookModal(null);
      setSelectedUser('');
      setCompOption('decide_later');
      setRecoveryDate('');
      fetchSaturdays(calendarYear);
      if (isSuperAdmin) fetchAllBalances();
    }
  };

  useEffect(() => {
    if (isSuperAdmin && allBalances.length === 0) {
      fetchAllBalances();
    }
    // Fetch leave data for calendar month
    const firstDay = new Date(calendarYear, calendarMonth - 1, 1);
    const lastDay  = new Date(calendarYear, calendarMonth, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    const start = `${calendarYear}-${pad(calendarMonth)}-01`;
    const end   = `${calendarYear}-${pad(calendarMonth)}-${pad(lastDay.getDate())}`;
    void firstDay;
    fetchCalendarLeaves(start, end);
  }, [isSuperAdmin, allBalances.length, fetchAllBalances, calendarYear, calendarMonth, fetchCalendarLeaves]);

  const handleMarkAbsent = async () => {
    if (!selectedDay || !absentUserId) return;
    setMarkingAbsent(true);
    const ok = await markUserAbsent(absentUserId, selectedDay);
    setMarkingAbsent(false);
    if (ok) {
      setAbsentUserId('');
    }
  };

  // Build calendar grid (Mon-first)
  const firstDay = new Date(calendarYear, calendarMonth - 1, 1);
  const lastDay = new Date(calendarYear, calendarMonth, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0
  const totalCells = startOffset + lastDay.getDate();
  const gridCells = Math.ceil(totalCells / 7) * 7;

  const eventsByDate: Record<string, CalendarEvent[]> = {};
  calendarEvents.forEach(ev => {
    if (!eventsByDate[ev.event_date]) eventsByDate[ev.event_date] = [];
    eventsByDate[ev.event_date].push(ev);
  });

  // Build leave index: date -> list of approved leaves that cover it
  const leavesByDate: Record<string, LeaveRequest[]> = {};
  calendarLeaves.forEach(lr => {
    const start = new Date(lr.start_date + 'T12:00:00');
    const end   = new Date(lr.end_date   + 'T12:00:00');
    const cur   = new Date(start);
    while (cur <= end) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
      if (!leavesByDate[key]) leavesByDate[key] = [];
      leavesByDate[key].push(lr);
      cur.setDate(cur.getDate() + 1);
    }
  });

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prevMonth = () => {
    if (calendarMonth === 1) setCalendarMonth(calendarYear - 1, 12);
    else setCalendarMonth(calendarYear, calendarMonth - 1);
  };
  const nextMonth = () => {
    if (calendarMonth === 12) setCalendarMonth(calendarYear + 1, 1);
    else setCalendarMonth(calendarYear, calendarMonth + 1);
  };

  const handleAddEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.event_date) return;
    setSaving(true);
    const ok = await createCalendarEvent(newEvent);
    setSaving(false);
    if (ok) {
      setShowAddEvent(false);
      setNewEvent({ title: '', description: '', event_date: '', event_type: 'announcement' });
    }
  };

  const selectedEvents = selectedDay ? (eventsByDate[selectedDay] || []) : [];
  const selectedLeaves = selectedDay ? (leavesByDate[selectedDay] || []) : [];

  const selectedDateObj = selectedDay ? new Date(selectedDay + 'T12:00:00') : null;
  const isSelectedSaturday = selectedDateObj ? selectedDateObj.getDay() === 6 : false;
  const dbSat = selectedDay ? saturdays.find(s => s.date === selectedDay) : null;
  const isFreeSaturday = isSelectedSaturday && (!dbSat || !dbSat.is_booked);

  return (
    <div className="space-y-5">
      <AnimatePresence>{error && <ErrorBanner msg={error} onClose={clearError} />}</AnimatePresence>

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700/60 transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 min-w-[200px] text-center">
            {MONTHS_RO[calendarMonth - 1]} <span className="text-sidesi-400">{calendarYear}</span>
          </h2>
          <button onClick={nextMonth} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700/60 transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {isSuperAdmin && (
          <button onClick={() => setShowAddEvent(true)} className={btnPrimary}>
            <Plus className="w-4 h-4" /> Adaugă Eveniment
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 min-h-[550px] h-auto lg:h-[calc(100vh-16.5rem)]">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 rounded-2xl p-5 relative flex flex-col h-full overflow-hidden">
          {isLoading && (
            <div className="absolute top-4 right-4 z-10 animate-fade-in">
              <Loader2 className="w-4 h-4 text-sidesi-400 animate-spin" />
            </div>
          )}
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2.5">
            {DAYS_RO.map(d => (
              <div key={d} className={`text-center text-xs font-bold py-1.5 ${d === 'Sâm' ? 'text-sidesi-400' : d === 'Dum' ? 'text-rose-400' : 'text-slate-500 dark:text-slate-500'}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Grid cells */}
          <div className="grid grid-cols-7 auto-rows-fr gap-px bg-slate-200 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 flex-grow flex-1">
            {Array.from({ length: gridCells }).map((_, idx) => {
              const dayNum = idx - startOffset + 1;
              const isValid = dayNum >= 1 && dayNum <= lastDay.getDate();
              if (!isValid) return <div key={idx} className="bg-slate-50 dark:bg-slate-950/15 h-full w-full" />;

              const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayEvents = eventsByDate[dateStr] || [];
              const dayLeaves = leavesByDate[dateStr] || [];
              const isToday = dateStr === todayStr;
              const isSat = (idx % 7) === 5;
              const isSun = (idx % 7) === 6;
              const isSelected = selectedDay === dateStr;

              const dbSat = isSat ? saturdays.find(s => s.date === dateStr) : null;
              const isBooked = !!dbSat?.is_booked;
              const bookingUser = dbSat?.booking?.user_detail?.full_name || dbSat?.booking?.user_detail?.username;

              let cellClasses = "h-full w-full flex flex-col items-center justify-between py-2.5 px-1 transition-all duration-150 relative border-0 rounded-none ";

              if (isToday) {
                cellClasses += "bg-sidesi-600/20 ring-1 ring-inset ring-sidesi-500/50 ";
              } else if (isSelected) {
                cellClasses += "bg-sidesi-500/20 text-sidesi-200 ";
              } else if (isSat) {
                cellClasses += isBooked
                  ? "bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/30 "
                  : "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/20 ";
              } else {
                cellClasses += "bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800/80 ";
                if (isSun) {
                  cellClasses += "text-rose-400/90 ";
                } else {
                  cellClasses += "text-slate-700 dark:text-slate-300 ";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                  className={cellClasses}
                >
                  {/* Day number — pill badge for today */}
                  <div className="flex flex-col items-center gap-1.5 w-full">
                    {isToday ? (
                      <span className="w-6 h-6 flex items-center justify-center rounded-full bg-sidesi-500 text-white text-xs font-black leading-none shadow-md shadow-sidesi-500/40">
                        {dayNum}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold leading-none">
                        {dayNum}
                      </span>
                    )}
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5 justify-center">
                        {dayEvents.slice(0, 3).map(ev => (
                          <span key={ev.id} className={`w-1.5 h-1.5 rounded-full ${EVENT_COLORS[ev.event_type]?.dot || 'bg-slate-400'}`} />
                        ))}
                      </div>
                    )}
                    {/* Subtle leave indicators */}
                    {dayLeaves.length > 0 && (
                      <div className="flex gap-0.5 justify-center flex-wrap">
                        {[...new Set(dayLeaves.map(l => l.leave_type))].slice(0, 2).map(lt => (
                          <span key={lt} className={`w-1 h-1 rounded-full opacity-70 ${LEAVE_CONFIG[lt]?.dot || 'bg-slate-400'}`} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bottom label: "Astăzi" for today, or Saturday booking info */}
                  <div className="w-full text-center mt-auto mb-0.5 px-0.5 overflow-hidden">
                    {isToday ? (
                      <span className="text-[9px] font-black text-sidesi-400 uppercase tracking-wide block leading-tight">
                        Astăzi
                      </span>
                    ) : isSat ? (
                      isBooked ? (
                        <span className="text-[9px] font-bold text-violet-400 block truncate leading-tight" title={bookingUser}>
                          {bookingUser ? bookingUser.split(' ')[0] : 'Ocupat'}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-emerald-500/80 block truncate leading-tight">
                          Liberă
                        </span>
                      )
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Side Panel — Day Events */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 rounded-2xl p-5 flex flex-col h-full overflow-hidden">
          {selectedDay ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                  {new Date(selectedDay + 'T12:00:00').toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <div className="flex items-center gap-2">
                  {isSuperAdmin && (
                    <button
                      onClick={() => { setNewEvent(p => ({ ...p, event_date: selectedDay })); setShowAddEvent(true); }}
                      className="flex items-center gap-1 text-xs bg-sidesi-600/80 hover:bg-sidesi-500 text-white px-2.5 py-1.5 rounded-lg transition-all"
                      title="Adaugă eveniment în această zi"
                    >
                      <Plus className="w-3 h-3" /> Adaugă
                    </button>
                  )}
                  <button onClick={() => setSelectedDay(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {selectedEvents.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                  <CalendarDays className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-3" />
                  <p className="text-slate-500 text-sm">Niciun eveniment în această zi</p>
                </div>
              ) : (
                <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                  {selectedEvents.map(ev => {
                    const colors = EVENT_COLORS[ev.event_type] || EVENT_COLORS.other;
                    return (
                      <div key={ev.id} className={`border rounded-xl p-3 ${colors.bg}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={colors.text}>{EVENT_ICONS[ev.event_type]}</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">{ev.title}</span>
                          </div>
                          {isSuperAdmin && (
                            <button onClick={() => deleteCalendarEvent(ev.id)}
                              className="text-slate-400 hover:text-rose-400 flex-shrink-0 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {ev.description && (
                          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 leading-relaxed">{ev.description}</p>
                        )}
                        <span className={`text-[10px] font-semibold ${colors.text} mt-1 block`}>{colors.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Leaves on this day (below events) */}
              {selectedLeaves.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 flex-shrink-0">
                  <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Plane className="w-3.5 h-3.5 text-amber-400" /> Concedii în această zi
                  </h4>
                  {selectedLeaves.map(lr => {
                    const cfg = LEAVE_CONFIG[lr.leave_type] || LEAVE_CONFIG.other;
                    return (
                      <div key={lr.id} className={`border rounded-xl px-3 py-2 flex items-center gap-2 ${cfg.bg}`}>
                        <span className={cfg.text}>{cfg.icon}</span>
                        <span className="text-slate-800 dark:text-slate-200 text-xs font-medium">{lr.user_detail.full_name}</span>
                        <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${cfg.badge}`}>{cfg.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Optional Redirect for free Saturdays */}
              {isFreeSaturday && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 flex-shrink-0 animate-fade-in">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-500 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Această sâmbătă este liberă!</span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedUser('');
                      setCompOption('decide_later');
                      setRecoveryDate('');
                      setShowCalendarBookModal({ date: selectedDay });
                    }}
                    className="w-full bg-sidesi-600 hover:bg-sidesi-500 text-white font-medium text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-sidesi-500/10"
                  >
                    <CalendarCheck className="w-4 h-4" /> Alocă / Rezervă
                  </button>
                </div>
              )}

              {/* Saturday booking info (if selected day is Saturday and booked) */}
              {isSelectedSaturday && dbSat?.is_booked && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 flex-shrink-0 animate-fade-in">
                  <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 text-xs text-violet-500 dark:text-violet-400 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 font-semibold">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Sâmbătă de Serviciu Ocupată</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      Rezervată de: <strong>{dbSat.booking?.user_detail?.full_name || dbSat.booking?.user_detail?.username}</strong>
                    </p>
                    {dbSat.booking?.comp_option_display && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-500">
                        Opțiune: {dbSat.booking.comp_option_display}
                        {dbSat.booking.comp_option === 'recovery' && dbSat.booking.recovery_date && ` (Ziua: ${dbSat.booking.recovery_date})`}
                      </p>
                    )}
                  </div>
                  {/* Cancel option */}
                  {((dbSat.booking?.user_detail?.id === user?.id) || isSuperAdmin) && (
                    <button
                      onClick={async () => {
                        const confirmCancel = window.confirm("Sigur doriți să anulați această rezervare?");
                        if (confirmCancel) {
                          const ok = await cancelSaturday(dbSat.id, dbSat.booking?.user);
                          if (ok) {
                            fetchSaturdays(calendarYear);
                          }
                        }
                      }}
                      className="w-full bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" /> Anulează Rezervarea
                    </button>
                  )}
                </div>
              )}

              {/* Mark Absent Section (Super Admin only) */}
              {isSuperAdmin && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 flex-shrink-0">
                  <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" /> Raportează Absență
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-500 leading-normal">
                    Selectează o persoană care a lipsit în această zi. I se va adăuga o zi de recuperat în balanță.
                  </p>
                  <div className="flex gap-2">
                    <select
                      value={absentUserId}
                      onChange={e => setAbsentUserId(e.target.value)}
                      className="flex-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-sidesi-500/60"
                    >
                      <option value="">Alege persoana...</option>
                      {allBalances.map(u => (
                        <option key={u.user_id} value={u.user_id}>
                          {u.full_name} (@{u.username})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleMarkAbsent}
                      disabled={!absentUserId || markingAbsent}
                      className="bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-medium text-xs px-3 py-2 rounded-xl transition-all flex items-center gap-1 flex-shrink-0"
                    >
                      {markingAbsent ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Absent'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm">Selectează o zi<br />pentru a vedea evenimentele</p>
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-1.5">
            {Object.entries(EVENT_COLORS).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${val.dot}`} />
                <span className="text-xs text-slate-500 dark:text-slate-500">{val.label}</span>
              </div>
            ))}
            <div className="col-span-2 mt-1 border-t border-slate-200/50 dark:border-slate-800/60 pt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {Object.entries(LEAVE_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full opacity-60 ${cfg.dot}`} />
                  <span className="text-[10px] text-slate-400 dark:text-slate-600">{cfg.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming events list */}
      {calendarEvents.length > 0 && (
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 rounded-2xl p-5">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-sidesi-400" /> Evenimente Luna Aceasta
          </h3>
          <div className="space-y-2">
            {calendarEvents.map(ev => {
              const colors = EVENT_COLORS[ev.event_type] || EVENT_COLORS.other;
              const d = new Date(ev.event_date + 'T12:00:00');
              return (
                <div key={ev.id} className="flex items-center gap-3 group">
                  <div className="text-center w-10 flex-shrink-0">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{d.toLocaleDateString('ro-RO', { weekday: 'short' })}</div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{d.getDate()}</div>
                  </div>
                  <div className={`flex-1 flex items-center gap-2 border rounded-xl px-3 py-2 ${colors.bg}`}>
                    <span className={colors.text}>{EVENT_ICONS[ev.event_type]}</span>
                    <span className="text-sm text-slate-800 dark:text-slate-200">{ev.title}</span>
                    {ev.description && <span className="text-xs text-slate-500 truncate">— {ev.description}</span>}
                  </div>
                  {isSuperAdmin && (
                    <button onClick={() => deleteCalendarEvent(ev.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-400 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      <AnimatePresence>
        {showAddEvent && (
          <Modal title="Adaugă Eveniment Calendar" onClose={() => setShowAddEvent(false)}>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Titlu *</label>
                <input className={inputCls} placeholder="Ex: Ședință lunară" value={newEvent.title}
                  onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Data *</label>
                <input type="date" className={inputCls} value={newEvent.event_date}
                  onChange={e => setNewEvent(p => ({ ...p, event_date: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Tip</label>
                <select className={inputCls} value={newEvent.event_type}
                  onChange={e => setNewEvent(p => ({ ...p, event_type: e.target.value }))}>
                  <option value="announcement">📢 Anunț</option>
                  <option value="meeting">📹 Ședință</option>
                  <option value="reminder">🔔 Reminder</option>
                  <option value="other">⭐ Altele</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Descriere</label>
                <textarea className={inputCls + ' resize-none'} rows={3} placeholder="Detalii opționale..."
                  value={newEvent.description}
                  onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleAddEvent} disabled={saving || !newEvent.title.trim() || !newEvent.event_date} className={btnPrimary + ' flex-1 justify-center'}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Adaugă
                </button>
                <button onClick={() => setShowAddEvent(false)} className={btnSecondary}>Anulează</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Book / Allocate Saturday Modal from Calendar */}
      <AnimatePresence>
        {showCalendarBookModal && (
          <Modal title={`Rezervare / Alocare Sâmbătă — ${new Date(showCalendarBookModal.date + 'T12:00:00').toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`} onClose={() => setShowCalendarBookModal(null)}>
            <div className="space-y-4">
              {isSuperAdmin && (
                <div>
                  <label className={labelCls}>Beneficiar</label>
                  <select
                    value={selectedUser}
                    onChange={e => setSelectedUser(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Rezervă pentru mine (Super Admin)</option>
                    {allBalances.map(u => (
                      <option key={u.user_id} value={u.user_id}>
                        Alocă pentru {u.full_name} (@{u.username})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className={labelCls}>Opțiune de Compensare *</label>
                <select
                  value={compOption}
                  onChange={e => setCompOption(e.target.value as any)}
                  className={inputCls}
                >
                  <option value="decide_later">Decide mai târziu (implicit)</option>
                  <option value="free_day">Zi liberă disponibilă</option>
                  <option value="recovery">Recuperare pentru o zi lipsă</option>
                </select>
              </div>

              {compOption === 'recovery' && (
                <div className="animate-fade-in">
                  <label className={labelCls}>Data Zilei Lipsă de Recuperat *</label>
                  <input
                    type="date"
                    value={recoveryDate}
                    onChange={e => setRecoveryDate(e.target.value)}
                    className={inputCls}
                  />
                  <p className="text-[10px] text-rose-400 mt-1">Se va decrementa cu 1 numărul de zile lipsite din balanță.</p>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={handleCalendarBookSubmit}
                  disabled={bookingSaving || (compOption === 'recovery' && !recoveryDate)}
                  className={btnPrimary + ' flex-1 justify-center'}
                >
                  {bookingSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirmă Rezervarea
                </button>
                <button onClick={() => setShowCalendarBookModal(null)} className={btnSecondary}>Anulează</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

// Helper to generate all Saturdays of a year
const getSaturdaysOfYear = (year: number): string[] => {
  const dates: string[] = [];
  let d = new Date(year, 0, 1);
  while (d.getDay() !== 6) { // 6 is Saturday
    d.setDate(d.getDate() + 1);
  }
  while (d.getFullYear() === year) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dates.push(dateStr);
    d.setDate(d.getDate() + 7);
  }
  return dates;
};

// ─── Leave Tab ────────────────────────────────────────────────────────────────

const LeaveTab: React.FC = () => {
  const {
    myLeaves, allLeaves, leaveSummary,
    fetchMyLeaves, fetchAllLeaves, fetchLeaveSummary,
    createLeave, updateLeave, deleteLeave, approveLeave, rejectLeave,
    allBalances, fetchAllBalances,
    isLoading, error, clearError,
  } = useDutyDaysStore();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role_detail?.name === 'Super Admin';

  const [showForm, setShowForm]         = useState(false);
  const [editLeave, setEditLeave]       = useState<import('@/types').LeaveRequest | null>(null);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [savingLeave, setSavingLeave]   = useState(false);
  const [adminView, setAdminView]       = useState<'list' | 'summary'>('list');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterUserId, setFilterUserId] = useState('');

  const [form, setForm] = useState({
    leave_type: 'rest',
    start_date: '',
    end_date: '',
    notes: '',
    user_id: '',
  });

  useEffect(() => {
    fetchMyLeaves();
    if (isSuperAdmin) {
      fetchAllLeaves();
      fetchLeaveSummary();
      if (allBalances.length === 0) fetchAllBalances();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const durationDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    return Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
  };

  const resetForm = () => setForm({ leave_type: 'rest', start_date: '', end_date: '', notes: '', user_id: '' });

  const openCreate = () => { resetForm(); setEditLeave(null); setShowForm(true); };
  const openEdit = (lr: import('@/types').LeaveRequest) => {
    setForm({ leave_type: lr.leave_type, start_date: lr.start_date, end_date: lr.end_date, notes: lr.notes, user_id: lr.user });
    setEditLeave(lr);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.start_date || !form.end_date) return;
    setSavingLeave(true);
    let ok = false;
    if (editLeave) {
      ok = await updateLeave(editLeave.id, {
        leave_type: form.leave_type, start_date: form.start_date,
        end_date: form.end_date, notes: form.notes,
      });
    } else {
      ok = await createLeave({
        ...form,
        user_id: isSuperAdmin && form.user_id ? form.user_id : undefined,
      });
    }
    setSavingLeave(false);
    if (ok) {
      setShowForm(false); resetForm();
      if (isSuperAdmin) { fetchAllLeaves(); fetchLeaveSummary(); }
    }
  };

  const handleApprove = async (id: string) => { await approveLeave(id); };
  const handleReject  = async () => {
    if (!rejectModalId) return;
    await rejectLeave(rejectModalId, rejectReason);
    setRejectModalId(null); setRejectReason('');
  };
  const handleDelete = async (id: string) => {
    await deleteLeave(id);
    if (isSuperAdmin) { fetchAllLeaves(); fetchLeaveSummary(); }
  };

  // Absences are displayed in Zile de Serviciu tab — exclude them here
  const displayedLeaves = isSuperAdmin
    ? allLeaves.filter(l => {
        if (l.leave_type === 'absence') return false;
        if (filterStatus && l.status !== filterStatus) return false;
        if (filterUserId && l.user !== filterUserId) return false;
        return true;
      })
    : myLeaves.filter(l => l.leave_type !== 'absence');

  const pendingCount = allLeaves.filter(l => l.status === 'pending' && l.leave_type !== 'absence').length;

  return (
    <div className="space-y-5">
      <AnimatePresence>{error && <ErrorBanner msg={error} onClose={clearError} />}</AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Plane className="w-4 h-4 text-amber-400" /> Evidența Concediilor
            {isSuperAdmin && pendingCount > 0 && (
              <span className="ml-1 bg-amber-500/20 text-amber-300 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                {pendingCount} în așteptare
              </span>
            )}
          </h2>
          <p className="text-slate-500 dark:text-slate-500 text-xs mt-0.5">Gestionează cererile de concediu ale echipei.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isSuperAdmin && (
            <div className="flex bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 rounded-xl p-1 gap-1">
              <button onClick={() => setAdminView('list')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${adminView === 'list' ? 'bg-sidesi-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                Listă
              </button>
              <button onClick={() => setAdminView('summary')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${adminView === 'summary' ? 'bg-sidesi-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                Statistici
              </button>
            </div>
          )}
          <button onClick={openCreate} className={btnPrimary}>
            <Plus className="w-4 h-4" /> Adaugă Concediu
          </button>
        </div>
      </div>

      {/* Admin filters (list view) */}
      {isSuperAdmin && adminView === 'list' && (
        <div className="flex gap-2 flex-wrap items-center">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className={`${inputCls} max-w-[165px] py-1.5 text-xs`}>
            <option value="">Toate statusurile</option>
            <option value="draft">Ciornă</option>
            <option value="pending">În Așteptare</option>
            <option value="approved">Aprobat</option>
            <option value="rejected">Respins</option>
          </select>
          <select value={filterUserId} onChange={e => setFilterUserId(e.target.value)}
            className={`${inputCls} max-w-[200px] py-1.5 text-xs`}>
            <option value="">Toți utilizatorii</option>
            {allBalances.map(u => (
              <option key={u.user_id} value={u.user_id}>{u.full_name}</option>
            ))}
          </select>
          <button
            onClick={() => fetchAllLeaves({ status: filterStatus || undefined, userId: filterUserId || undefined })}
            className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 transition-all">
            <RefreshCw className="w-3 h-3" /> Reîncarcă
          </button>
        </div>
      )}

      {/* ── SUMMARY VIEW (admin) ── */}
      {isSuperAdmin && adminView === 'summary' && (
        <div className="space-y-3">
          {leaveSummary.filter(u => u.total_approved_days > 0 || u.leaves.length > 0).map(u => (
            <div key={u.user_id} className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{u.full_name}</span>
                <span className="text-xs bg-sidesi-500/10 text-sidesi-300 border border-sidesi-500/20 px-2.5 py-1 rounded-lg">
                  {u.total_approved_days} zile aprobate
                </span>
              </div>
              {/* Type breakdown badges */}
              <div className="flex flex-wrap gap-2 mb-3">
                {Object.entries(u.by_type).map(([lt, info]) => {
                  const cfg = LEAVE_CONFIG[lt] || LEAVE_CONFIG.other;
                  return (
                    <span key={lt} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border ${cfg.bg} ${cfg.text}`}>
                      {cfg.icon} {info.label}: <strong>{info.days}z</strong>
                    </span>
                  );
                })}
                {Object.keys(u.by_type).length === 0 && (
                  <span className="text-xs text-slate-400 dark:text-slate-600 italic">Niciun concediu aprobat</span>
                )}
              </div>
              {/* Recent leave entries */}
              <div className="space-y-1.5">
                {u.leaves.slice(0, 4).map(lr => {
                  const cfg = LEAVE_CONFIG[lr.leave_type] || LEAVE_CONFIG.other;
                  return (
                    <div key={lr.id} className="flex items-center gap-2 text-xs bg-slate-100 dark:bg-slate-800/40 rounded-lg px-3 py-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      <span className="text-slate-500 dark:text-slate-400">{lr.start_date} → {lr.end_date}</span>
                      <span className={`${cfg.text} font-medium`}>{cfg.label}</span>
                      <span className="text-slate-500">({lr.duration_days}z)</span>
                      <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_BADGE[lr.status]}`}>{lr.status_display}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {leaveSummary.filter(u => u.total_approved_days > 0 || u.leaves.length > 0).length === 0 && (
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 rounded-2xl p-12 text-center">
              <Plane className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Nu există concedii înregistrate.</p>
            </div>
          )}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {(!isSuperAdmin || adminView === 'list') && (
        <div className="space-y-3">
          {isLoading && (
            <div className="text-center py-12">
              <Loader2 className="w-6 h-6 text-sidesi-400 animate-spin inline" />
            </div>
          )}
          {!isLoading && displayedLeaves.length === 0 && (
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 rounded-2xl p-12 flex flex-col items-center text-center">
              <Plane className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm">Nu există cereri de concediu.</p>
              <button onClick={openCreate} className="mt-4 text-sidesi-400 hover:text-sidesi-300 text-xs flex items-center gap-1 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Adaugă prima cerere
              </button>
            </div>
          )}
          {displayedLeaves.map(lr => {
            const cfg = LEAVE_CONFIG[lr.leave_type] || LEAVE_CONFIG.other;
            const canEdit = isSuperAdmin || lr.status === 'draft' || lr.status === 'pending';
            const canDelete = isSuperAdmin || lr.status !== 'approved';
            return (
              <motion.div
                key={lr.id} layout
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className={`bg-white dark:bg-slate-900/60 border rounded-2xl p-4 ${
                  lr.status === 'pending'  ? 'border-amber-500/30' :
                  lr.status === 'rejected' ? 'border-rose-500/20'  :
                  lr.status === 'approved' ? 'border-emerald-500/15' :
                  'border-slate-200 dark:border-slate-700/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Type icon */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${cfg.bg} ${cfg.text}`}>
                    {cfg.icon}
                  </div>
                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{cfg.label}</span>
                      {isSuperAdmin && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">— {lr.user_detail.full_name}</span>
                      )}
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[lr.status]}`}>
                        {lr.status_display}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>📅 {lr.start_date} → {lr.end_date}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{lr.duration_days} zile</span>
                    </div>
                    {lr.notes && (
                      <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{lr.notes}</p>
                    )}
                    {lr.status === 'rejected' && lr.rejection_reason && (
                      <p className="mt-1 text-xs text-rose-400/90">
                        <span className="font-semibold">Respins:</span> {lr.rejection_reason}
                      </p>
                    )}
                    {lr.approved_by_detail && lr.status === 'approved' && (
                      <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-600">
                        Aprobat de {lr.approved_by_detail.full_name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action bar */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/60 flex-wrap">
                  {/* Admin: approve pending */}
                  {isSuperAdmin && lr.status === 'pending' && (
                    <>
                      <button onClick={() => handleApprove(lr.id)}
                        className="flex items-center gap-1 text-xs bg-emerald-600/80 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-all">
                        <CheckCircle2 className="w-3 h-3" /> Aprobă
                      </button>
                      <button onClick={() => { setRejectModalId(lr.id); setRejectReason(''); }}
                        className="flex items-center gap-1 text-xs bg-rose-600/80 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg transition-all">
                        <X className="w-3 h-3" /> Respinge
                      </button>
                    </>
                  )}
                  {/* Admin: re-approve rejected */}
                  {isSuperAdmin && lr.status === 'rejected' && (
                    <button onClick={() => handleApprove(lr.id)}
                      className="flex items-center gap-1 text-xs bg-emerald-600/80 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-all">
                      <CheckCircle2 className="w-3 h-3" /> Aprobă
                    </button>
                  )}
                  {/* User: submit draft for approval */}
                  {!isSuperAdmin && lr.status === 'draft' && (
                    <button onClick={() => updateLeave(lr.id, {})}
                      className="flex items-center gap-1 text-xs bg-amber-600/80 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg transition-all">
                      <Clock className="w-3 h-3" /> Trimite spre aprobare
                    </button>
                  )}
                  <div className="ml-auto flex gap-2">
                    {canEdit && (
                      <button onClick={() => openEdit(lr)}
                        className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-all">
                        <Edit3 className="w-3 h-3" /> Editează
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => handleDelete(lr.id)}
                        className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1.5 rounded-lg border border-rose-500/20 transition-all">
                        <Trash2 className="w-3 h-3" /> Șterge
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Leave Modal ── */}
      <AnimatePresence>
        {showForm && (
          <Modal title={editLeave ? 'Editează Concediu' : 'Adaugă Concediu'}
            onClose={() => { setShowForm(false); resetForm(); }}>
            <div className="space-y-4">
              {/* Target user (admin only, create only) */}
              {isSuperAdmin && !editLeave && (
                <div>
                  <label className={labelCls}>Angajat</label>
                  <select className={inputCls} value={form.user_id}
                    onChange={e => setForm(p => ({ ...p, user_id: e.target.value }))}>
                    <option value="">Eu (cont propriu)</option>
                    {allBalances.map(u => (
                      <option key={u.user_id} value={u.user_id}>{u.full_name} (@{u.username})</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Leave type */}
              <div>
                <label className={labelCls}>Tip Concediu *</label>
                <select className={inputCls} value={form.leave_type}
                  onChange={e => setForm(p => ({ ...p, leave_type: e.target.value }))}>
                  <option value="rest">🏖️ Concediu de Odihnă</option>
                  <option value="study">📚 Concediu de Studii</option>
                  <option value="medical">🏥 Concediu Medical</option>
                  <option value="unpaid">✈️ Concediu Fără Plată</option>
                  <option value="other">📝 Alt Concediu</option>
                  {isSuperAdmin && <option value="absence">⚠️ Absență / Lipsă</option>}
                </select>
              </div>
              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Data Start *</label>
                  <input type="date" className={inputCls} value={form.start_date}
                    onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Data Final *</label>
                  <input type="date" className={inputCls} value={form.end_date}
                    onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
                </div>
              </div>
              {/* Duration preview */}
              {form.start_date && form.end_date && (
                <div className="bg-sidesi-500/10 border border-sidesi-500/20 rounded-xl px-3 py-2 text-xs text-sidesi-600 dark:text-sidesi-300 flex items-center gap-2">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Durată: <strong>{durationDays(form.start_date, form.end_date)} zile calendaristice</strong>
                </div>
              )}
              {/* Notes */}
              <div>
                <label className={labelCls}>Note / Observații</label>
                <textarea className={`${inputCls} resize-none`} rows={3}
                  placeholder="Detalii opționale (ex: nr. certificat medical)..."
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              {/* Save / Cancel */}
              <div className="flex gap-2 pt-1">
                <button onClick={handleSave}
                  disabled={savingLeave || !form.start_date || !form.end_date}
                  className={`${btnPrimary} flex-1 justify-center`}>
                  {savingLeave
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <CheckCircle2 className="w-4 h-4" />}
                  {editLeave ? 'Salvează' : isSuperAdmin ? 'Adaugă (Aprobat)' : 'Trimite Cerere'}
                </button>
                <button onClick={() => { setShowForm(false); resetForm(); }} className={btnSecondary}>
                  Anulează
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── Reject Reason Modal ── */}
      <AnimatePresence>
        {rejectModalId && (
          <Modal title="Respinge Cerere" onClose={() => { setRejectModalId(null); setRejectReason(''); }}>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Motiv respingere (opțional)</label>
                <textarea className={`${inputCls} resize-none`} rows={3}
                  placeholder="Explică motivul respingerii..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleReject}
                  className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-medium text-sm px-4 py-2 rounded-xl transition-all flex-1 justify-center">
                  <X className="w-4 h-4" /> Confirmă Respingerea
                </button>
                <button onClick={() => { setRejectModalId(null); setRejectReason(''); }}
                  className={btnSecondary}>
                  Anulează
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Saturdays Tab ────────────────────────────────────────────────────────────

const SaturdaysTab: React.FC<{
  autoHighlightDate: string | null;
  onClearHighlight: () => void;
}> = ({ autoHighlightDate, onClearHighlight }) => {
  const {
    saturdays, saturdaysYear, setSaturdaysYear,
    myData, fetchAllBalances,
    allBalances, bookSaturdayDate, cancelSaturday,
    createSaturday, takeFreeDays,
    myLeaves, fetchMyLeaves, allLeaves, fetchAllLeaves,
    isLoading, error, clearError
  } = useDutyDaysStore();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role_detail?.name === 'Super Admin';

  const [showAddSaturday, setShowAddSaturday] = useState(false);
  const [showTakeFreeDay, setShowTakeFreeDay] = useState(false);
  
  // Book Modal
  const [showBookModal, setShowBookModal] = useState<{ date: string } | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<any | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [compOption, setCompOption] = useState<'recovery' | 'decide_later' | 'free_day'>('decide_later');
  const [recoveryDate, setRecoveryDate] = useState<string>('');

  const [highlightedSatId, setHighlightedSatId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'free' | 'booked'>('all');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Fetch leaves so we can display absences in this tab
    fetchMyLeaves();
    if (isSuperAdmin) fetchAllLeaves();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoHighlightDate) {
      setFilterMode('all');
      const timer = setTimeout(() => {
        const el = document.getElementById(`sat-card-${autoHighlightDate}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightedSatId(autoHighlightDate);
          setTimeout(() => {
            setHighlightedSatId(null);
            onClearHighlight();
          }, 2000);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [autoHighlightDate, onClearHighlight]);

  const [newSat, setNewSat] = useState({ date: '', label: '', notes: '' });
  const [freeDayDate, setFreeDayDate] = useState('');

  const balance = myData?.balance;
  const myLogs = myData?.logs || [];
  const upcomingSats = myData?.upcoming_saturdays || [];

  const yearOptions = [2026, 2027, 2028, 2029, 2030];

  // Dynamically compute all Saturdays for this year
  const allSatDates = getSaturdaysOfYear(saturdaysYear);
  const mergedSaturdays = allSatDates.map(dateStr => {
    const dbSat = saturdays.find(s => s.date === dateStr);
    return {
      id: dbSat?.id || `temp-${dateStr}`,
      date: dateStr,
      label: dbSat?.label || '',
      notes: dbSat?.notes || '',
      is_booked: !!dbSat?.is_booked,
      booking: dbSat?.booking || null,
      created_by: dbSat?.created_by || null,
      created_by_detail: dbSat?.created_by_detail || null,
    };
  });

  const filteredSaturdays = mergedSaturdays.filter(sat => {
    if (filterMode === 'free') return !sat.is_booked;
    if (filterMode === 'booked') return sat.is_booked;
    return true;
  });



  const handleAddSaturday = async () => {
    if (!newSat.date) return;
    setSaving(true);
    const ok = await createSaturday(newSat);
    setSaving(false);
    if (ok) { setShowAddSaturday(false); setNewSat({ date: '', label: '', notes: '' }); }
  };

  const handleTakeFreeDay = async () => {
    if (!freeDayDate) return;
    const d = new Date(freeDayDate + 'T12:00:00');
    const dow = d.getDay(); // 0=Dum, 6=Sâm
    if (dow === 0 || dow === 6) return; // blocked — weekend
    setSaving(true);
    const ok = await takeFreeDays(freeDayDate);
    setSaving(false);
    if (ok) { setShowTakeFreeDay(false); setFreeDayDate(''); }
  };

  const handleBookSubmit = async () => {
    if (!showBookModal) return;
    setSaving(true);
    const ok = await bookSaturdayDate({
      date: showBookModal.date,
      userId: isSuperAdmin && selectedUser ? selectedUser : undefined,
      compOption,
      recoveryDate: compOption === 'recovery' ? recoveryDate : undefined,
    });
    setSaving(false);
    if (ok) {
      setShowBookModal(null);
      setSelectedUser('');
      setCompOption('decide_later');
      setRecoveryDate('');
      if (isSuperAdmin) fetchAllBalances();
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <AnimatePresence>{error && <ErrorBanner msg={error} onClose={clearError} />}</AnimatePresence>

      {/* ── My Balance Card ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Days to recover */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-rose-500/10 to-rose-900/5 border border-rose-500/20 rounded-2xl p-5 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full -translate-y-8 translate-x-8" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-rose-400/80 uppercase tracking-wider mb-1">Zile Lipsite de Recuperat</p>
              <div className="text-4xl font-black text-rose-400 leading-none">
                {balance?.days_to_recover ?? '–'}
              </div>
              <p className="text-slate-500 text-xs mt-2">Sâmbete pe care trebuie să le lucrezi</p>
            </div>
            <div className="w-12 h-12 bg-rose-500/15 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
            </div>
          </div>
        </motion.div>

        {/* Free days available */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}
          className="bg-gradient-to-br from-emerald-500/10 to-emerald-900/5 border border-emerald-500/20 rounded-2xl p-5 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -translate-y-8 translate-x-8" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-wider mb-1">Zile Libere Disponibile</p>
              <div className="text-4xl font-black text-emerald-400 leading-none">
                {balance?.free_days_available ?? '–'}
              </div>
              <p className="text-slate-500 text-xs mt-2">Sâmbete lucrate, neluate ca liber</p>
            </div>
            <div className="w-12 h-12 bg-emerald-500/15 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          {(balance?.free_days_available ?? 0) > 0 && (
            <button onClick={() => setShowTakeFreeDay(true)}
              className="mt-3 w-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-semibold py-2 rounded-xl transition-all flex items-center justify-center gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5" /> Marchează Zi Liberă Luată
            </button>
          )}
        </motion.div>
      </div>

      {/* Upcoming booked Saturdays */}
      {upcomingSats.length > 0 && (
        <div className="bg-white dark:bg-slate-900/60 border border-sidesi-500/20 rounded-2xl p-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-sidesi-400" /> Sâmbetele Mele Viitoare
          </h3>
          <div className="flex flex-wrap gap-2">
            {upcomingSats.map(s => (
              <div key={s.id} className="bg-sidesi-500/10 border border-sidesi-500/30 rounded-xl px-3 py-2 flex items-center gap-2">
                <CalendarCheck className="w-3.5 h-3.5 text-sidesi-400" />
                <div>
                  <div className="text-sm font-bold text-sidesi-500 dark:text-sidesi-300">{s.date_formatted}</div>
                  {s.label && <div className="text-xs text-slate-500">{s.label}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Saturdays List ── */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <SunDim className="w-4 h-4 text-sidesi-400" /> Sâmbete de Serviciu
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={saturdaysYear}
              onChange={e => setSaturdaysYear(Number(e.target.value))}
              className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:border-sidesi-500/60"
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Visual Saturdays Grid Overview */}
        {!isLoading && filteredSaturdays.length > 0 && (
          <div className="bg-slate-50 dark:bg-slate-800/20 border border-slate-200 dark:border-slate-800/60 rounded-xl p-4 mb-5">
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-sidesi-400"></span>
              Sâmbete de Serviciu ({saturdaysYear})
            </h4>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-9 lg:grid-cols-12 gap-1.5">
              {filteredSaturdays.map(sat => {
                const isBooked = sat.is_booked;
                const isPast = new Date(sat.date) < new Date(new Date().toDateString());
                const d = new Date(sat.date + 'T12:00:00');
                const dateLabel = d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
                const yearLabel = d.getFullYear();

                let colorCls = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/30";
                let statusText = "Liberă";
                if (isBooked) {
                  colorCls = "bg-violet-500/10 border-violet-500/20 text-violet-400 hover:bg-violet-500/20 hover:border-violet-500/30";
                  statusText = `Ocupată: ${sat.booking?.user_detail?.full_name || sat.booking?.user_detail?.username}`;
                }
                if (isPast) {
                  colorCls = "bg-slate-100 dark:bg-slate-800/25 border-slate-200 dark:border-slate-700/30 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700/40";
                  statusText = isBooked 
                    ? `Lucrată de: ${sat.booking?.user_detail?.full_name || sat.booking?.user_detail?.username}`
                    : "Trecută (nelucrată)";
                }

                return (
                  <button
                    key={sat.date}
                    onClick={() => {
                      if (sat.is_booked) {
                        setShowDetailsModal(sat);
                      } else {
                        const isPast = new Date(sat.date) < new Date(new Date().toDateString());
                        if (isPast && !isSuperAdmin) return;
                        setSelectedUser('');
                        setCompOption('decide_later');
                        setRecoveryDate('');
                        setShowBookModal({ date: sat.date });
                      }
                    }}
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1 transition-all select-none ${colorCls} ${highlightedSatId === sat.date ? 'ring-2 ring-sidesi-400 border-sidesi-400 bg-sidesi-500/20' : ''}`}
                    title={`${dateLabel} ${yearLabel} · ${statusText}`}
                  >
                    <span className={`w-1 h-1 rounded-full ${isPast ? 'bg-slate-500' : isBooked ? 'bg-violet-400' : 'bg-emerald-400'}`} />
                    {dateLabel}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 pt-2 border-t border-slate-200/50 dark:border-slate-800/50 text-[10px] text-slate-500">
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Liberă</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400" /> Rezervată</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500" /> Trecută</div>
            </div>
          </div>
        )}

        {/* Filter modes */}
        <div className="flex items-center justify-between mb-4 mt-2">
          <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800/40 p-1 rounded-xl border border-slate-200 dark:border-slate-800/60">
            {(['all', 'free', 'booked'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filterMode === mode
                    ? 'bg-white dark:bg-slate-750 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700/60'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {mode === 'all' ? 'Toate' : mode === 'free' ? 'Libere' : 'Rezervate'}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-500">
            Afișate: <strong>{filteredSaturdays.length}</strong> din <strong>{mergedSaturdays.length}</strong>
          </span>
        </div>

        {isLoading && <Spinner />}

        {!isLoading && filteredSaturdays.length === 0 && (
          <div className="text-center py-12">
            <SunDim className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Nu există sâmbete matching pentru {saturdaysYear}</p>
          </div>
        )}
      </div>

      {/* ── Absențe ── */}
      {(() => {
        const absences = isSuperAdmin
          ? allLeaves.filter(l => l.leave_type === 'absence')
          : myLeaves.filter(l => l.leave_type === 'absence');
        if (absences.length === 0) return null;
        return (
          <div className="bg-white dark:bg-slate-900/60 border border-rose-500/20 rounded-2xl p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" /> Absențe Înregistrate
              <span className="ml-auto bg-rose-500/20 text-rose-300 text-xs font-bold px-2 py-0.5 rounded-full">
                {absences.length}
              </span>
            </h3>
            <div className="space-y-2">
              {absences.map(lr => (
                <div key={lr.id} className="bg-rose-500/5 border border-rose-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isSuperAdmin && (
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{lr.user_detail.full_name}</span>
                      )}
                      <span className="text-xs text-slate-500 dark:text-slate-400">📅 {lr.start_date}</span>
                      {lr.notes && <span className="text-xs text-slate-500 truncate">— {lr.notes}</span>}
                    </div>
                    {lr.approved_by_detail && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-0.5">Raportat de {lr.approved_by_detail.full_name}</p>
                    )}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-rose-500/15 text-rose-400 whitespace-nowrap flex-shrink-0">
                    +1 zi de recuperat
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── My Activity Log ── */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 rounded-2xl p-5">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-sidesi-400" /> Istoricul Meu de Activitate
        </h3>
        {myLogs.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Nu există activitate înregistrată încă</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {myLogs.map(log => (
              <div key={log.id} className="flex items-start gap-3 py-2 border-b border-slate-200/50 dark:border-slate-800/60 last:border-0">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${ACTION_COLORS[log.action]?.replace('text-', 'bg-') || 'bg-slate-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{log.details}</p>
                  {log.saturday_detail && (
                    <span className="text-[10px] text-sidesi-400 font-medium">{log.saturday_detail.date_formatted}</span>
                  )}
                  {log.free_day_date && (
                    <span className="text-[10px] text-cyan-400 font-medium"> · Zi liberă: {log.free_day_date}</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-600 whitespace-nowrap flex-shrink-0">
                  {new Date(log.created_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showAddSaturday && (
          <Modal title="Adaugă Sâmbătă de Serviciu" onClose={() => setShowAddSaturday(false)}>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Data Sâmbetei *</label>
                <input type="date" className={inputCls} value={newSat.date}
                  onChange={e => setNewSat(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Etichetă</label>
                <input className={inputCls} placeholder="Ex: Recuperare T1 2026"
                  value={newSat.label} onChange={e => setNewSat(p => ({ ...p, label: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Notițe</label>
                <textarea className={inputCls + ' resize-none'} rows={2}
                  value={newSat.notes} onChange={e => setNewSat(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleAddSaturday} disabled={saving || !newSat.date} className={btnPrimary + ' flex-1 justify-center'}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Adaugă
                </button>
                <button onClick={() => setShowAddSaturday(false)} className={btnSecondary}>Anulează</button>
              </div>
            </div>
          </Modal>
        )}

        {showTakeFreeDay && (
          <Modal title="Marchează Zi Liberă ca Luată" onClose={() => { setShowTakeFreeDay(false); setFreeDayDate(''); }}>
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-sm text-emerald-400">
                Zile libere disponibile: <strong>{balance?.free_days_available}</strong>
              </div>
              <div>
                <label className={labelCls}>Data zilei libere luate *</label>
                <input
                  type="date"
                  className={inputCls}
                  value={freeDayDate}
                  onChange={e => setFreeDayDate(e.target.value)}
                />
                {/* Weekend warning */}
                {freeDayDate && (() => {
                  const dow = new Date(freeDayDate + 'T12:00:00').getDay();
                  if (dow === 0 || dow === 6) {
                    return (
                      <div className="mt-2 flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2 text-xs text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Nu poți marca o zi liberă în weekend (sâmbătă sau duminică). Alege o zi lucrătoare.</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleTakeFreeDay}
                  disabled={saving || !freeDayDate || [0, 6].includes(new Date((freeDayDate || '2000-01-01') + 'T12:00:00').getDay())}
                  className={btnPrimary + ' flex-1 justify-center'}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
                  Confirmă
                </button>
                <button onClick={() => { setShowTakeFreeDay(false); setFreeDayDate(''); }} className={btnSecondary}>Anulează</button>
              </div>
            </div>
          </Modal>
        )}

        {/* Book / Allocate Saturday Modal */}
        {showBookModal && (
          <Modal title={`Rezervare / Alocare Sâmbătă — ${new Date(showBookModal.date + 'T12:00:00').toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`} onClose={() => setShowBookModal(null)}>
            <div className="space-y-4">
              {isSuperAdmin && (
                <div>
                  <label className={labelCls}>Beneficiar</label>
                  <select
                    value={selectedUser}
                    onChange={e => setSelectedUser(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Rezervă pentru mine (Super Admin)</option>
                    {allBalances.map(u => (
                      <option key={u.user_id} value={u.user_id}>
                        Alocă pentru {u.full_name} (@{u.username})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className={labelCls}>Opțiune de Compensare *</label>
                <select
                  value={compOption}
                  onChange={e => setCompOption(e.target.value as any)}
                  className={inputCls}
                >
                  <option value="decide_later">Decide mai târziu (implicit)</option>
                  <option value="free_day">Zi liberă disponibilă</option>
                  <option value="recovery">Recuperare pentru o zi lipsă</option>
                </select>
              </div>

              {compOption === 'recovery' && (
                <div className="animate-fade-in">
                  <label className={labelCls}>Data Zilei Lipsă de Recuperat *</label>
                  <input
                    type="date"
                    value={recoveryDate}
                    onChange={e => setRecoveryDate(e.target.value)}
                    className={inputCls}
                  />
                  <p className="text-[10px] text-rose-400 mt-1">Se va decrementa cu 1 numărul de zile lipsite din balanță.</p>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={handleBookSubmit}
                  disabled={saving || (compOption === 'recovery' && !recoveryDate)}
                  className={btnPrimary + ' flex-1 justify-center'}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirmă Rezervarea
                </button>
                <button onClick={() => setShowBookModal(null)} className={btnSecondary}>Anulează</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Saturday Booking Details Modal */}
      <AnimatePresence>
        {showDetailsModal && showDetailsModal.booking && (
          <Modal title={`Detalii Rezervare Sâmbătă — ${new Date(showDetailsModal.date + 'T12:00:00').toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`} onClose={() => setShowDetailsModal(null)}>
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 space-y-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wide">Beneficiar</label>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {showDetailsModal.booking.user_detail?.full_name || showDetailsModal.booking.user_detail?.username}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500">@{showDetailsModal.booking.user_detail?.username}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wide">Opțiune de Compensare</label>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    {showDetailsModal.booking.comp_option_display || showDetailsModal.booking.comp_option}
                    {showDetailsModal.booking.comp_option === 'recovery' && showDetailsModal.booking.recovery_date && ` (Data: ${showDetailsModal.booking.recovery_date})`}
                  </p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wide">Dată Rezervare</label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(showDetailsModal.booking.booked_at).toLocaleString('ro-RO')}
                  </p>
                </div>
                {showDetailsModal.booking.free_day_credited && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg p-2 text-xs flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Zile libere adăugate în balanță</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                {isSuperAdmin && (
                  <button
                    onClick={() => {
                      setSelectedUser(showDetailsModal.booking?.user || '');
                      setCompOption(showDetailsModal.booking?.comp_option || 'decide_later');
                      setRecoveryDate(showDetailsModal.booking?.recovery_date || '');
                      setShowBookModal({ date: showDetailsModal.date });
                      setShowDetailsModal(null);
                    }}
                    className={btnSecondary + ' flex-1 justify-center'}
                  >
                    <Edit3 className="w-4 h-4" /> Editează
                  </button>
                )}
                {((showDetailsModal.booking.user_detail?.id === user?.id) || isSuperAdmin) && (
                  <button
                    onClick={async () => {
                      const confirmCancel = window.confirm("Sigur doriți să anulați această rezervare?");
                      if (confirmCancel) {
                        const ok = await cancelSaturday(showDetailsModal.id, showDetailsModal.booking?.user);
                        if (ok) {
                          setShowDetailsModal(null);
                        }
                      }
                    }}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-medium text-sm px-4 py-2 rounded-xl transition-all flex-1 justify-center flex items-center gap-1.5"
                  >
                    <X className="w-4 h-4" /> Anulează Rezervarea
                  </button>
                )}
                <button onClick={() => setShowDetailsModal(null)} className={btnSecondary}>Închide</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── User Detailed Report Modal ───────────────────────────────────────────────

const UserReportModal: React.FC<{
  targetUser: UserBalanceKPI | null;
  onClose: () => void;
}> = ({ targetUser, onClose }) => {
  const {
    currentReport, isLoadingReport, fetchUserReport, exportUserReportExcel,
    clearCurrentReport
  } = useDutyDaysStore();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | undefined>(currentYear);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'leave' | 'free_day' | 'saturday'>('all');
  const [activeSubTab, setActiveSubTab] = useState<'timeline' | 'logs'>('timeline');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (targetUser) {
      fetchUserReport(targetUser.user_id, selectedYear);
    }
    return () => clearCurrentReport();
  }, [targetUser, selectedYear]);

  if (!targetUser) return null;

  const handleExport = async () => {
    setExporting(true);
    await exportUserReportExcel(targetUser.user_id, selectedYear);
    setExporting(false);
  };

  const timelineItems = (currentReport?.timeline || []).filter(item => {
    if (timelineFilter === 'all') return true;
    return item.event_type === timelineFilter;
  });

  const getTimelineBadge = (item: ReportTimelineItem) => {
    if (item.event_type === 'leave') {
      const cfg = LEAVE_CONFIG[item.category] || LEAVE_CONFIG.other;
      return {
        icon: cfg.icon,
        badgeCls: cfg.badge,
        label: item.title,
      };
    }
    if (item.event_type === 'free_day') {
      return {
        icon: <SunDim className="w-3.5 h-3.5" />,
        badgeCls: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
        label: item.title,
      };
    }
    return {
      icon: <CalendarCheck className="w-3.5 h-3.5" />,
      badgeCls: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
      label: item.title,
    };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
      case 'pending':
      case 'upcoming':
        return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
      case 'rejected':
        return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
      default:
        return 'bg-slate-500/15 text-slate-400 border border-slate-500/30';
    }
  };

  return (
    <Modal
      title={`Fișă & Raport Angajat — ${targetUser.full_name}`}
      onClose={onClose}
      maxWidth="max-w-5xl"
      headerExtra={
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-sidesi-500/20 text-sidesi-400 font-medium">
          @{targetUser.username}
        </span>
      }
    >
      <div className="space-y-6">
        {/* Top Control Bar: Year Filter & Excel Export */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Filtru An:</span>
            <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setSelectedYear(undefined)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  selectedYear === undefined
                    ? 'bg-white dark:bg-sidesi-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Toți anii
              </button>
              {[currentYear, currentYear - 1, currentYear - 2].map(yr => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    selectedYear === yr
                      ? 'bg-white dark:bg-sidesi-600 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-3.5 py-1.5 rounded-lg transition-all shadow-sm disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Descarcă Fișă Excel (.xlsx)
          </button>
        </div>

        {isLoadingReport ? (
          <Spinner />
        ) : currentReport ? (
          <>
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-amber-500 dark:text-amber-400 text-xs font-medium mb-1">
                  <Plane className="w-3.5 h-3.5" /> Odihnă
                </div>
                <div className="text-xl font-bold text-amber-600 dark:text-amber-300">
                  {currentReport.kpi.leaves_by_type.rest || 0}
                  <span className="text-xs font-normal text-amber-500/80 ml-1">zile</span>
                </div>
              </div>

              <div className="bg-teal-500/10 border border-teal-500/25 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-teal-500 dark:text-teal-400 text-xs font-medium mb-1">
                  <Stethoscope className="w-3.5 h-3.5" /> Medical
                </div>
                <div className="text-xl font-bold text-teal-600 dark:text-teal-300">
                  {currentReport.kpi.leaves_by_type.medical || 0}
                  <span className="text-xs font-normal text-teal-500/80 ml-1">zile</span>
                </div>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/25 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-purple-500 dark:text-purple-400 text-xs font-medium mb-1">
                  <BookOpen className="w-3.5 h-3.5" /> Alte Concedii
                </div>
                <div className="text-xl font-bold text-purple-600 dark:text-purple-300">
                  {(currentReport.kpi.leaves_by_type.study || 0) +
                   (currentReport.kpi.leaves_by_type.unpaid || 0) +
                   (currentReport.kpi.leaves_by_type.absence || 0) +
                   (currentReport.kpi.leaves_by_type.other || 0)}
                  <span className="text-xs font-normal text-purple-500/80 ml-1">zile</span>
                </div>
              </div>

              <div className="bg-cyan-500/10 border border-cyan-500/25 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-cyan-500 dark:text-cyan-400 text-xs font-medium mb-1">
                  <SunDim className="w-3.5 h-3.5" /> Libere Luate
                </div>
                <div className="text-xl font-bold text-cyan-600 dark:text-cyan-300">
                  {currentReport.kpi.free_days_taken || 0}
                  <span className="text-xs font-normal text-cyan-500/80 ml-1">zile</span>
                </div>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-emerald-500 dark:text-emerald-400 text-xs font-medium mb-1">
                  <CalendarCheck className="w-3.5 h-3.5" /> Sâmbete Lucrate
                </div>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-300">
                  {currentReport.kpi.saturdays_served || 0}
                  <span className="text-xs font-normal text-emerald-500/80 ml-1">sâmb</span>
                </div>
              </div>

              <div className="bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400 text-xs font-medium mb-1">
                  <BarChart3 className="w-3.5 h-3.5 text-sidesi-400" /> Balanță
                </div>
                <div className="text-sm font-bold flex items-center justify-center gap-1.5 mt-1">
                  <span className="text-emerald-500" title="Zile libere disponibile">+{currentReport.kpi.current_free_days_balance}</span>
                  <span className="text-slate-400">/</span>
                  <span className="text-rose-500" title="Zile de recuperat">-{currentReport.kpi.current_days_to_recover}</span>
                </div>
              </div>
            </div>

            {/* Sub-tab Navigation */}
            <div className="border-b border-slate-200 dark:border-slate-800 flex items-center justify-between pt-2">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setActiveSubTab('timeline')}
                  className={`pb-2 text-sm font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
                    activeSubTab === 'timeline'
                      ? 'border-sidesi-500 text-sidesi-600 dark:text-sidesi-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <CalendarDays className="w-4 h-4" />
                  Cronologie Detaliată Zile & Concedii ({currentReport.timeline.length})
                </button>
                <button
                  onClick={() => setActiveSubTab('logs')}
                  className={`pb-2 text-sm font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
                    activeSubTab === 'logs'
                      ? 'border-sidesi-500 text-sidesi-600 dark:text-sidesi-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <History className="w-4 h-4" />
                  Jurnal Audit Angajat ({currentReport.activity_logs.length})
                </button>
              </div>

              {activeSubTab === 'timeline' && (
                <div className="flex items-center gap-1 pb-2">
                  <button
                    onClick={() => setTimelineFilter('all')}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                      timelineFilter === 'all'
                        ? 'bg-slate-800 text-white dark:bg-slate-700'
                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    Toate
                  </button>
                  <button
                    onClick={() => setTimelineFilter('leave')}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                      timelineFilter === 'leave'
                        ? 'bg-amber-500 text-white'
                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    Concedii
                  </button>
                  <button
                    onClick={() => setTimelineFilter('free_day')}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                      timelineFilter === 'free_day'
                        ? 'bg-cyan-500 text-white'
                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    Libere Luate
                  </button>
                  <button
                    onClick={() => setTimelineFilter('saturday')}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                      timelineFilter === 'saturday'
                        ? 'bg-emerald-500 text-white'
                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    Sâmbete
                  </button>
                </div>
              )}
            </div>

            {/* Sub-tab 1: Timeline Table */}
            {activeSubTab === 'timeline' && (
              <div className="space-y-3">
                {timelineItems.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-sm">
                    Nicio înregistrare găsită pentru filtrul selectat.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/60 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                          <th className="text-left px-4 py-2.5">Dată / Perioadă</th>
                          <th className="text-left px-4 py-2.5">Tip Eveniment</th>
                          <th className="text-center px-4 py-2.5">Durată</th>
                          <th className="text-center px-4 py-2.5">Status</th>
                          <th className="text-left px-4 py-2.5">Note & Detalii</th>
                          <th className="text-left px-4 py-2.5">Autor / Operator</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                        {timelineItems.map(item => {
                          const badge = getTimelineBadge(item);
                          return (
                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                                {item.date_display}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badge.badgeCls}`}>
                                  {badge.icon}
                                  {badge.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {item.duration_days} {item.duration_days === 1 ? 'zi' : 'zile'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusBadge(item.status)}`}>
                                  {item.status_display}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs max-w-xs truncate">
                                {item.details || item.notes || '—'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                                {item.approved_by || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 2: Activity Logs for this User */}
            {activeSubTab === 'logs' && (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {currentReport.activity_logs.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-sm">
                    Nu există acțiuni înregistrate în jurnal pentru acest utilizator.
                  </div>
                ) : (
                  currentReport.activity_logs.map(log => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-800/60 text-xs"
                    >
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${ACTION_COLORS[log.action]?.replace('text-', 'bg-') || 'bg-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-semibold ${ACTION_COLORS[log.action] || 'text-slate-700 dark:text-slate-300'}`}>
                            {log.action_display}
                          </span>
                          <span className="text-slate-400 text-[11px] whitespace-nowrap">
                            {new Date(log.created_at).toLocaleDateString('ro-RO', {
                              day: 'numeric', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {log.details && <p className="text-slate-600 dark:text-slate-300 mt-1">{log.details}</p>}
                        {log.performed_by_detail && (
                          <p className="text-slate-400 text-[11px] mt-0.5">
                            Efectuat de: {log.performed_by_detail.full_name || log.performed_by_detail.username}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        ) : (
          <div className="py-12 text-center text-slate-500 text-sm">
            Nu s-au putut încărca datele raportului.
          </div>
        )}
      </div>
    </Modal>
  );
};

// ─── Comprehensive Logging & Audit Panel ──────────────────────────────────────

const AuditLogsPanel: React.FC<{
  users: UserBalanceKPI[];
}> = ({ users }) => {
  const { adminLogs, adminLogsCount, fetchFilteredAdminLogs, exportAdminLogsExcel } = useDutyDaysStore();

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  const applyFilters = () => {
    fetchFilteredAdminLogs({
      userId: selectedUserId || undefined,
      action: selectedAction || undefined,
      search: searchQuery || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  };

  const handleReset = () => {
    setSelectedUserId('');
    setSelectedAction('');
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    fetchFilteredAdminLogs({});
  };

  const handleExport = async () => {
    setExporting(true);
    await exportAdminLogsExcel({
      userId: selectedUserId || undefined,
      action: selectedAction || undefined,
      search: searchQuery || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
    setExporting(false);
  };

  return (
    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <History className="w-4 h-4 text-sidesi-400" /> Jurnal Audit & Activitate Sistem
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            {adminLogsCount || adminLogs.length} înregistrări
          </span>
        </h4>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Export Jurnal Audit (Excel)
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Angajat
          </label>
          <select
            className={inputCls + " text-xs py-2"}
            value={selectedUserId}
            onChange={e => setSelectedUserId(e.target.value)}
          >
            <option value="">Toți angajații</option>
            {users.map(u => (
              <option key={u.user_id} value={u.user_id}>{u.full_name} (@{u.username})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Tip Acțiune
          </label>
          <select
            className={inputCls + " text-xs py-2"}
            value={selectedAction}
            onChange={e => setSelectedAction(e.target.value)}
          >
            <option value="">Toate acțiunile</option>
            <option value="saturday_booked">Sâmbătă Rezervată</option>
            <option value="saturday_cancelled">Sâmbătă Anulată</option>
            <option value="free_day_taken">Zi Liberă Luată</option>
            <option value="balance_adjusted">Balanță Ajustată</option>
            <option value="leave_created">Concediu Creat</option>
            <option value="leave_approved">Concediu Aprobat</option>
            <option value="leave_rejected">Concediu Respins</option>
            <option value="leave_deleted">Concediu Șters</option>
            <option value="saturday_created">Sâmbătă Adăugată</option>
            <option value="saturday_deleted">Sâmbătă Ștearsă</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Căutare Text
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Nume, detalii, note..."
              className={inputCls + " text-xs py-2 pl-8"}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            De la data
          </label>
          <input
            type="date"
            className={inputCls + " text-xs py-2"}
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Până la
            </label>
            <input
              type="date"
              className={inputCls + " text-xs py-2"}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
          <button
            onClick={applyFilters}
            className="h-[37px] px-3.5 bg-sidesi-600 hover:bg-sidesi-500 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1"
            title="Aplică filtre"
          >
            <Filter className="w-3.5 h-3.5" /> Filtrează
          </button>
          <button
            onClick={handleReset}
            className="h-[37px] px-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-all"
            title="Resetează filtrele"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
              <th className="text-left px-4 py-2.5">Dată & Oră</th>
              <th className="text-left px-4 py-2.5">Angajat Vizat</th>
              <th className="text-left px-4 py-2.5">Acțiune</th>
              <th className="text-left px-4 py-2.5">Detalii & Justificare</th>
              <th className="text-left px-4 py-2.5">Efectuat De</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {adminLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  Nicio înregistrare în jurnalul de audit pentru filtrele specificate.
                </td>
              </tr>
            ) : (
              adminLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-500 font-medium">
                    {new Date(log.created_at).toLocaleDateString('ro-RO', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                    {log.user_detail ? (
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-sidesi-500/20 text-sidesi-400 font-bold text-[10px] flex items-center justify-center">
                          {log.user_detail.full_name[0]?.toUpperCase()}
                        </span>
                        <span>{log.user_detail.full_name}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 font-semibold ${ACTION_COLORS[log.action] || 'text-slate-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${ACTION_COLORS[log.action]?.replace('text-', 'bg-') || 'bg-slate-400'}`} />
                      {log.action_display}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 max-w-md">
                    {log.details || '—'}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                    {log.performed_by_detail ? (
                      <span>{log.performed_by_detail.full_name}</span>
                    ) : (
                      <span>Sistem</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Admin Tab Main Component ────────────────────────────────────────────────

const AdminTab: React.FC = () => {
  const {
    allBalances, fetchAllBalances, fetchAdminLogs, adjustBalance,
    exportAllUsersReportExcel, isLoading, error, clearError
  } = useDutyDaysStore();

  const [showAdjust, setShowAdjust] = useState<UserBalanceKPI | null>(null);
  const [selectedReportUser, setSelectedReportUser] = useState<UserBalanceKPI | null>(null);
  const [saving, setSaving] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ days_to_recover: 0, free_days_available: 0, reason: '' });

  const currentYear = new Date().getFullYear();
  const [centralizedYear, setCentralizedYear] = useState<number | undefined>(currentYear);

  useEffect(() => {
    fetchAllBalances();
    fetchAdminLogs();
  }, []);

  const handleAdjust = async () => {
    if (!showAdjust) return;
    setSaving(true);
    const ok = await adjustBalance(showAdjust.user_id, adjustForm.days_to_recover, adjustForm.free_days_available, adjustForm.reason);
    setSaving(false);
    if (ok) setShowAdjust(null);
  };

  const openAdjust = (u: UserBalanceKPI) => {
    setAdjustForm({ days_to_recover: u.days_to_recover, free_days_available: u.free_days_available, reason: '' });
    setShowAdjust(u);
  };

  const handleExportAllUsers = async () => {
    setExportingAll(true);
    await exportAllUsersReportExcel(centralizedYear);
    setExportingAll(false);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <AnimatePresence>{error && <ErrorBanner msg={error} onClose={clearError} />}</AnimatePresence>

      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 rounded-2xl p-5">
        {/* Header & Global Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-base">
            <Shield className="w-5 h-5 text-sidesi-400" /> Panou Administrare & Raportare Centralizată
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/50 text-xs">
              <span className="text-slate-500 font-medium">An Raport:</span>
              <select
                className="bg-transparent font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                value={centralizedYear || ''}
                onChange={e => setCentralizedYear(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="" className="dark:bg-slate-900">Toți anii</option>
                <option value={currentYear} className="dark:bg-slate-900">{currentYear}</option>
                <option value={currentYear - 1} className="dark:bg-slate-900">{currentYear - 1}</option>
                <option value={currentYear - 2} className="dark:bg-slate-900">{currentYear - 2}</option>
              </select>
            </div>

            <button
              onClick={handleExportAllUsers}
              disabled={exportingAll}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              {exportingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              Export Centralizator Toți Angajații (.xlsx)
            </button>

            <button
              onClick={() => { fetchAllBalances(); fetchAdminLogs(); }}
              className="text-xs text-sidesi-400 hover:text-sidesi-300 font-semibold flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700/50 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Actualizează
            </button>
          </div>
        </div>

        <div className="space-y-7">
          {/* Balanța Tuturor Angajaților Table */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sidesi-400" /> Balanța Tuturor Angajaților
              </span>
              <span className="text-xs font-normal text-slate-400">
                Click pe "Fișă & Raport" pentru dosarul detaliat cu ce și când și-a luat fiecare angajat
              </span>
            </h4>

            {isLoading && allBalances.length === 0 ? (
              <Spinner />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60">
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Angajat</th>
                      <th className="text-center px-4 py-3 text-xs font-bold text-rose-400/80 uppercase tracking-wide">Lipsite</th>
                      <th className="text-center px-4 py-3 text-xs font-bold text-emerald-400/80 uppercase tracking-wide">Libere Disp.</th>
                      <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Sâm. Alese</th>
                      <th className="text-center px-4 py-3 text-xs font-bold text-sidesi-400/80 uppercase tracking-wide">Viitoare</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Acțiuni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                    {allBalances.map(u => (
                      <tr key={u.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-sidesi-500/20 flex items-center justify-center text-sidesi-400 font-bold text-xs flex-shrink-0">
                              {u.full_name[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="text-slate-800 dark:text-slate-200 font-medium text-sm">{u.full_name}</div>
                              <div className="text-slate-500 text-xs">@{u.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold text-sm ${u.days_to_recover > 0 ? 'text-rose-400' : 'text-slate-400 dark:text-slate-600'}`}>
                            {u.days_to_recover}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold text-sm ${u.free_days_available > 0 ? 'text-emerald-400' : 'text-slate-400 dark:text-slate-600'}`}>
                             {u.free_days_available}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-slate-700 dark:text-slate-300 font-medium text-sm">{u.saturdays_booked}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium text-sm ${u.saturdays_booked_upcoming > 0 ? 'text-sidesi-400' : 'text-slate-400 dark:text-slate-600'}`}>
                            {u.saturdays_booked_upcoming}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedReportUser(u)}
                              className="px-2.5 py-1.5 rounded-lg bg-sidesi-500/10 hover:bg-sidesi-500/20 text-sidesi-600 dark:text-sidesi-400 font-semibold text-xs flex items-center gap-1.5 transition-all border border-sidesi-500/30"
                              title="Vizualizează raportul complet cu zile și concedii"
                            >
                              <FileText className="w-3.5 h-3.5" /> Fișă & Raport
                            </button>
                            <button
                              onClick={() => openAdjust(u)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-1 transition-all"
                              title="Ajustează balanța manual"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Ajustează
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Audit Logs System Panel */}
          <AuditLogsPanel users={allBalances} />
        </div>
      </div>

      {/* Adjust Balance Modal */}
      <AnimatePresence>
        {showAdjust && (
          <Modal title={`Ajustare Balanță — ${showAdjust.full_name}`} onClose={() => setShowAdjust(null)}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Zile Lipsite 🔴</label>
                  <input type="number" min={0} className={inputCls}
                    value={adjustForm.days_to_recover}
                    onChange={e => setAdjustForm(p => ({ ...p, days_to_recover: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className={labelCls}>Zile Libere Disp. 🟢</label>
                  <input type="number" min={0} className={inputCls}
                    value={adjustForm.free_days_available}
                    onChange={e => setAdjustForm(p => ({ ...p, free_days_available: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Motiv</label>
                <input className={inputCls} placeholder="Ex: Corecție manuală ianuarie"
                  value={adjustForm.reason}
                  onChange={e => setAdjustForm(p => ({ ...p, reason: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAdjust} disabled={saving} className={btnPrimary + ' flex-1 justify-center'}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Salvează
                </button>
                <button onClick={() => setShowAdjust(null)} className={btnSecondary}>Anulează</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* User Detailed Report Modal */}
      <AnimatePresence>
        {selectedReportUser && (
          <UserReportModal
            targetUser={selectedReportUser}
            onClose={() => setSelectedReportUser(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

const DutyDays: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'calendar' | 'saturdays' | 'admin' | 'leave'>('calendar');
  const { fetchCalendarEvents, fetchSaturdays, fetchMyData, fetchAllBalances, fetchMyLeaves, calendarYear, calendarMonth } = useDutyDaysStore();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role_detail?.name === 'Super Admin';

  const [autoHighlightDate, setAutoHighlightDate] = useState<string | null>(null);

  const handleRedirectToSaturday = (dateStr: string) => {
    const year = new Date(dateStr + 'T12:00:00').getFullYear();
    useDutyDaysStore.getState().setSaturdaysYear(year);
    setAutoHighlightDate(dateStr);
    setActiveTab('saturdays');
  };

  useEffect(() => {
    fetchCalendarEvents(calendarYear, calendarMonth);
    fetchSaturdays(calendarYear);
    fetchMyData();
    fetchMyLeaves();
    if (isSuperAdmin) fetchAllBalances();
  }, [calendarYear, calendarMonth, isSuperAdmin]);

  const tabs: { id: 'calendar' | 'saturdays' | 'admin' | 'leave'; label: string; icon: React.ReactNode }[] = [
    { id: 'calendar',  label: 'Calendar',          icon: <Calendar     className="w-4 h-4" /> },
    { id: 'saturdays', label: 'Zile de Serviciu',  icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'leave',     label: 'Concediu',           icon: <Plane        className="w-4 h-4" /> },
    ...(isSuperAdmin ? [{ id: 'admin' as const, label: 'Administrare', icon: <Shield className="w-4 h-4" /> }] : []),
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Evidența Zilelor de Serviciu</h1>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-0.5">Calendar de evenimente și sâmbete de serviciu</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 p-1 rounded-2xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-sidesi-600 text-white shadow-md shadow-sidesi-500/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === 'calendar' ? (
            <CalendarTab onRedirectToSaturday={handleRedirectToSaturday} />
          ) : activeTab === 'saturdays' ? (
            <SaturdaysTab
              autoHighlightDate={autoHighlightDate}
              onClearHighlight={() => setAutoHighlightDate(null)}
            />
          ) : activeTab === 'leave' ? (
            <LeaveTab />
          ) : (
            <AdminTab />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default DutyDays;
