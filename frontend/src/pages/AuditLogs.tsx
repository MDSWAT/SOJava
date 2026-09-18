import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Terminal, Search, Eye, ClipboardCopy, PlusCircle, Trash, 
  Download, AlertTriangle, ShieldCheck, Globe, X, ChevronLeft, ChevronRight,
  KeyRound, LogIn, FileDown, FileUp, RefreshCw
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
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;
  
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

  const fetchLogs = async (targetPage: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page: targetPage };
      if (search) params.search = search;
      if (moduleFilter) params.module = moduleFilter;
      if (actionFilter) params.action = actionFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      
      const response = await api.get('/audit-logs/', { params });
      // DRF provides pagination body {"count": 100, "results": [...] } or plain array (unpaginated fallback)
      if (Array.isArray(response.data)) {
        setLogs(response.data);
        setTotalCount(response.data.length);
      } else {
        setLogs(response.data.results || []);
        setTotalCount(response.data.count || 0);
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Eroare la încărcarea jurnalelor de audit. Nu aveți permisiunea necesară.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [search, moduleFilter, actionFilter, startDate, endDate]);

  useEffect(() => {
    fetchLogs(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, moduleFilter, actionFilter, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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

  const handleExportLogs = async () => {
    // Export ALL logs matching current filters (not just the current page)
    if (totalCount === 0 && logs.length === 0) return;

    let exportLogs: AuditLogItem[] = logs;
    if (totalCount > logs.length) {
      // Backend uses fixed PAGE_SIZE (no page_size override), so fetch every page sequentially
      try {
        const baseParams: Record<string, string> = {};
        if (search) baseParams.search = search;
        if (moduleFilter) baseParams.module = moduleFilter;
        if (actionFilter) baseParams.action = actionFilter;
        if (startDate) baseParams.start_date = startDate;
        if (endDate) baseParams.end_date = endDate;

        const totalPagesToFetch = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
        const allResults: AuditLogItem[] = [];
        for (let p = 1; p <= totalPagesToFetch; p++) {
          const response = await api.get('/audit-logs/', { params: { ...baseParams, page: p } });
          const pageResults = Array.isArray(response.data) ? response.data : (response.data.results || []);
          allResults.push(...pageResults);
        }
        exportLogs = allResults;
      } catch {
        exportLogs = logs;
      }
    }
    if (exportLogs.length === 0) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Timestamp,User,Action,Module,IP Address,User Agent,Details\r\n";
    
    exportLogs.forEach((log) => {
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
    if (action.includes('login_failed')) {
      return { bg: 'bg-rose-500/10 text-rose-500 border-rose-500/25', icon: <AlertTriangle className="w-4 h-4" /> };
    }
    if (action.includes('login') || action.includes('logout')) {
      return { bg: 'bg-sky-500/10 text-sky-500 border-sky-500/25', icon: <LogIn className="w-4 h-4" /> };
    }
    if (action.includes('reveal') || action.includes('key')) {
      return { bg: 'bg-amber-500/10 text-amber-500 border-amber-500/25', icon: <Eye className="w-4 h-4" /> };
    }
    if (action.includes('copy')) {
      return { bg: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/25', icon: <ClipboardCopy className="w-4 h-4" /> };
    }
    if (action.includes('export') || action.includes('download')) {
      return { bg: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/25', icon: <FileDown className="w-4 h-4" /> };
    }
    if (action.includes('import')) {
      return { bg: 'bg-violet-500/10 text-violet-500 border-violet-500/25', icon: <FileUp className="w-4 h-4" /> };
    }
    if (action.includes('deactivate')) {
      return { bg: 'bg-orange-500/10 text-orange-500 border-orange-500/25', icon: <ShieldCheck className="w-4 h-4" /> };
    }
    if (action.includes('approved')) {
      return { bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25', icon: <ShieldCheck className="w-4 h-4" /> };
    }
    if (action.includes('rejected') || action.includes('cancelled')) {
      return { bg: 'bg-rose-500/10 text-rose-500 border-rose-500/25', icon: <AlertTriangle className="w-4 h-4" /> };
    }
    if (action.includes('booked') || action.includes('taken')) {
      return { bg: 'bg-teal-500/10 text-teal-500 border-teal-500/25', icon: <PlusCircle className="w-4 h-4" /> };
    }
    if (action.includes('adjust')) {
      return { bg: 'bg-amber-500/10 text-amber-500 border-amber-500/25', icon: <RefreshCw className="w-4 h-4" /> };
    }
    if (action.includes('update')) {
      return { bg: 'bg-blue-500/10 text-blue-500 border-blue-500/25', icon: <RefreshCw className="w-4 h-4" /> };
    }
    if (action.includes('create') || action.includes('added')) {
      return { bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25', icon: <PlusCircle className="w-4 h-4" /> };
    }
    if (action.includes('delete')) {
      return { bg: 'bg-rose-500/10 text-rose-500 border-rose-500/25', icon: <Trash className="w-4 h-4" /> };
    }
    if (action.includes('password')) {
      return { bg: 'bg-amber-500/10 text-amber-500 border-amber-500/25', icon: <KeyRound className="w-4 h-4" /> };
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
          disabled={totalCount === 0}
          className="glass-button-secondary py-2 text-xs flex items-center gap-2 disabled:opacity-50 self-start"
        >
          <Download className="w-4 h-4" />
          <span>Exportă Jurnal Audit ({totalCount})</span>
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
            <option value="auth">Autentificare / Securitate</option>
            <option value="vault">Password Vault</option>
            <option value="virtual_ecc">Echipamente Virtuale (ECC)</option>
            <option value="inventory">Inventar</option>
            <option value="posta_contacts">Contacte Poștă</option>
            <option value="organizations">Organizații</option>
            <option value="duty_days">Zile de Serviciu</option>
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
            {/* Auth */}
            <option value="login_success">Autentificare Reușită</option>
            <option value="login_failed">Autentificare Eșuată</option>
            <option value="user_create">Creare Utilizator</option>
            <option value="user_update">Actualizare Utilizator</option>
            <option value="user_delete">Ștergere Utilizator</option>
            <option value="user_deactivate">Dezactivare Utilizator</option>
            <option value="role_create">Creare Rol</option>
            <option value="role_update">Actualizare Rol</option>
            <option value="role_delete">Ștergere Rol</option>
            {/* Vault */}
            <option value="reveal_password">Dezvăluire Parolă (Vault)</option>
            <option value="copy_password">Copiere Parolă (Vault)</option>
            <option value="create_password">Creare Parolă (Vault)</option>
            <option value="update_password">Actualizare Parolă (Vault)</option>
            <option value="delete_password">Ștergere Parolă (Vault)</option>
            <option value="import_excel">Import Excel (Vault)</option>
            <option value="export_excel">Export Excel (Vault)</option>
            {/* ECC */}
            <option value="create_ecc">Creare Echipament (ECC)</option>
            <option value="update_ecc">Actualizare Echipament (ECC)</option>
            <option value="delete_ecc">Ștergere Echipament (ECC)</option>
            <option value="reveal_mev_key">Dezvăluire Cheie MEV</option>
            <option value="download_pdf">Descărcare PDF (ECC)</option>
            <option value="import_ecc_pdf">Import PDF (ECC)</option>
            <option value="import_ips_excel">Import Excel IPS (ECC)</option>
            <option value="export_virtual_ecc_excel">Export Excel (ECC)</option>
            {/* Inventory */}
            <option value="inventory_create">Creare Articol (Inventar)</option>
            <option value="inventory_update">Actualizare Articol (Inventar)</option>
            <option value="inventory_delete">Ștergere Articol (Inventar)</option>
            <option value="inventory_export_excel">Export Excel (Inventar)</option>
            <option value="inventory_export_pdf">Export PDF (Inventar)</option>
            {/* Posta Contacts */}
            <option value="raion_create">Creare Raion (Poștă)</option>
            <option value="raion_update">Actualizare Raion (Poștă)</option>
            <option value="raion_delete">Ștergere Raion (Poștă)</option>
            <option value="contact_create">Creare Contact (Poștă)</option>
            <option value="contact_update">Actualizare Contact (Poștă)</option>
            <option value="contact_delete">Ștergere Contact (Poștă)</option>
            {/* Organizations */}
            <option value="org_create">Creare Organizație</option>
            <option value="org_update">Actualizare Organizație</option>
            <option value="org_delete">Ștergere Organizație</option>
            {/* Duty Days */}
            <option value="event_created">Creare Eveniment (Serviciu)</option>
            <option value="event_deleted">Ștergere Eveniment (Serviciu)</option>
            <option value="saturday_created">Creare Sâmbătă de Serviciu</option>
            <option value="saturday_deleted">Ștergere Sâmbătă de Serviciu</option>
            <option value="saturday_booked">Rezervare Sâmbătă</option>
            <option value="saturday_cancelled">Anulare Rezervare Sâmbătă</option>
            <option value="free_day_taken">Zi Liberă Luată</option>
            <option value="balance_adjusted">Ajustare Balanță</option>
            <option value="leave_added">Adăugare Concediu</option>
            <option value="leave_cancelled">Anulare Concediu</option>
            <option value="leave_approved">Aprobare Concediu</option>
            <option value="leave_rejected">Respingere Concediu</option>
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
          <h3 className="font-bold text-slate-900 dark:text-white text-md">Acces Restricționat</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{error}</p>
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
              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200/50 dark:border-slate-800/40 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Pagina <span className="font-bold text-slate-800 dark:text-slate-200">{page}</span> din {totalPages} &middot; {totalCount} loguri totale
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
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
                    <div className={`absolute -left-[30px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center ${style.bg}`}>
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
                            <div>Login: <span className="font-mono text-slate-600 dark:text-slate-300">{log.details.login_username}</span></div>
                          )}
                          {typeof log.details.title === 'string' && log.details.title && (
                            <div>Item: <span className="font-mono text-slate-600 dark:text-slate-350">{log.details.title}</span></div>
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
          <h3 className="font-bold text-slate-900 dark:text-white text-md">Niciun log înregistrat</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Nu s-a înregistrat nicio activitate conform filtrelor alese.</p>
        </div>
      )}

      {/* Log Inspector Dialog */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/60 backdrop-blur-sm" onClick={() => setSelectedLog(null)} />
          <div className="relative w-full max-w-lg glass-panel p-6 rounded-2xl z-10 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-850">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sidesi-400" />
                <span>Detalii Audit Eveniment</span>
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold text-slate-600 dark:text-slate-350">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 font-medium">Timestamp:</p>
                  <p className="text-slate-900 dark:text-white font-mono">{selectedLog.created_at ? formatDate(selectedLog.created_at) : ''}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">Utilizator (IP):</p>
                  <p className="text-slate-900 dark:text-white font-mono">{selectedLog.username_display} ({selectedLog.ip_address})</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 font-medium">Modul:</p>
                  <p className="text-slate-900 dark:text-white uppercase font-bold tracking-wider text-sidesi-400">{selectedLog.module}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">Tip Acțiune:</p>
                  <p className="text-slate-900 dark:text-white font-mono uppercase text-amber-500">{selectedLog.action}</p>
                </div>
              </div>

              <div>
                <p className="text-slate-500 font-medium mb-1">Browser User Agent:</p>
                <div className="p-2.5 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 font-mono text-[10px] leading-relaxed break-all">
                  {selectedLog.user_agent}
                </div>
              </div>

              <div>
                <p className="text-slate-500 font-medium mb-1">Metadata Eveniment (JSON):</p>
                <pre className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-850 text-cyan-600 dark:text-cyan-400 font-mono text-[10px] overflow-x-auto leading-relaxed">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-850">
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
