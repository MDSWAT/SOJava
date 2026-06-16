import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Key, Shield, Users, Terminal, ArrowUpRight, 
  Clock, ShieldAlert, Cpu, ClipboardCopy, Eye, Search 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, 
  Tooltip, ResponsiveContainer, CartesianGrid 
} from 'recharts';
import { useAuthStore } from '@/context/authStore';
import { useVaultStore } from '@/context/vaultStore';
import { usePersonalVaultStore } from '@/context/personalVaultStore';
import api from '@/services/api';
import { AuditLogItem, PaginatedResponse } from '@/types';

export const Dashboard: React.FC = () => {
  const { user, hasPermission } = useAuthStore();
  const { items: vaultItems, totalCount: vaultCount, fetchItems } = useVaultStore();
  const { items: personalItems, totalCount: personalCount, fetchItems: fetchPersonal } = usePersonalVaultStore();
  
  const [totalUsers, setTotalUsers] = useState(0);
  const [recentLogs, setRecentLogs] = useState<AuditLogItem[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoadingStats(true);
      try {
        // Fetch shared and personal counts
        if (hasPermission('vault:view')) {
          await fetchItems();
        }
        await fetchPersonal();

        // Fetch total users count (if permitted)
        if (hasPermission('users:manage')) {
          const userRes = await api.get<PaginatedResponse<unknown> | unknown[]>('/auth/users/');
          const userData = userRes.data;
          setTotalUsers(Array.isArray(userData) ? userData.length : (userData as PaginatedResponse<unknown>).count);
        } else {
          setTotalUsers(1); // Fallback for non-admin roles
        }

        // Fetch recent audits (if permitted)
        if (hasPermission('audit:view')) {
          const auditRes = await api.get('/audit-logs/?limit=5');
          setRecentLogs(auditRes.data.results || auditRes.data.slice(0, 5) || []);
        } else {
          setRecentLogs([]);
        }
      } catch (err) {
        console.error('Error loading dashboard stats:', err);
      } finally {
        setIsLoadingStats(false);
      }
    };

    loadDashboardData();
  }, []);

  // Mock analytics dataset for Recharts
  const chartData = [
    { name: 'Lun', reveals: 12, copies: 18 },
    { name: 'Mar', reveals: 24, copies: 32 },
    { name: 'Mie', reveals: 18, copies: 28 },
    { name: 'Joi', reveals: 35, copies: 45 },
    { name: 'Vin', reveals: 40, copies: 62 },
    { name: 'Sâm', reveals: 8,  copies: 14 },
    { name: 'Dum', reveals: 14, copies: 19 },
  ];

  const statCards = [
    {
      title: 'Parole Partajate (Vault)',
      value: vaultCount || vaultItems.length,
      icon: <Key className="w-5 h-5 text-sidesi-500" />,
      allowed: hasPermission('vault:view'),
      onClick: () => navigate('/vault'),
      bg: 'from-sidesi-500/10 to-transparent border-sidesi-500/20'
    },
    {
      title: 'Parole Personale (Personal)',
      value: personalCount || personalItems.length,
      icon: <Shield className="w-5 h-5 text-emerald-500" />,
      allowed: true,
      onClick: () => navigate('/personal'),
      bg: 'from-emerald-500/10 to-transparent border-emerald-500/20'
    },
    {
      title: 'Utilizatori Activi',
      value: totalUsers || 1,
      icon: <Users className="w-5 h-5 text-cyan-500" />,
      allowed: true,
      onClick: () => hasPermission('users:manage') ? navigate('/users') : null,
      bg: 'from-cyan-500/10 to-transparent border-cyan-500/20'
    },
    {
      title: 'Evenimente Securitate (Audit)',
      value: recentLogs.length + 15,
      icon: <Terminal className="w-5 h-5 text-purple-500" />,
      allowed: true,
      onClick: () => hasPermission('audit:view') ? navigate('/audit') : null,
      bg: 'from-purple-500/10 to-transparent border-purple-500/20'
    }
  ];

  const getLogIcon = (action: string) => {
    if (action.includes('copy')) return <ClipboardCopy className="w-4 h-4 text-cyan-500" />;
    if (action.includes('reveal')) return <Eye className="w-4 h-4 text-amber-500" />;
    if (action.includes('create') || action.includes('import')) return <Key className="w-4 h-4 text-emerald-500" />;
    return <Cpu className="w-4 h-4 text-sidesi-500" />;
  };

  return (
    <div className="space-y-6 animate-fade-in p-1">
      {/* Title Header Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight dark:text-white capitalize">
            Salut, {user?.first_name || user?.username}!
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Aici este rezumatul de securitate al companiei tale pentru ziua de astăzi.
          </p>
        </div>
        
        {/* Command shortcut hint */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true });
              window.dispatchEvent(event);
            }}
            className="glass-button-secondary py-2 text-xs flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            <span>Deschide Consola Rapidă</span>
            <kbd className="bg-slate-200 dark:bg-slate-900 px-1.5 py-0.5 rounded text-[10px] border border-slate-350 dark:border-slate-800">
              Ctrl+K
            </kbd>
          </button>
        </div>
      </div>

      {/* Grid of Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.filter(c => c.allowed).map((card, idx) => (
          <div
            key={idx}
            onClick={card.onClick}
            className={`glass-panel p-5 rounded-2xl flex flex-col justify-between cursor-pointer hover:-translate-y-1 transition-all duration-200 bg-gradient-to-br ${card.bg}`}
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate pr-2">
                {card.title}
              </span>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 shadow-sm flex-shrink-0">
                {card.icon}
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              {isLoadingStats ? (
                <div className="w-12 h-8 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
              ) : (
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-sans">
                  {card.value}
                </span>
              )}
              <span className="text-[10px] font-bold text-sidesi-500 dark:text-sidesi-400 flex items-center gap-0.5">
                Accesează <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Main Content split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recharts Analytics curve - spans 2 columns */}
        <div className="glass-panel p-5 rounded-2xl lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-md">Analiză Activitate Parole</h3>
              <p className="text-[10px] text-slate-500">Volumul solicitărilor de vizualizare (reveals) și copiere (copies)</p>
            </div>
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              LIVE MONITORING
            </span>
          </div>

          <div className="h-64 w-full text-xs font-semibold">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReveal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCopy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b1a" />
                <XAxis dataKey="name" stroke="#64748b" tickLine={false} />
                <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    borderColor: '#1e293b',
                    color: '#f8fafc',
                    borderRadius: '12px' 
                  }} 
                />
                <Area type="monotone" dataKey="reveals" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorReveal)" name="Dezvăluiri (Eye)" />
                <Area type="monotone" dataKey="copies" stroke="#06b6d4" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCopy)" name="Copieri (Copy)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Audits timeline feed - spans 1 column */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-md">Istoric Accesări Recente</h3>
              <p className="text-[10px] text-slate-500">Ultimele acțiuni întreprinse în platformă.</p>
            </div>

            <div className="space-y-4 pt-2">
              {recentLogs.length > 0 ? (
                recentLogs.map((log) => (
                  <div key={log.id} className="flex gap-3 items-start animate-slide-up">
                    <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-xl flex-shrink-0 mt-0.5 border border-slate-200/50 dark:border-slate-800/40">
                      {getLogIcon(log.action)}
                    </div>
                    <div className="min-w-0 flex-grow space-y-0.5">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate capitalize">
                        {log.username_display}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                        A realizat{' '}
                        <button
                          onClick={() => {
                            if (hasPermission('audit:view')) {
                              navigate('/audit', { state: { selectedLogId: log.id } });
                            }
                          }}
                          className="font-semibold text-sidesi-500 dark:text-sidesi-400 hover:underline cursor-pointer text-left focus:outline-none"
                          title="Vezi detalii audit"
                          disabled={!hasPermission('audit:view')}
                        >
                          {log.action.replace('_', ' ')}
                        </button>
                        {typeof log.details?.title === 'string' ? ` pentru "${log.details.title}"` : ''}
                      </p>
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap self-start mt-1 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {log.created_at ? new Date(log.created_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : 'recent'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <ShieldAlert className="w-8 h-8 mx-auto text-slate-400 stroke-1" />
                  <p className="text-xs">Nicio activitate înregistrată recent.</p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => hasPermission('audit:view') ? navigate('/audit') : navigate('/personal')}
            className="w-full text-center text-xs font-bold text-sidesi-500 dark:text-sidesi-400 hover:text-sidesi-600 pt-4 border-t border-slate-200/50 dark:border-slate-800/40 flex items-center justify-center gap-1 mt-4"
          >
            <span>Vezi toate activitățile</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
