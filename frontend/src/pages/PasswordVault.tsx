import React, { useEffect, useState } from 'react';
import { 
  Plus, Search, Key, ClipboardCopy, Eye, EyeOff, Edit, 
  Trash2, Upload, FileDown, Download, AlertTriangle, X,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { useVaultStore } from '@/context/vaultStore';
import { useAuthStore } from '@/context/authStore';
import { useToastStore } from '@/context/toastStore';
import { PasswordVaultItem } from '@/types';
import TableSkeleton from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import PasswordGenerator from '@/components/shared/PasswordGenerator';

// Clipboard helper with HTTP fallback
const copyToClipboard = (text: string): Promise<void> => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for HTTP / non-secure contexts
  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    ok ? resolve() : reject(new Error('execCommand copy failed'));
  });
};

export const PasswordVault: React.FC = () => {
  const { 
    items, totalCount, isLoading, error, fetchItems, 
    createItem, updateItem, deleteItem, 
    revealPassword, importExcel, exportExcel, downloadTemplate 
  } = useVaultStore();

  const hasPermission = useAuthStore((state) => state.hasPermission);
  const addToast = useToastStore((state) => state.addToast);

  // States
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(totalCount / 50);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (currentPage > 4) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 3) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };
  
  // Decrypted states mapping (vaultItem.id -> plain_password)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  
  // Modals Toggles
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PasswordVaultItem | null>(null);
  
  // Form values
  const [formOrg, setFormOrg] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formLogin, setFormLogin] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showGen, setShowGen] = useState(false);
  
  // Import Modal
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  
  // Deletion Confirm
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    fetchItems(search, undefined, currentPage);
  }, [search, currentPage]);



  // 1. Password reveal logic (with auto-hide timer)
  const handleReveal = async (id: string) => {
    if (revealedPasswords[id]) {
      // Toggle off
      const next = { ...revealedPasswords };
      delete next[id];
      setRevealedPasswords(next);
      return;
    }

    const plain = await revealPassword(id);
    if (plain) {
      setRevealedPasswords(prev => ({ ...prev, [id]: plain }));
      addToast('Parola a fost dezvăluită și logată în audit.', 'info');
      
      // Auto hide after 10 seconds for compliance safety
      setTimeout(() => {
        setRevealedPasswords(prev => {
          const updated = { ...prev };
          delete updated[id];
          return updated;
        });
      }, 10000);
    } else {
      addToast('Nu s-a putut dezvălui parola.', 'error');
    }
  };

  // 2. Clipboard copy – only allowed after reveal
  const handleCopy = (id: string) => {
    const plain = revealedPasswords[id];
    if (!plain) {
      addToast('Dezvăluiți parola mai întâi înainte de a o copia.', 'warning');
      return;
    }
    copyToClipboard(plain)
      .then(() => addToast('Parola a fost copiată în clipboard!', 'success'))
      .catch(() => addToast('Copierea a eșuat. Verificați permisiunile browserului.', 'error'));
  };

  // 3. Form submit (Create/Update)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formOrg.trim() || !formLogin.trim()) {
      addToast('Completați câmpurile obligatorii.', 'warning');
      return;
    }

    const payload = {
      organization_name: formOrg.trim(),
      title: formTitle.trim(),
      login_username: formLogin.trim(),
      associated_email: formEmail.trim(),
      associated_phone: formPhone.trim(),
      ...(formPassword ? { password: formPassword } : {})
    };

    let success = false;
    if (editingItem) {
      success = await updateItem(editingItem.id, payload);
      if (success) addToast('Parola partajată a fost actualizată!', 'success');
    } else {
      if (!formPassword) {
        addToast('Parola este obligatorie la creare.', 'warning');
        return;
      }
      success = await createItem(payload);
      if (success) addToast('Parolă adăugată cu succes în vault!', 'success');
    }

    if (success) {
      setIsFormOpen(false);
      resetForm();
      fetchItems(search, undefined, currentPage);
    } else {
      addToast('Operațiunea a eșuat. Verificați permisiunile.', 'error');
    }
  };

  const openEdit = (item: PasswordVaultItem) => {
    setEditingItem(item);
    setFormOrg(item.organization_detail?.name || '');
    setFormTitle(item.title);
    setFormLogin(item.login_username);
    setFormEmail(item.associated_email || '');
    setFormPhone(item.associated_phone || '');
    setFormPassword(''); // blank for updates unless explicitly writing new
    setIsFormOpen(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormOrg('');
    setFormTitle('');
    setFormLogin('');
    setFormEmail('');
    setFormPhone('');
    setFormPassword('');
    setShowGen(false);
  };

  // 4. Excel Import execution
  const handleImportSubmit = async () => {
    if (!importFile) return;
    const res = await importExcel(importFile);
    if (res.success) {
      setImportResult({
        success: true,
        message: res.message,
        imported: res.imported || 0,
        skipped: res.skipped || 0,
        errors: res.errors || []
      });
      addToast(res.message, 'success');
      fetchItems(search, undefined, currentPage);
    } else {
      addToast(res.message, 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const success = await deleteItem(deleteTarget);
    if (success) {
      addToast('Elementul a fost eliminat permanent (soft deleted).', 'success');
      setDeleteTarget(null);
    } else {
      addToast('Ștergerea a eșuat.', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight dark:text-white">
            Shared Password Vault
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Parolele pentru servere, conexiuni FTP și servicii interne partajate în organizație.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasPermission('vault:import') && (
            <button
              onClick={() => {
                setImportResult(null);
                setImportFile(null);
                setIsImportOpen(true);
              }}
              className="glass-button-secondary py-2 text-xs flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Import Excel</span>
            </button>
          )}
          {hasPermission('vault:export') && (
            <button
              onClick={exportExcel}
              className="glass-button-secondary py-2 text-xs flex items-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              <span>Export</span>
            </button>
          )}
          {hasPermission('vault:edit') && (
            <button
              onClick={() => { resetForm(); setIsFormOpen(true); }}
              className="glass-button-primary py-2 text-xs flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Adaugă Parolă</span>
            </button>
          )}
        </div>
      </div>

      {/* Query filters */}
      <div className="glass-panel p-4 rounded-xl">
        {/* Search */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Caută după organizație, redenumită, login sau email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full glass-input pl-10 text-sm"
          />
        </div>
      </div>

      {/* Main Table view */}
      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <div className="p-8 text-center glass-panel rounded-2xl space-y-2">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="font-bold text-white text-md">A apărut o eroare</h3>
          <p className="text-xs text-slate-400">{error}</p>
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl overflow-hidden shadow-xl border border-slate-200/50 dark:border-slate-800/40">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/50 dark:bg-slate-900/60 border-b border-slate-200/50 dark:border-slate-800/40 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider h-11">
                    <th className="px-5">Organizația</th>
                    <th className="px-4">Redenumita</th>
                    <th className="px-4">Login User</th>
                    <th className="px-4">Parolă</th>
                    <th className="px-4">Asociat Email</th>
                    <th className="px-4">Telefon</th>
                    <th className="px-4">Creat de</th>
                    <th className="px-5 text-right">Acțiuni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/20 font-medium">
                  {items.map((item) => {
                    const isRevealed = !!revealedPasswords[item.id];
                    const passwordValue = isRevealed ? revealedPasswords[item.id] : item.masked_password;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors h-14 text-slate-800 dark:text-slate-200">
                        <td className="px-5 font-bold text-sidesi-500 dark:text-sidesi-400 truncate max-w-[120px]">
                          {item.organization_detail?.name}
                        </td>
                        <td className="px-4 truncate max-w-[160px] font-semibold dark:text-white" title={item.title}>
                          {item.title}
                        </td>
                        <td className="px-4 font-mono select-all truncate max-w-[120px]">
                          {item.login_username}
                        </td>
                        <td className="px-4 font-mono select-all text-xs tracking-wide">
                          <span className={`px-2 py-1 rounded-md ${isRevealed ? 'bg-amber-500/10 text-amber-500 font-bold border border-amber-500/10' : 'text-slate-400'}`}>
                            {passwordValue}
                          </span>
                        </td>
                        <td className="px-4 text-slate-500 dark:text-slate-400 truncate max-w-[140px]" title={item.associated_email || undefined}>
                          {item.associated_email || '—'}
                        </td>
                        <td className="px-4 text-slate-500 dark:text-slate-400 truncate max-w-[140px]" title={item.associated_phone || undefined}>
                          {item.associated_phone || '—'}
                        </td>
                        <td className="px-4 text-slate-500 capitalize">{item.created_by_user}</td>
                        <td className="px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {hasPermission('vault:reveal') && (
                              <button
                                onClick={() => handleReveal(item.id)}
                                className="p-2 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title={isRevealed ? "Ascunde parola" : "Afișează parola"}
                              >
                                {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            )}
                            {hasPermission('vault:copy') && (
                              <button
                                onClick={() => handleCopy(item.id)}
                                disabled={!revealedPasswords[item.id]}
                                className={`p-2 rounded-lg transition-colors ${
                                  revealedPasswords[item.id]
                                    ? 'text-slate-400 hover:text-cyan-500 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    : 'text-slate-600 opacity-40 cursor-not-allowed'
                                }`}
                                title={revealedPasswords[item.id] ? 'Copiază parola' : 'Dezvăluiți parola mai întâi'}
                              >
                                <ClipboardCopy className="w-4 h-4" />
                              </button>
                            )}
                            {hasPermission('vault:edit') && (
                              <button
                                onClick={() => openEdit(item)}
                                className="p-2 text-slate-400 hover:text-sidesi-500 dark:hover:text-sidesi-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title="Editează detalii"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {hasPermission('vault:delete') && (
                              <button
                                onClick={() => setDeleteTarget(item.id)}
                                className="p-2 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title="Șterge credențial"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 glass-panel rounded-2xl border border-slate-200/50 dark:border-slate-800/40 text-xs font-semibold">
              <div className="text-slate-500 dark:text-slate-400">
                Afișare pagină <span className="font-bold text-slate-800 dark:text-white">{currentPage}</span> din <span className="font-bold text-slate-800 dark:text-white">{totalPages}</span> ({totalCount} înregistrări)
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="glass-button-secondary py-1.5 px-3 flex items-center gap-1 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Înapoi</span>
                </button>

                {getPageNumbers().map((p, idx) => {
                  if (p === '...') {
                    return (
                      <span key={`ell-${idx}`} className="px-1.5 text-slate-400 select-none">
                        ...
                      </span>
                    );
                  }
                  const isCurrent = p === currentPage;
                  return (
                    <button
                      key={`page-${p}`}
                      onClick={() => setCurrentPage(p as number)}
                      className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all ${
                        isCurrent
                          ? 'bg-sidesi-500 text-white shadow-md border border-sidesi-500/30'
                          : 'glass-button-secondary hover:bg-slate-100/10'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="glass-button-secondary py-1.5 px-3 flex items-center gap-1 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span>Înainte</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 glass-panel rounded-2xl space-y-3">
          <Key className="w-12 h-12 mx-auto text-slate-400 stroke-1" />
          <h3 className="font-bold text-white text-md">Nicio parolă înregistrată</h3>
          <p className="text-xs text-slate-400">Încearcă să modifici filtrele sau adaugă o parolă nouă.</p>
        </div>
      )}

      {/* Creation/Edit Popup Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
          <div className="relative w-full max-w-lg glass-panel p-6 rounded-2xl max-h-[90vh] overflow-y-auto z-10 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-850">
              <h3 className="text-lg font-bold text-white">
                {editingItem ? 'Editează Credențial Server' : 'Adaugă Parolă Nouă în Vault'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400">Organizație*</label>
                  <input
                    type="text"
                    value={formOrg}
                    onChange={(e) => setFormOrg(e.target.value)}
                    placeholder="ex: SIDESI"
                    className="w-full glass-input text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Redenumita (Opțional)</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="ex: APC A0120-0238 sau 192.168.1.5"
                    className="w-full glass-input text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400">Login Username*</label>
                  <input
                    type="text"
                    value={formLogin}
                    onChange={(e) => setFormLogin(e.target.value)}
                    placeholder="ex: 218_ccl"
                    className="w-full glass-input text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Asociat Email (Opțional)</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="ex: admin@ccl.ro"
                    className="w-full glass-input text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400">Număr telefon asociat (Opțional)</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="ex: 0722123456"
                    className="w-full glass-input text-xs"
                  />
                </div>
                <div className="space-y-1">
                  {/* Empty spacer for alignment */}
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800/40">
                <div className="flex justify-between items-center">
                  <label className="text-slate-400">
                    {editingItem ? 'Schimbă Parola (lasă gol pentru a păstra)' : 'Parolă Generată/Introdusă*'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowGen(!showGen)}
                    className="text-sidesi-500 hover:text-sidesi-400 text-[10px] font-bold uppercase tracking-wider"
                  >
                    {showGen ? 'Ascunde Generator' : 'Generează o parolă sigură'}
                  </button>
                </div>
                
                {!showGen && (
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editingItem ? "Introduceți noua parolă sau lăsați gol" : "Introduceți parola manual"}
                    className="w-full glass-input font-mono text-xs"
                  />
                )}

                {showGen && (
                  <div className="animate-slide-up">
                    <PasswordGenerator 
                      showInsertButton 
                      onSelectPassword={(generated) => {
                        setFormPassword(generated);
                        setShowGen(false);
                      }} 
                    />
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="glass-button-secondary py-2"
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  className="glass-button-primary py-2"
                >
                  Salvează Credențialul
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => { setIsImportOpen(false); setImportFile(null); setImportResult(null); }} />
          <div className="relative w-full max-w-md glass-panel p-6 rounded-2xl z-10 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-850">
              <h3 className="text-lg font-bold text-white">Import Credențiale din Excel</h3>
              <button
                onClick={() => {
                  setIsImportOpen(false);
                  setImportFile(null);
                  setImportResult(null);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold">
              {importResult ? (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-900/40 rounded-2xl border border-slate-800/40 space-y-3">
                    <h4 className="text-sm font-bold text-white">Rezumat Import</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/10 text-emerald-500 text-center">
                        <div className="text-[10px] uppercase opacity-75 font-semibold">Adăugate</div>
                        <div className="text-2xl font-black mt-1">{importResult.imported}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/10 text-amber-500 text-center">
                        <div className="text-[10px] uppercase opacity-75 font-semibold">Omise</div>
                        <div className="text-2xl font-black mt-1">{importResult.skipped}</div>
                      </div>
                    </div>
                  </div>

                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-slate-400 flex justify-between px-1">
                        <span>Detalii erori/omiteri:</span>
                        <span>{importResult.errors.length} linii</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto p-3 rounded-xl bg-slate-950/60 border border-slate-850 text-slate-350 font-mono text-[10px] leading-normal space-y-1.5 scrollbar-thin">
                        {importResult.errors.slice(0, 100).map((err, i) => (
                          <div key={i} className="border-b border-slate-900/40 pb-1.5 last:border-0 last:pb-0">{err}</div>
                        ))}
                        {importResult.errors.length > 100 && (
                          <div className="text-slate-500 text-center pt-1 font-sans">
                            Afișate primele 100 de erori. Consultați logurile serverului pentru restul.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-2 border-t border-slate-850">
                    <button
                      type="button"
                      onClick={() => {
                        setIsImportOpen(false);
                        setImportFile(null);
                        setImportResult(null);
                      }}
                      className="glass-button-primary py-2 px-6"
                    >
                      Finalizează
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800/40">
                    <div>
                      <h4 className="text-white font-bold">Model de Import</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Pentru a asigura formatarea corectă a datelor.</p>
                    </div>
                    <button
                      type="button"
                      onClick={downloadTemplate}
                      className="glass-button-secondary py-1.5 px-3 text-[11px] flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5 text-sidesi-400" />
                      <span>Descarcă Model</span>
                    </button>
                  </div>

                  <p className="text-slate-400 leading-normal">
                    Selectați fișierul Excel de pe disc. Fișierul trebuie să aibă pe primul rând capetele de coloane: 
                    <span className="font-bold text-white block mt-1">Organizația, Redenumita, Login, Parola, Email</span>
                  </p>

                  {/* Drag and Drop Box */}
                  <label className="border-2 border-dashed border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center gap-2.5 cursor-pointer hover:bg-slate-900/20 hover:border-sidesi-500/50 transition-all select-none">
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      className="sr-only"
                    />
                    <Upload className="w-8 h-8 text-sidesi-400 animate-bounce" />
                    <span className="text-slate-350">
                      {importFile ? importFile.name : 'Faceți click sau trageți fișierul Excel aici'}
                    </span>
                    {importFile && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        ({(importFile.size / 1024).toFixed(1)} KB)
                      </span>
                    )}
                  </label>

                  <div className="flex justify-end gap-2 border-t border-slate-850 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsImportOpen(false);
                        setImportFile(null);
                      }}
                      className="glass-button-secondary py-2"
                    >
                      Anulează
                    </button>
                    <button
                      type="button"
                      disabled={!importFile}
                      onClick={handleImportSubmit}
                      className="glass-button-primary py-2 px-5 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Procesează Importul
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation prompt */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Șterge Credențial"
        message="Sunteți sigur că doriți să ștergeți această parolă partajată? Această acțiune va realiza o ștergere logică (soft-delete), putând fi recuperată ulterior doar de Super Admin."
        confirmLabel="Șterge"
        type="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
export default PasswordVault;
