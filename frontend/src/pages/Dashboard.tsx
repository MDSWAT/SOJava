import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Key, ArrowUpRight, 
  Clock, ShieldAlert, Cpu, ClipboardCopy, Eye, Search,
  MapPin, Calendar, CheckCircle2, AlertTriangle, RefreshCw, 
  Activity, Building, Phone, ArrowRight, Layers
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, 
  Tooltip, ResponsiveContainer, CartesianGrid 
} from 'recharts';
import { useAuthStore } from '@/context/authStore';
import api from '@/services/api';
import { DashboardStatsData } from '@/types';

export const Dashboard: React.FC = () => {
  const { user, hasPermission } = useAuthStore();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDashboardStats = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await api.get<DashboardStatsData>('/auth/dashboard-stats/');
      setStats(res.data);
    } catch (err) {
      console.error('Eroare la încărcarea statisticilor dashboard:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const getLogIcon = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('copy')) return <ClipboardCopy className="w-3.5 h-3.5 text-cyan-500" />;
    if (act.includes('reveal') || act.includes('view')) return <Eye className="w-3.5 h-3.5 text-amber-500" />;
    if (act.includes('create') || act.includes('import')) return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
    if (act.includes('delete') || act.includes('deactivate')) return <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />;
    if (act.includes('update') || act.includes('edit')) return <RefreshCw className="w-3.5 h-3.5 text-blue-500" />;
    return <Activity className="w-3.5 h-3.5 text-purple-500" />;
  };

  const formatActionText = (action: string) => {
    const labels: Record<string, string> = {
      reveal_mev_key: 'Dezvăluire cheie MEV',
      update_ecc: 'Actualizare cartelă ECC',
      login_success: 'Autentificare reușită',
      balance_adjusted: 'Ajustare balanță gardă',
      export_virtual_ecc_excel: 'Export Excel cartele ECC',
      download_pdf: 'Descărcare fișă PDF',
      import_mev_keys: 'Import chei MEV',
      leave_added: 'Înregistrare concediu',
      user_update: 'Actualizare utilizator',
      event_created: 'Creare eveniment calendar',
    };
    return labels[action] || action.replace(/_/g, ' ');
  };

  // Date formatting helper in Romanian
  const todayFormatted = new Date().toLocaleDateString('ro-RO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="space-y-6 animate-fade-in p-1">
      {/* ── Top Header Greeting & Quick Actions ───────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-slate-900/40 via-slate-800/20 to-transparent p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white capitalize">
              Salut, {user?.first_name || user?.username}!
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sistem Operațional
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span className="capitalize">{todayFormatted}</span>
            <span>•</span>
            <span>Panou centralizat de monitorizare și statistici enterprise SIDESI</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fetchDashboardStats(true)}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
            title="Reîmprospătează datele"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sidesi-500' : ''}`} />
            <span className="hidden sm:inline">Actualizează</span>
          </button>

          <button
            onClick={() => {
              const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true });
              window.dispatchEvent(event);
            }}
            className="px-3 py-2 rounded-xl bg-sidesi-500/10 hover:bg-sidesi-500/15 border border-sidesi-500/20 text-sidesi-600 dark:text-sidesi-400 text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Consolă Rapidă</span>
            <kbd className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-[10px] border border-sidesi-500/30 text-sidesi-700 dark:text-sidesi-300 font-mono">
              Ctrl+K
            </kbd>
          </button>
        </div>
      </div>

      {/* ── Row 1: Primary Module KPI Cards ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Virtual ECC */}
        <div
          onClick={() => navigate('/virtual-ecc')}
          className="glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer hover:-translate-y-1 transition-all duration-200 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/25 group shadow-sm hover:shadow-emerald-500/5"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Aparate de Casă (ECC)
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                {isLoading ? (
                  <div className="w-16 h-8 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
                ) : (
                  <span className="text-3xl font-black text-slate-900 dark:text-white font-sans">
                    {stats?.virtual_ecc.total ?? 0}
                  </span>
                )}
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/25">
                  {stats?.virtual_ecc.by_status.pus_in_exploatare ?? 0} active
                </span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-sm group-hover:scale-110 transition-transform">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              {stats?.virtual_ecc.z_raport_count ?? 0} Z Rapoarte • {stats?.virtual_ecc.with_ip ?? 0} cu IP
            </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Deschide <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 2: Password Vault */}
        <div
          onClick={() => navigate('/vault')}
          className="glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer hover:-translate-y-1 transition-all duration-200 bg-gradient-to-br from-sidesi-500/10 via-sidesi-500/5 to-transparent border-sidesi-500/25 group shadow-sm hover:shadow-sidesi-500/5"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Parole Partajate (Vault)
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                {isLoading ? (
                  <div className="w-16 h-8 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
                ) : (
                  <span className="text-3xl font-black text-slate-900 dark:text-white font-sans">
                    {stats?.vault.shared_count ?? 0}
                  </span>
                )}
                <span className="text-[11px] font-bold text-sidesi-600 dark:text-sidesi-400 bg-sidesi-500/15 px-2 py-0.5 rounded-md border border-sidesi-500/25 font-mono">
                  AES-256
                </span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-sidesi-500/15 border border-sidesi-500/30 text-sidesi-600 dark:text-sidesi-400 shadow-sm group-hover:scale-110 transition-transform">
              <Key className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              {stats?.vault.personal_count ?? 0} parole personale
            </span>
            <span className="font-bold text-sidesi-600 dark:text-sidesi-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Accesează <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 3: Posta Contacts */}
        <div
          onClick={() => navigate('/posta-contacts')}
          className="glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer hover:-translate-y-1 transition-all duration-200 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/25 group shadow-sm hover:shadow-amber-500/5"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Contacte Poșta Moldovei
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                {isLoading ? (
                  <div className="w-16 h-8 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
                ) : (
                  <span className="text-3xl font-black text-slate-900 dark:text-white font-sans">
                    {stats?.posta_contacts.total_contacts ?? 0}
                  </span>
                )}
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/25">
                  {stats?.posta_contacts.total_raioane ?? 37} raioane
                </span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-sm group-hover:scale-110 transition-transform">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              {stats?.posta_contacts.ingineri_count ?? 0} ingineri • {stats?.posta_contacts.oficii_count ?? 0} oficii
            </span>
            <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Agendă <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 4: Duty Days & Team */}
        <div
          onClick={() => navigate('/duty-days')}
          className="glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer hover:-translate-y-1 transition-all duration-200 bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-transparent border-cyan-500/25 group shadow-sm hover:shadow-cyan-500/5"
        >
          <div className="flex justify-between items-start">
            <div className="min-w-0 pr-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Gărzi & Concedii
              </span>
              <div className="mt-1">
                {isLoading ? (
                  <div className="w-24 h-8 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
                ) : (
                  <div className="truncate">
                    <span className="text-lg font-black text-slate-900 dark:text-white font-sans block truncate" title={stats?.duty_days.next_duty?.user_name || 'Fără gărzi programate'}>
                      {stats?.duty_days.next_duty?.user_name || 'Fără programare'}
                    </span>
                    <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
                      {stats?.duty_days.next_duty ? `Gardă: ${new Date(stats.duty_days.next_duty.date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })}` : 'Următorul weekend'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 shadow-sm group-hover:scale-110 transition-transform flex-shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              {stats?.duty_days.active_leaves_today ?? 0} concedii azi • {stats?.users.active ?? 0} utilizatori
            </span>
            <span className="font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Calendar <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* ── Row 2: Deep-Dive Module Breakdown Widgets ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Widget 1: Virtual ECC In-Depth Breakdown */}
        <div className="glass-panel p-5 rounded-2xl space-y-4 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Status Echipamente ECC</h3>
                  <p className="text-[10px] text-slate-500">Distribuție cartele pe stări operaționale</p>
                </div>
              </div>
              <span className="text-xs font-black text-slate-900 dark:text-white font-mono">
                {stats?.virtual_ecc.total ?? 0} total
              </span>
            </div>

            {/* Visual multi-segment progress bar */}
            {stats && stats.virtual_ecc.total > 0 && (
              <div className="space-y-1.5">
                <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-slate-200 dark:border-slate-800">
                  <div
                    style={{ width: `${(stats.virtual_ecc.by_status.pus_in_exploatare / stats.virtual_ecc.total) * 100}%` }}
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    title={`Pus în exploatare: ${stats.virtual_ecc.by_status.pus_in_exploatare}`}
                  />
                  <div
                    style={{ width: `${(stats.virtual_ecc.by_status.neconfigurat / stats.virtual_ecc.total) * 100}%` }}
                    className="h-full bg-rose-500 rounded-full transition-all"
                    title={`Neconfigurat: ${stats.virtual_ecc.by_status.neconfigurat}`}
                  />
                  <div
                    style={{ width: `${(stats.virtual_ecc.by_status.certificat / stats.virtual_ecc.total) * 100}%` }}
                    className="h-full bg-blue-500 rounded-full transition-all"
                    title={`Certificat: ${stats.virtual_ecc.by_status.certificat}`}
                  />
                  <div
                    style={{ width: `${(stats.virtual_ecc.by_status.eroare_certificare / stats.virtual_ecc.total) * 100}%` }}
                    className="h-full bg-pink-500 rounded-full transition-all"
                    title={`Eroare: ${stats.virtual_ecc.by_status.eroare_certificare}`}
                  />
                  <div
                    style={{ width: `${(stats.virtual_ecc.by_status.in_certificare / stats.virtual_ecc.total) * 100}%` }}
                    className="h-full bg-amber-500 rounded-full transition-all"
                    title={`În certificare: ${stats.virtual_ecc.by_status.in_certificare}`}
                  />
                  <div
                    style={{ width: `${(stats.virtual_ecc.by_status.aplicatie_instalata / stats.virtual_ecc.total) * 100}%` }}
                    className="h-full bg-orange-400 rounded-full transition-all"
                    title={`Aplicație instalată: ${stats.virtual_ecc.by_status.aplicatie_instalata}`}
                  />
                </div>
              </div>
            )}

            {/* Legend & Stats Grid — all 6 statuses, clickable to filter */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              {[
                { key: 'pus_in_exploatare',   label: 'Pus în exploatare',   dot: 'bg-emerald-500', num: 'text-emerald-500', bg: 'hover:bg-emerald-500/10 hover:border-emerald-500/40' },
                { key: 'neconfigurat',         label: 'Neconfigurat',         dot: 'bg-rose-500',    num: 'text-rose-500',    bg: 'hover:bg-rose-500/10 hover:border-rose-500/40' },
                { key: 'certificat',           label: 'Certificat',           dot: 'bg-blue-500',    num: 'text-blue-500',    bg: 'hover:bg-blue-500/10 hover:border-blue-500/40' },
                { key: 'in_certificare',       label: 'În certificare',       dot: 'bg-amber-500',   num: 'text-amber-500',   bg: 'hover:bg-amber-500/10 hover:border-amber-500/40' },
                { key: 'aplicatie_instalata',  label: 'Aplicație instalată',  dot: 'bg-orange-400',  num: 'text-orange-400',  bg: 'hover:bg-orange-400/10 hover:border-orange-400/40' },
                { key: 'eroare_certificare',   label: 'Eroare certificare',   dot: 'bg-pink-500',    num: 'text-pink-500',    bg: 'hover:bg-pink-500/10 hover:border-pink-500/40' },
              ].map(({ key, label, dot, num, bg }) => (
                <button
                  key={key}
                  onClick={() => navigate(`/virtual-ecc?status=${key}`)}
                  className={`flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/40 cursor-pointer transition-all duration-150 group ${bg}`}
                  title={`Filtrează după: ${label}`}
                >
                  <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium">
                    <span className={`w-2 h-2 rounded-full ${dot} flex-shrink-0`} />
                    <span className="truncate">{label}</span>
                  </span>
                  <span className={`font-black font-mono ${num} ml-1 flex-shrink-0`}>
                    {stats?.virtual_ecc.by_status[key as keyof typeof stats.virtual_ecc.by_status] ?? 0}
                  </span>
                </button>
              ))}
            </div>

            {/* Secondary KPIs for ECC */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-center">
              <div className="p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Z Raport</div>
                <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {stats?.virtual_ecc.z_raport_count ?? 0}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-cyan-500/5 border border-cyan-500/15">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Cu IP Alocat</div>
                <div className="text-sm font-black text-cyan-600 dark:text-cyan-400">
                  {stats?.virtual_ecc.with_ip ?? 0}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-purple-500/5 border border-purple-500/15">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Chei MEV</div>
                <div className="text-sm font-black text-purple-600 dark:text-purple-400">
                  {stats?.virtual_ecc.with_mev ?? 0}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/virtual-ecc')}
            className="w-full text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 pt-2 border-t border-slate-200/50 dark:border-slate-800/40 flex items-center justify-center gap-1"
          >
            <span>Deschide Modulul Virtual ECC</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Widget 2: Poșta Moldovei Network & Contacts */}
        <div className="glass-panel p-5 rounded-2xl space-y-4 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Rețea Poștală & Raioane</h3>
                  <p className="text-[10px] text-slate-500">Infrastructura de oficii și asistență teritorială</p>
                </div>
              </div>
              <span className="text-xs font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                MD Teritorial
              </span>
            </div>

            {/* Highlights Grid */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Ingineri Tehnici</span>
                  <Phone className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {stats?.posta_contacts.ingineri_count ?? 32}
                </div>
                <p className="text-[10px] text-slate-500">Asistență directă în raioane</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Oficii Poștale</span>
                  <MapPin className="w-3.5 h-3.5 text-cyan-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {stats?.posta_contacts.oficii_count ?? 679}
                </div>
                <p className="text-[10px] text-slate-500">Puncte de lucru înregistrate</p>
              </div>
            </div>

            {/* Coverage Box */}
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Acoperire 37 Raioane și Municipii
                </span>
              </div>
              <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md">
                100%
              </span>
            </div>
          </div>

          <button
            onClick={() => navigate('/posta-contacts')}
            className="w-full text-center text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 pt-2 border-t border-slate-200/50 dark:border-slate-800/40 flex items-center justify-center gap-1"
          >
            <span>Vezi Harta & Agendă Contacte</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Widget 3: Gărzi & Concedii Echipă (Duty Days) */}
        <div className="glass-panel p-5 rounded-2xl space-y-4 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-500">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Serviciu & Concedii</h3>
                  <p className="text-[10px] text-slate-500">Disponibilitatea echipei și gărzi de sâmbătă</p>
                </div>
              </div>
              <span className="text-xs font-bold text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                Planificare
              </span>
            </div>

            {/* Next Duty Card */}
            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                  Următoarea Sâmbătă de Serviciu
                </span>
                {stats?.duty_days.next_duty?.is_booked && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 rounded">
                    Rezervată
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-900 dark:text-white text-sm">
                  {stats?.duty_days.next_duty?.user_name || 'Nicio sâmbătă programată'}
                </div>
                {stats?.duty_days.next_duty && (
                  <span className="text-xs font-mono font-bold text-slate-500">
                    {new Date(stats.duty_days.next_duty.date).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>

            {/* Leaves mini summary */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/40">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Concedii Astăzi</div>
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {stats?.duty_days.active_leaves_today ?? 0}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/40">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Planificate (30z)</div>
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {stats?.duty_days.upcoming_leaves_count ?? 0}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/duty-days')}
            className="w-full text-center text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 pt-2 border-t border-slate-200/50 dark:border-slate-800/40 flex items-center justify-center gap-1"
          >
            <span>Deschide Calendarul & Rapoartele de Gărzi</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Row 3: Real Analytics Curve & Recent Audit Feed ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real Analytics AreaChart - spans 2 columns */}
        <div className="glass-panel p-5 rounded-2xl lg:col-span-2 space-y-4 border border-slate-200/80 dark:border-slate-800/80">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-md">Activitate Sistem în Ultimele 7 Zile</h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <Activity className="w-3 h-3 animate-pulse" />
                  DATE REALE DIN AUDIT
                </span>
              </div>
              <p className="text-[10px] text-slate-500">
                Volumul operațiunilor de accesare chei MEV, parole, modificări echipamente și autentificări
              </p>
            </div>
          </div>

          <div className="h-64 w-full text-xs font-semibold">
            {stats && stats.chart_data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.chart_data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReveal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorUpdate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorLogin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b1a" />
                  <XAxis dataKey="name" stroke="#64748b" tickLine={false} />
                  <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255,255,255,0.95)', 
                      borderColor: 'rgba(226,232,240,0.8)',
                      color: '#0f172a',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }} 
                    wrapperClassName="!text-slate-900 dark:!text-slate-100"
                  />
                  <Area type="monotone" dataKey="reveals" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorReveal)" name="Dezvăluiri Chei / Parole" />
                  <Area type="monotone" dataKey="updates" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorUpdate)" name="Actualizări Echipamente" />
                  <Area type="monotone" dataKey="logins" stroke="#8b5cf6" strokeWidth={1.5} fillOpacity={1} fill="url(#colorLogin)" name="Autentificări" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                Se încarcă datele de analiză...
              </div>
            )}
          </div>
        </div>

        {/* Real Recent Platform Activity - spans 1 column */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border border-slate-200/80 dark:border-slate-800/80">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-md">Jurnal Activitate Recentă</h3>
                <p className="text-[10px] text-slate-500">Ultimele evenimente înregistrate pe platformă</p>
              </div>
              <span className="text-[10px] font-bold text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                Live Audit
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {stats && stats.recent_logs.length > 0 ? (
                stats.recent_logs.map((log) => (
                  <div key={log.id} className="flex gap-2.5 items-start p-2 rounded-xl hover:bg-slate-100/60 dark:hover:bg-slate-900/40 transition-colors">
                    <div className="p-1.5 bg-slate-100 dark:bg-slate-900 rounded-lg flex-shrink-0 mt-0.5 border border-slate-200/50 dark:border-slate-800/40">
                      {getLogIcon(log.action)}
                    </div>
                    <div className="min-w-0 flex-grow space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {log.username_display}
                        </p>
                        <span className="text-[9px] text-slate-400 whitespace-nowrap flex items-center gap-0.5 flex-shrink-0">
                          <Clock className="w-2.5 h-2.5" />
                          {log.created_at ? new Date(log.created_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : 'recent'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                        <span className="font-semibold text-sidesi-600 dark:text-sidesi-400">
                          {formatActionText(log.action)}
                        </span>
                        {log.details?.title ? ` (${log.details.title})` : log.details?.terminal_id ? ` (${log.details.terminal_id})` : ''}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 space-y-2">
                  <ShieldAlert className="w-8 h-8 mx-auto text-slate-400 stroke-1" />
                  <p className="text-xs">Nicio activitate înregistrată recent.</p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => hasPermission('audit:view') ? navigate('/audit') : navigate('/personal')}
            className="w-full text-center text-xs font-bold text-sidesi-600 dark:text-sidesi-400 hover:text-sidesi-500 pt-3 border-t border-slate-200/50 dark:border-slate-800/40 flex items-center justify-center gap-1 mt-3"
          >
            <span>Vezi Tot Jurnalul de Audit</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
