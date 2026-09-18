import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { 
  Plus, Search, Key, ClipboardCopy, Eye, EyeOff, Edit, 
  Trash2, Upload, FileDown, Download, AlertTriangle, X,
  ChevronLeft, ChevronRight, Building2, ShieldCheck, Lock,
  Hash, Calendar, User, Mail, Phone, Check
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

  // Column Widths for resizing
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    organization: 220,
    title: 220,
    login: 150,
    password: 180,
    email: 180,
    phone: 130,
    createdBy: 120,
    actions: 140
  });

  const startResize = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[colKey];

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setColWidths(prev => ({
        ...prev,
        [colKey]: Math.max(80, startWidth + deltaX)
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

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
  
  // Detail View popup
  const [viewItem, setViewItem] = useState<PasswordVaultItem | null>(null);
  const [viewRevealed, setViewRevealed] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleViewCopy = (text: string | null | undefined, field: string) => {
    if (!text) return;
    copyToClipboard(text)
      .then(() => {
        setCopiedField(field);
        addToast('Copiat în clipboard!', 'success');
        setTimeout(() => setCopiedField(null), 2000);
      })
      .catch(() => addToast('Copierea a eșuat.', 'error'));
  };

  const handleViewReveal = async () => {
    if (!viewItem) return;
    if (viewRevealed) { setViewRevealed(false); return; }
    const plain = await revealPassword(viewItem.id);
    if (plain) {
      setRevealedPasswords(prev => ({ ...prev, [viewItem.id]: plain }));
      setViewRevealed(true);
      addToast('Parola a fost dezvăluită și logată în audit.', 'info');
      setTimeout(() => setViewRevealed(false), 10000);
    } else {
      addToast('Nu s-a putut dezvălui parola.', 'error');
    }
  };

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
    <div className="flex flex-col space-y-4 animate-fade-in">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-shrink-0">
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
      <div className="glass-panel p-4 rounded-xl flex-shrink-0">
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
        <div className="p-8 text-center glass-panel rounded-2xl space-y-2 flex-shrink-0">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="font-bold text-slate-900 dark:text-white text-md">A apărut o eroare</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{error}</p>
        </div>
      ) : items.length > 0 ? (
        <div className="flex flex-col space-y-4">
          <div className="glass-panel rounded-2xl overflow-hidden shadow-xl border border-slate-200/50 dark:border-slate-800/40">
            {/* Scroll hint arrow on mobile */}
            <div className="table-scroll-hint overflow-x-auto touch-scroll">
              <table className="min-w-full text-left border-collapse text-xs table-fixed">
                <thead>
                  <tr className="bg-slate-100/50 dark:bg-slate-900/60 border-b border-slate-200/50 dark:border-slate-800/40 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider h-11 select-none">
                    <th className="relative px-5 py-3 align-middle" style={{ width: colWidths.organization }}>
                      <div className="truncate">Organizația</div>
                      <div 
                        onMouseDown={(e) => startResize(e, 'organization')}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sidesi-500/40 active:bg-sidesi-500 z-10 border-r border-slate-300 dark:border-slate-700/60"
                      />
                    </th>
                    <th className="relative px-4 py-3 align-middle" style={{ width: colWidths.title }}>
                      <div className="truncate">Redenumita</div>
                      <div 
                        onMouseDown={(e) => startResize(e, 'title')}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sidesi-500/40 active:bg-sidesi-500 z-10 border-r border-slate-300 dark:border-slate-700/60"
                      />
                    </th>
                    <th className="relative px-4 py-3 align-middle" style={{ width: colWidths.login }}>
                      <div className="truncate">Login User</div>
                      <div 
                        onMouseDown={(e) => startResize(e, 'login')}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sidesi-500/40 active:bg-sidesi-500 z-10 border-r border-slate-300 dark:border-slate-700/60"
                      />
                    </th>
                    <th className="relative px-4 py-3 align-middle" style={{ width: colWidths.password }}>
                      <div className="truncate">Parolă</div>
                      <div 
                        onMouseDown={(e) => startResize(e, 'password')}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sidesi-500/40 active:bg-sidesi-500 z-10 border-r border-slate-300 dark:border-slate-700/60"
                      />
                    </th>
                    <th className="relative px-4 py-3 align-middle" style={{ width: colWidths.email }}>
                      <div className="truncate">Asociat Email</div>
                      <div 
                        onMouseDown={(e) => startResize(e, 'email')}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sidesi-500/40 active:bg-sidesi-500 z-10 border-r border-slate-300 dark:border-slate-700/60"
                      />
                    </th>
                    <th className="relative px-4 py-3 align-middle" style={{ width: colWidths.phone }}>
                      <div className="truncate">Telefon</div>
                      <div 
                        onMouseDown={(e) => startResize(e, 'phone')}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sidesi-500/40 active:bg-sidesi-500 z-10 border-r border-slate-300 dark:border-slate-700/60"
                      />
                    </th>
                    <th className="relative px-4 py-3 align-middle" style={{ width: colWidths.createdBy }}>
                      <div className="truncate">Creat de</div>
                      <div 
                        onMouseDown={(e) => startResize(e, 'createdBy')}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sidesi-500/40 active:bg-sidesi-500 z-10 border-r border-slate-300 dark:border-slate-700/60"
                      />
                    </th>
                    <th className="relative px-5 py-3 align-middle text-right" style={{ width: colWidths.actions }}>
                      <div className="truncate">Acțiuni</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/20 font-medium">
                  {items.map((item) => {
                    const isRevealed = !!revealedPasswords[item.id];
                    const passwordValue = isRevealed ? revealedPasswords[item.id] : item.masked_password;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors h-14 text-slate-800 dark:text-slate-200">
                        <td
                          className="px-5 font-bold text-sidesi-500 dark:text-sidesi-400 truncate cursor-pointer hover:text-sidesi-400 dark:hover:text-sidesi-300 hover:underline underline-offset-2 transition-colors"
                          style={{ maxWidth: colWidths.organization }}
                          title={`${item.organization_detail?.name} — click pentru detalii`}
                          onClick={() => { setViewItem(item); setViewRevealed(false); }}
                        >
                          {item.organization_detail?.name}
                        </td>
                        <td className="px-4 truncate font-semibold dark:text-white" style={{ maxWidth: colWidths.title }} title={item.title}>
                          {item.title}
                        </td>
                        <td className="px-4 font-mono select-all truncate" style={{ maxWidth: colWidths.login }} title={item.login_username}>
                          {item.login_username}
                        </td>
                        <td className="px-4 font-mono select-all text-xs tracking-wide truncate" style={{ maxWidth: colWidths.password }}>
                          <span className={`px-2 py-1 rounded-md ${isRevealed ? 'bg-amber-500/10 text-amber-500 font-bold border border-amber-500/10' : 'text-slate-400'}`}>
                            {passwordValue}
                          </span>
                        </td>
                        <td className="px-4 text-slate-500 dark:text-slate-400 truncate" style={{ maxWidth: colWidths.email }} title={item.associated_email || undefined}>
                          {item.associated_email || '—'}
                        </td>
                        <td className="px-4 text-slate-500 dark:text-slate-400 truncate" style={{ maxWidth: colWidths.phone }} title={item.associated_phone || undefined}>
                          {item.associated_phone || '—'}
                        </td>
                        <td className="px-4 text-slate-500 capitalize truncate" style={{ maxWidth: colWidths.createdBy }} title={item.created_by_user}>{item.created_by_user}</td>
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
            <div className="flex items-center justify-between p-4 glass-panel rounded-2xl border border-slate-200/50 dark:border-slate-800/40 text-xs font-semibold flex-shrink-0">
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
        <div className="text-center py-16 glass-panel rounded-2xl space-y-3 flex-shrink-0">
          <Key className="w-12 h-12 mx-auto text-slate-400 stroke-1" />
          <h3 className="font-bold text-slate-900 dark:text-white text-md">Nicio parolă înregistrată</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Încearcă să modifici filtrele sau adaugă o parolă nouă.</p>
        </div>
      )}

      {/* ── Detail View Popup ──────────────────────────────────────────── */}
      {viewItem && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
            onClick={() => setViewItem(null)}
          />
          {/* Card */}
          <div className="relative w-full max-w-md glass-panel rounded-2xl z-10 overflow-hidden shadow-2xl border border-slate-200/30 dark:border-sidesi-500/20">
            {/* Header gradient bar */}
            <div className="bg-gradient-to-r from-sidesi-600 to-sidesi-400 px-6 py-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur-sm">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white leading-tight">{viewItem.organization_detail?.name}</h3>
                  {viewItem.organization_detail?.code && (
                    <p className="text-sidesi-200 text-[11px] font-medium mt-0.5 flex items-center gap-1">
                      <Hash className="w-3 h-3" />{viewItem.organization_detail.code}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setViewItem(null)}
                className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-3 text-xs">
              {/* Title */}
              {viewItem.title && (
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex-shrink-0">
                    <Key className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Redenumit</p>
                    <p className="font-semibold text-slate-800 dark:text-white truncate">{viewItem.title}</p>
                  </div>
                </div>
              )}

              {/* Login */}
              <button
                onClick={() => handleViewCopy(viewItem.login_username, 'login')}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group text-left"
                title="Click pentru a copia username-ul"
              >
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-500 flex-shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Login Username</p>
                  <p className="font-mono font-bold text-slate-800 dark:text-white truncate">{viewItem.login_username}</p>
                </div>
                <div className={`flex-shrink-0 transition-colors ${
                  copiedField === 'login' ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600 group-hover:text-cyan-400'
                }`}>
                  {copiedField === 'login' ? <Check className="w-4 h-4" /> : <ClipboardCopy className="w-4 h-4" />}
                </div>
              </button>

              {/* Password */}
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/40">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 flex-shrink-0">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Parolă</p>
                  <p className={`font-mono font-bold truncate ${
                    viewRevealed ? 'text-amber-500 text-sm tracking-wide' : 'text-slate-400 text-base'
                  }`}>
                    {viewRevealed
                      ? (revealedPasswords[viewItem.id] || '—')
                      : (viewItem.masked_password || '••••••••')
                    }
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {hasPermission('vault:reveal') && (
                    <button
                      onClick={handleViewReveal}
                      className="p-1.5 rounded-lg hover:bg-amber-500/10 text-slate-400 hover:text-amber-500 transition-colors"
                      title={viewRevealed ? 'Ascunde parola' : 'Afișează parola'}
                    >
                      {viewRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                  {hasPermission('vault:copy') && viewRevealed && (
                    <button
                      onClick={() => handleViewCopy(revealedPasswords[viewItem.id], 'password')}
                      className={`p-1.5 rounded-lg transition-colors ${
                        copiedField === 'password' ? 'text-emerald-500' : 'text-slate-400 hover:text-cyan-500 hover:bg-cyan-500/10'
                      }`}
                      title="Copiază parola"
                    >
                      {copiedField === 'password' ? <Check className="w-4 h-4" /> : <ClipboardCopy className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Email */}
              {viewItem.associated_email && (
                <button
                  onClick={() => handleViewCopy(viewItem.associated_email, 'email')}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group text-left"
                  title="Click pentru a copia emailul"
                >
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 flex-shrink-0">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Email Asociat</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">{viewItem.associated_email}</p>
                  </div>
                  <div className={`flex-shrink-0 transition-colors ${
                    copiedField === 'email' ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600 group-hover:text-blue-400'
                  }`}>
                    {copiedField === 'email' ? <Check className="w-4 h-4" /> : <ClipboardCopy className="w-4 h-4" />}
                  </div>
                </button>
              )}

              {/* Phone */}
              {viewItem.associated_phone && (
                <button
                  onClick={() => handleViewCopy(viewItem.associated_phone, 'phone')}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group text-left"
                  title="Click pentru a copia telefonul"
                >
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 flex-shrink-0">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Telefon Asociat</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">{viewItem.associated_phone}</p>
                  </div>
                  <div className={`flex-shrink-0 transition-colors ${
                    copiedField === 'phone' ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600 group-hover:text-emerald-400'
                  }`}>
                    {copiedField === 'phone' ? <Check className="w-4 h-4" /> : <ClipboardCopy className="w-4 h-4" />}
                  </div>
                </button>
              )}

              {/* Divider */}
              <div className="border-t border-slate-200/60 dark:border-slate-800/60 pt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                    <User className="w-3 h-3" />Creat de
                  </p>
                  <p className="text-slate-700 dark:text-slate-300 font-semibold capitalize">{viewItem.created_by_user || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />Modificat de
                  </p>
                  <p className="text-slate-700 dark:text-slate-300 font-semibold capitalize">{viewItem.modified_by_user || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />Data creării
                  </p>
                  <p className="text-slate-700 dark:text-slate-300 font-semibold">{viewItem.created_at_formatted}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />Ultima modificare
                  </p>
                  <p className="text-slate-700 dark:text-slate-300 font-semibold">{viewItem.updated_at_formatted}</p>
                </div>
                {viewItem.last_accessed_formatted && (
                  <div className="col-span-2">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                      <Eye className="w-3 h-3" />Ultimul acces (dezvăluire parolă)
                    </p>
                    <p className="text-slate-700 dark:text-slate-300 font-semibold">{viewItem.last_accessed_formatted}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-5 pb-5 flex gap-2 pt-1">
              {hasPermission('vault:edit') && (
                <button
                  onClick={() => { setViewItem(null); openEdit(viewItem); }}
                  className="flex-1 glass-button-secondary py-2 text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Editează
                </button>
              )}
              <button
                onClick={() => setViewItem(null)}
                className="flex-1 glass-button-primary py-2 text-xs font-bold flex items-center justify-center gap-2"
              >
                <X className="w-3.5 h-3.5" />
                Închide
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Creation/Edit Popup Modal */}
      {isFormOpen && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
          <div className="relative w-full max-w-lg glass-panel p-6 rounded-2xl max-h-[90vh] overflow-y-auto z-10 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-850">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingItem ? 'Editează Credențial Server' : 'Adaugă Parolă Nouă în Vault'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-600 dark:text-slate-400">Organizație*</label>
                  <input
                    type="text"
                    value={formOrg}
                    onChange={(e) => setFormOrg(e.target.value)}
                    placeholder="ex: SIDESI"
                    className="w-full glass-input text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 dark:text-slate-400">Redenumita (Opțional)</label>
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
                  <label className="text-slate-600 dark:text-slate-400">Login Username*</label>
                  <input
                    type="text"
                    value={formLogin}
                    onChange={(e) => setFormLogin(e.target.value)}
                    placeholder="ex: 218_ccl"
                    className="w-full glass-input text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 dark:text-slate-400">Asociat Email (Opțional)</label>
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
                  <label className="text-slate-600 dark:text-slate-400">Număr telefon asociat (Opțional)</label>
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
              <div className="space-y-1.5 pt-2 border-t border-slate-200/50 dark:border-slate-800/40">
                <div className="flex justify-between items-center">
                  <label className="text-slate-600 dark:text-slate-400">
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
              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-850">
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
      , document.body)}

      {/* Excel Import Modal */}
      {isImportOpen && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/60 backdrop-blur-sm" onClick={() => { setIsImportOpen(false); setImportFile(null); setImportResult(null); }} />
          <div className="relative w-full max-w-md glass-panel p-6 rounded-2xl z-10 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-850">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Import Credențiale din Excel</h3>
              <button
                onClick={() => {
                  setIsImportOpen(false);
                  setImportFile(null);
                  setImportResult(null);
                }}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold">
              {importResult ? (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-100 dark:bg-slate-900/40 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 space-y-3">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Rezumat Import</h4>
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
                      <div className="text-slate-600 dark:text-slate-400 flex justify-between px-1">
                        <span>Detalii erori/omiteri:</span>
                        <span>{importResult.errors.length} linii</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-350 font-mono text-[10px] leading-normal space-y-1.5 scrollbar-thin">
                        {importResult.errors.slice(0, 100).map((err, i) => (
                          <div key={i} className="border-b border-slate-200/40 dark:border-slate-900/40 pb-1.5 last:border-0 last:pb-0">{err}</div>
                        ))}
                        {importResult.errors.length > 100 && (
                          <div className="text-slate-400 dark:text-slate-500 text-center pt-1 font-sans">
                            Afișate primele 100 de erori. Consultați logurile serverului pentru restul.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-850">
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

                  <div className="flex justify-end gap-2 border-t border-slate-200 dark:border-slate-850 pt-3">
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
      , document.body)}

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
