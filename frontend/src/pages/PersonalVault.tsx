import React, { useEffect, useState } from 'react';
import { 
  Plus, Search, Star, Shield, ShieldAlert, Key, 
  FileText, Link as LinkIcon, CreditCard, ClipboardCopy, 
  Eye, EyeOff, Trash2, X, ExternalLink,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { usePersonalVaultStore } from '@/context/personalVaultStore';
import { useToastStore } from '@/context/toastStore';
import { useAuthStore } from '@/context/authStore';
import { PersonalVaultItem } from '@/types';
import TableSkeleton from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import PasswordGenerator from '@/components/shared/PasswordGenerator';

// Clipboard helper with HTTP fallback
const copyToClipboard = (text: string): Promise<void> => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
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

export const PersonalVault: React.FC = () => {
  const { 
    items, totalCount, isLoading, error, fetchItems, createItem, 
    updateItem, deleteItem, revealPassword 
  } = usePersonalVaultStore();

  const addToast = useToastStore((state) => state.addToast);
  const currentUser = useAuthStore((state) => state.user);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
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

  // Decrypted values cache
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});

  // Modals Toggles
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PersonalVaultItem | null>(null);

  // Form values
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<'login' | 'note' | 'link' | 'card'>('login');
  const [formLogin, setFormLogin] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formFavorite, setFormFavorite] = useState(false);
  const [showGen, setShowGen] = useState(false);

  // Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    fetchItems(search, selectedCategory, favoritesOnly, currentPage);
  }, [search, selectedCategory, favoritesOnly, currentPage]);

  const handleReveal = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent card opening
    if (revealedPasswords[id]) {
      const next = { ...revealedPasswords };
      delete next[id];
      setRevealedPasswords(next);
      return;
    }

    const plain = await revealPassword(id);
    if (plain) {
      setRevealedPasswords(prev => ({ ...prev, [id]: plain }));
      addToast('Parola personală a fost afișată.', 'info');
      // Auto hide after 8s
      setTimeout(() => {
        setRevealedPasswords(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 8000);
    }
  };

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const plain = revealedPasswords[id];
    if (!plain) {
      addToast('Dezvăluiți parola mai întâi înainte de a o copia.', 'warning');
      return;
    }
    copyToClipboard(plain)
      .then(() => addToast('Copiat în clipboard!', 'success'))
      .catch(() => addToast('Copierea a eșuat. Verificați permisiunile browserului.', 'error'));
  };

  const handleToggleFavorite = async (item: PersonalVaultItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await updateItem(item.id, { is_favorite: !item.is_favorite });
    if (success) {
      fetchItems(search, selectedCategory, favoritesOnly, currentPage);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle) {
      addToast('Titlul este obligatoriu.', 'warning');
      return;
    }

    const payload = {
      title: formTitle,
      category: formCategory,
      login_username: formLogin,
      url: formUrl,
      notes: formNotes,
      is_favorite: formFavorite,
      ...(formPassword ? { password: formPassword } : {})
    };

    let success = false;
    if (editingItem) {
      success = await updateItem(editingItem.id, payload);
      if (success) addToast('Actualizat cu succes!', 'success');
    } else {
      success = await createItem(payload);
      if (success) addToast('Adăugat cu succes în seiful personal!', 'success');
    }

    if (success) {
      setIsFormOpen(false);
      resetForm();
      fetchItems(search, selectedCategory, favoritesOnly, currentPage);
    }
  };

  const openEdit = (item: PersonalVaultItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItem(item);
    setFormTitle(item.title);
    setFormCategory(item.category);
    setFormLogin(item.login_username || '');
    setFormUrl(item.url || '');
    setFormNotes(item.notes || '');
    setFormFavorite(item.is_favorite);
    setFormPassword('');
    setIsFormOpen(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormCategory('login');
    setFormLogin('');
    setFormPassword('');
    setFormUrl('');
    setFormNotes('');
    setFormFavorite(false);
    setShowGen(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const success = await deleteItem(deleteTarget);
    if (success) {
      addToast('Elementul a fost șters din seiful tău.', 'success');
      setDeleteTarget(null);
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'login': return <Key className="w-4 h-4 text-sidesi-500" />;
      case 'note': return <FileText className="w-4 h-4 text-emerald-500" />;
      case 'link': return <LinkIcon className="w-4 h-4 text-cyan-500" />;
      case 'card': return <CreditCard className="w-4 h-4 text-purple-500" />;
      default: return <Shield className="w-4 h-4 text-slate-500" />;
    }
  };

  const categories = [
    { value: '', label: 'Toate elementele' },
    { value: 'login', label: 'Logins / Conturi' },
    { value: 'note', label: 'Note Sigure' },
    { value: 'link', label: 'Link-uri Rapide' },
    { value: 'card', label: 'Carduri Bancare' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight dark:text-white">
            Personal Vault
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Spațiul tău personal criptat. Nimeni altcineva (inclusiv administratorii) nu poate citi aceste parole.
          </p>
        </div>

        <button
          onClick={() => { resetForm(); setIsFormOpen(true); }}
          className="glass-button-primary py-2 text-xs flex items-center gap-2 self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Adaugă Secret</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-md">
        {/* Category switcher */}
        <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
          {categories.map(cat => (
            <button
              key={cat.value}
              onClick={() => {
                setSelectedCategory(cat.value);
                setCurrentPage(1);
              }}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold active:scale-95 transition-all duration-150 ${
                selectedCategory === cat.value
                  ? 'bg-sidesi-500 text-white shadow shadow-sidesi-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search & Favorites Toggle */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-grow justify-end">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Caută în secrete..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full glass-input pl-9 text-xs"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-slate-400 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(e) => {
                setFavoritesOnly(e.target.checked);
                setCurrentPage(1);
              }}
              className="rounded border-slate-700 accent-sidesi-500 text-white w-4.5 h-4.5"
            />
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>Doar Favorite</span>
          </label>
        </div>
      </div>

      {/* Grid List rendering */}
      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <div className="p-8 text-center glass-panel rounded-2xl space-y-2">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="font-bold text-white text-md">Eroare de securitate</h3>
          <p className="text-xs text-slate-400">{error}</p>
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const isRevealed = !!revealedPasswords[item.id];
              const displayPass = isRevealed ? revealedPasswords[item.id] : item.masked_password;

              return (
                <div
                  key={item.id}
                  onClick={(e) => openEdit(item, e)}
                  className="glass-panel p-5 rounded-2xl glass-panel-hover flex flex-col justify-between h-48 cursor-pointer select-none"
                >
                  <div className="space-y-3">
                    {/* Top Bar */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/40">
                          {getCategoryIcon(item.category)}
                        </span>
                        {currentUser?.role_detail?.name === 'Super Admin' && item.username_display && (
                          <span className="text-[10px] font-bold text-sidesi-400 bg-sidesi-500/10 border border-sidesi-500/20 px-2 py-0.5 rounded-full capitalize">
                            {item.username_display}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleToggleFavorite(item, e)}
                        className="p-1 text-slate-400 hover:text-amber-500 transition-colors"
                      >
                        <Star className={`w-4.5 h-4.5 ${item.is_favorite ? 'text-amber-500 fill-amber-500' : ''}`} />
                      </button>
                    </div>

                    {/* Title & info details */}
                    <div className="space-y-1">
                      <h3 className="font-bold dark:text-white text-sm truncate" title={item.title}>
                        {item.title}
                      </h3>
                      <p className="text-[10px] text-slate-500 truncate font-mono">
                        {item.login_username || item.url || 'Personal note'}
                      </p>
                    </div>
                  </div>

                  {/* Footer credentials controls */}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-200/40 dark:border-slate-800/20">
                    {item.masked_password ? (
                      <div className="font-mono text-xs tracking-wider flex items-center gap-1 min-w-0 flex-grow pr-2">
                        <span className={`px-2 py-0.5 rounded truncate ${isRevealed ? 'bg-amber-500/10 text-amber-500 font-bold' : 'text-slate-400'}`}>
                          {displayPass}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        NOTE SECURE
                      </span>
                    )}

                    <div className="flex gap-1.5 flex-shrink-0">
                      {item.masked_password && (
                        <>
                          <button
                            onClick={(e) => handleReveal(item.id, e)}
                            className="p-2 text-slate-400 hover:text-amber-400 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Afișează parola"
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={(e) => handleCopy(item.id, e)}
                            disabled={!revealedPasswords[item.id]}
                            className={`p-2 rounded-lg transition-colors ${
                              revealedPasswords[item.id]
                                ? 'text-slate-400 hover:text-cyan-400 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                : 'text-slate-600 opacity-40 cursor-not-allowed'
                            }`}
                            title={revealedPasswords[item.id] ? 'Copiază parola' : 'Dezvăluiți parola mai întâi'}
                          >
                            <ClipboardCopy className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 text-slate-400 hover:text-sidesi-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Deschide link-ul"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(item.id); }}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Șterge"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
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
        <div className="text-center py-20 glass-panel rounded-2xl space-y-3">
          <Shield className="w-12 h-12 mx-auto text-slate-400 stroke-1 animate-pulse-subtle" />
          <h3 className="font-bold text-white text-md">Seiful tău personal este gol</h3>
          <p className="text-xs text-slate-400">Păstrează în siguranță coduri PIN, note secrete sau parole de acces privat.</p>
        </div>
      )}

      {/* Create / Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
          <div className="relative w-full max-w-lg glass-panel p-6 rounded-2xl z-10 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-850">
              <h3 className="text-lg font-bold text-white">
                {editingItem ? 'Editează Secret Personal' : 'Adaugă un Nou Secret Personal'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400">Titlu Secret*</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="ex: Cont Personal GitHub sau PIN Card BCR"
                    className="w-full glass-input text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Categorie*</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full glass-input text-xs"
                  >
                    <option value="login">Logins / Autentificare</option>
                    <option value="note">Note Sigure</option>
                    <option value="link">Link-uri Rapide</option>
                    <option value="card">Carduri Bancare</option>
                  </select>
                </div>
              </div>

              {/* Conditional fields based on category */}
              {formCategory !== 'note' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-400">
                      {formCategory === 'card' ? 'Număr Card' : 'Nume Utilizator / Login'}
                    </label>
                    <input
                      type="text"
                      value={formLogin}
                      onChange={(e) => setFormLogin(e.target.value)}
                      placeholder={formCategory === 'card' ? "ex: 4111 2222 3333 4444" : "ex: stefan_personal"}
                      className="w-full glass-input text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">Link URL / Adresă Web</label>
                    <input
                      type="url"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="ex: https://github.com/login"
                      className="w-full glass-input text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Password wrapper */}
              {formCategory !== 'link' && formCategory !== 'note' && (
                <div className="space-y-1.5 pt-2 border-t border-slate-800/40">
                  <div className="flex justify-between items-center">
                    <label className="text-slate-400">
                      {formCategory === 'card' ? 'Cod PIN / CVV' : (editingItem ? 'Schimbă Parola (lasă gol pentru a păstra)' : 'Parolă Secretă*')}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowGen(!showGen)}
                      className="text-sidesi-500 hover:text-sidesi-400 text-[10px] font-bold uppercase tracking-wider"
                    >
                      {showGen ? 'Ascunde Generator' : 'Generează Parolă'}
                    </button>
                  </div>
                  
                  {!showGen && (
                    <input
                      type="password"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={formCategory === 'card' ? "ex: 123 sau 9821" : (editingItem ? "Noua parolă personală..." : "Parolă...")}
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
              )}

              {/* Note text field */}
              <div className="space-y-1 pt-2 border-t border-slate-800/40">
                <label className="text-slate-400">
                  {formCategory === 'note' ? 'Conținut Notă Securizată*' : 'Observații / Note suplimentare'}
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder={formCategory === 'note' ? "Scrie notele sigure aici (ex: răspunsuri la întrebări de securitate, chei API private)..." : "Observații private..."}
                  rows={4}
                  className="w-full glass-input text-xs leading-normal"
                />
              </div>

              {/* Favorite selector */}
              <div className="flex items-center gap-2 select-none pt-1">
                <input
                  type="checkbox"
                  id="formFav"
                  checked={formFavorite}
                  onChange={(e) => setFormFavorite(e.target.checked)}
                  className="rounded border-slate-800 text-white accent-sidesi-500 w-4.5 h-4.5 cursor-pointer"
                />
                <label htmlFor="formFav" className="text-slate-350 cursor-pointer flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span>Marchează ca Favorit</span>
                </label>
              </div>

              {/* Footer buttons */}
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
                  Salvează Secretul
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete personal prompt */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Șterge Secret Personal"
        message="Sunteți sigur că doriți să ștergeți acest secret din seiful personal? Această acțiune este ireversibilă și nu va mai putea fi recuperată."
        confirmLabel="Șterge permanent"
        type="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
export default PersonalVault;
