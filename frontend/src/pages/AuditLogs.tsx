import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Terminal, Search, Eye, ClipboardCopy, PlusCircle, Trash, 
  Download, AlertTriangle, ShieldCheck, Globe, X 
} from 'lucide-react';
import api from '@/services/api';
import { AuditLogItem } from '@/types';
import TableSkeleton from '@/components/ui/Skeleton';
import { useToastStore } from '@/context/toastStore';

export const AuditLogs: React.FC = () => {
  const location = useLocation();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const addToast = useToastStore((state) => state.addToast);

  // Helper to format date from ISO string
  const formatDate = (isoString: string): string => {
    try {
      return new Date(isoString).toLocaleString('ro-RO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const formatTime = (isoString: string): string => {
    try {
      return new Date(isoString).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // States filters
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Log Details Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (moduleFilter) params.module = moduleFilter;
      if (actionFilter) params.action = actionFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      
      const response = await api.get('/audit-logs/', { params });
      // DRF provides pagination body {"count": 100, "results": [...] } or plain array
      const results = response.data.results || response.data;
      setLogs(results);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Eroare la încărcarea jurnalelor de audit. Nu aveți permisiunea necesară.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [search, moduleFilter, actionFilter, startDate, endDate]);

  useEffect(() => {
    const state = location.state as { selectedLogId?: string } | null;
    if (state?.selectedLogId) {
      const loadAndOpenLog = async () => {
        try {
          const response = await api.get(`/audit-logs/${state.selectedLogId}/`);
          setSelectedLog(response.data);
        } catch (err) {
          console.error("Error loading selected audit log:", err);
        }
      };
      loadAndOpenLog();
    }
  }, [location.state]);

  const handleExportLogs = () => {
    // Generate simple text/CSV download from current visible logs
    if (logs.length === 0) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Timestamp,User,Action,Module,IP Address,User Agent,Details\r\n";
    
    logs.forEach((log) => {
      const row = [
        log.created_at ? formatDate(log.created_at) : '',
        log.username_display,
        log.action,
        log.module,
        log.ip_address,
        log.user_agent.replace(/,/g, ' '), // sanitize comma
        JSON.stringify(log.details).replace(/,/g, ';')
      ].join(",");
      csvContent += row + "\r\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SIDESI_AuditLogs_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Fișierul CSV de audit a fost generat!', 'success');
  };

  const getActionStyles = (action: string) => {
    if (action.includes('reveal')) {
      return { bg: 'bg-amber-500/10 text-amber-500 border-amber-500/25', icon: <Eye className="w-4 h-4" /> };
    }
    if (action.includes('copy')) {
      return { bg: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/25', icon: <ClipboardCopy className="w-4 h-4" /> };
    }
    if (action.includes('create') || action.includes('import')) {
      return { bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25', icon: <PlusCircle className="w-4 h-4" /> };
    }
    if (action.includes('delete')) {
      return { bg: 'bg-rose-500/10 text-rose-500 border-rose-500/25', icon: <Trash className="w-4 h-4" /> };
    }
    return { bg: 'bg-sidesi-500/10 text-sidesi-500 border-sidesi-500/25', icon: <Terminal className="w-4 h-4" /> };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight dark:text-white">
            Audit Logs
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monitorizarea în timp real a operațiunilor de securitate, a vizualizării parolelor și a conexiunilor efectuate de utilizatori.
          </p>
        </div>

        <button
          onClick={handleExportLogs}
          disabled={logs.length === 0}
          className="glass-button-secondary py-2 text-xs flex items-center gap-2 disabled:opacity-50 self-start"
        >
          <Download className="w-4 h-4" />
          <span>Exportă Jurnal Audit</span>
        </button>
      </div>

      {/* Advanced Filter Criteria */}
      <div className="glass-panel p-4 rounded-2xl shadow grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-center">
        {/* Search */}
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Caută în jurnale (user, acțiune, IP)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full glass-input pl-9 text-xs"
          />
        </div>

        {/* Module select */}
        <div>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="w-full glass-input text-xs"
          >
            <option value="">Toate modulele</option>
            <option value="vault">Password Vault</option>
            <option value="auth">Autentificare / Securitate</option>
          </select>
        </div>

        {/* Action select */}
        <div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full glass-input text-xs"
          >
            <option value="">Toate acțiunile</option>
            <option value="login_success">Autentificare Reușită</option>
            <option value="login_failed">Autentificare Eșuată</option>
            <option value="password_reveal">Dezvăluire Parolă</option>
            <option value="password_copy">Copiere Parolă</option>
            <option value="create">Creare Element</option>
            <option value="update">Actualizare Element</option>
            <option value="delete">Ștergere Element</option>
            <option value="import">Import Date</option>
            <option value="export">Export Date</option>
          </select>
        </div>

        {/* Start Date */}
        <div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full glass-input text-xs"
            placeholder="Dată început"
          />
        </div>

        {/* End Date */}
        <div>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full glass-input text-xs"
            placeholder="Dată sfârșit"
          />
        </div>
      </div>

      {/* Grid of Results */}
      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <div className="p-8 text-center glass-panel rounded-2xl space-y-2">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="font-bold text-white text-md">Acces Restricționat</h3>
          <p className="text-xs text-slate-400">{error}</p>
        </div>
      ) : logs.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Logs list - takes 2 cols */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-panel rounded-2xl overflow-hidden shadow">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/50 dark:bg-slate-900/60 border-b border-slate-200/50 dark:border-slate-800/40 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider h-11">
                      <th className="px-5">Timestamp</th>
                      <th className="px-4">Utilizator</th>
                      <th className="px-4">Modul</th>
                      <th className="px-4">Eveniment</th>
                      <th className="px-4">IP Address</th>
                      <th className="px-5 text-right">Detalii</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/20 font-medium">
                    {logs.map((log) => {
                      const style = getActionStyles(log.action);
                      return (
                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors h-13 text-slate-800 dark:text-slate-200">
                          <td className="px-5 text-slate-500 font-mono whitespace-nowrap">
                            {log.created_at ? formatDate(log.created_at) : ''}
                          </td>
                          <td className="px-4 font-bold capitalize dark:text-white">
                            {log.username_display}
                          </td>
                          <td className="px-4 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                            {log.module}
                          </td>
                          <td className="px-4">
                            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${style.bg}`}>
                              {log.action.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 font-mono text-slate-500 flex items-center gap-1 mt-3">
                            <Globe className="w-3.5 h-3.5 text-slate-400" />
                            <span>{log.ip_address}</span>
                          </td>
                          <td className="px-5 text-right">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="text-sidesi-500 hover:text-sidesi-600 font-semibold"
                            >
                              Inspectează
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Timeline diagram summary - takes 1 col */}
          <div className="glass-panel p-5 rounded-2xl space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-md">Timeline Vizual Evenimente</h3>
              <p className="text-[10px] text-slate-500">Cronologia operațiunilor de astăzi.</p>
            </div>

            <div className="relative pl-6 space-y-5 timeline-border">
              {logs.slice(0, 8).map((log, idx) => {
                const style = getActionStyles(log.action);
                return (
                  <div key={idx} className="relative animate-slide-up">
                    {/* Ring anchor */}
                    <div className={`absolute -left-[30px] top-1 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center ${style.bg}`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-current" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-slate-400">{log.created_at ? formatTime(log.created_at) : ''}</span>
                        <span className="font-semibold text-slate-500 capitalize">{log.username_display}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {log.action.replace('_', ' ').toUpperCase()}
                      </p>
                      {log.details && (
                        <div className="text-[10px] text-slate-500 space-y-0.5 mt-0.5">
                          {typeof log.details.organization === 'string' && log.details.organization && (
                            <div>Org: <span className="font-bold text-sidesi-400">{log.details.organization}</span></div>
                          )}
                          {typeof log.details.login_username === 'string' && log.details.login_username && (
                            <div>Login: <span className="font-mono text-slate-300">{log.details.login_username}</span></div>
                          )}
                          {typeof log.details.title === 'string' && log.details.title && (
                            <div>Item: <span className="font-mono text-slate-350">{log.details.title}</span></div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 glass-panel rounded-2xl space-y-3">
          <Terminal className="w-12 h-12 mx-auto text-slate-400 stroke-1" />
          <h3 className="font-bold text-white text-md">Niciun log înregistrat</h3>
          <p className="text-xs text-slate-400">Nu s-a înregistrat nicio activitate conform filtrelor alese.</p>
        </div>
      )}

      {/* Log Inspector Dialog */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setSelectedLog(null)} />
          <div className="relative w-full max-w-lg glass-panel p-6 rounded-2xl z-10 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-850">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sidesi-400" />
                <span>Detalii Audit Eveniment</span>
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold text-slate-350">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 font-medium">Timestamp:</p>
                  <p className="text-white font-mono">{selectedLog.created_at ? formatDate(selectedLog.created_at) : ''}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">Utilizator (IP):</p>
                  <p className="text-white font-mono">{selectedLog.username_display} ({selectedLog.ip_address})</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 font-medium">Modul:</p>
                  <p className="text-white uppercase font-bold tracking-wider text-sidesi-400">{selectedLog.module}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">Tip Acțiune:</p>
                  <p className="text-white font-mono uppercase text-amber-500">{selectedLog.action}</p>
                </div>
              </div>

              <div>
                <p className="text-slate-500 font-medium mb-1">Browser User Agent:</p>
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-850 text-slate-400 font-mono text-[10px] leading-relaxed break-all">
                  {selectedLog.user_agent}
                </div>
              </div>

              <div>
                <p className="text-slate-500 font-medium mb-1">Metadata Eveniment (JSON):</p>
                <pre className="p-3 bg-slate-950 rounded-xl border border-slate-850 text-cyan-400 font-mono text-[10px] overflow-x-auto leading-relaxed">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-850">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="glass-button-primary py-2 px-6"
                >
                  Închide Detalii
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AuditLogs;
