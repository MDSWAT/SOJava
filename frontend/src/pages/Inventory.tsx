import React, { useEffect, useState, useCallback } from 'react';
import {
  Package, Plus, Search, User, Edit, Trash2, X, Upload,
  Hash, ChevronLeft, ChevronRight, AlertTriangle, ImageOff,
  Boxes, ClipboardList, UserCheck, FileDown, Image as ImageIcon,
  FileSpreadsheet, FileText as FilePdf, Eye, Calendar, Info
} from 'lucide-react';
import { useAuthStore } from '@/context/authStore';
import { useToastStore } from '@/context/toastStore';
import TableSkeleton from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import api from '@/services/api';

interface UserOption {
  id: string;
  username: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface InventoryItem {
  id: string;
  name: string;
  inventory_number: string | null;
  description: string | null;
  quantity: number;
  assigned_to: string;
  assigned_to_detail: UserOption;
  image: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

// ─── API helpers ────────────────────────────────────────────────────────────
async function fetchItems(search = '', assignedTo = '', page = 1): Promise<{ results: InventoryItem[]; count: number }> {
  const params: any = { page };
  if (search) params.search = search;
  if (assignedTo) params.assigned_to = assignedTo;
  const res = await api.get('/inventory/items/', { params });
  return res.data;
}

async function fetchUsers(): Promise<UserOption[]> {
  const res = await api.get('/auth/users/', { params: { page_size: 500 } });
  return res.data.results || res.data;
}

async function createItem(formData: FormData): Promise<InventoryItem> {
  const res = await api.post('/inventory/items/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
}

async function updateItem(id: string, formData: FormData): Promise<InventoryItem> {
  const res = await api.patch(`/inventory/items/${id}/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
}

async function deleteItem(id: string): Promise<void> {
  await api.delete(`/inventory/items/${id}/`);
}

// ─── Image Preview ──────────────────────────────────────────────────────────
const ItemImage: React.FC<{ url: string | null; name: string; size?: 'sm' | 'lg' | 'full' }> = ({ url, name, size = 'sm' }) => {
  const [failed, setFailed] = useState(false);
  const sizeClass = size === 'full' ? 'w-full h-64' : size === 'lg' ? 'w-full h-48' : 'w-12 h-12';

  if (!url || failed) {
    return (
      <div className={`${sizeClass} rounded-xl bg-slate-800/60 flex flex-col items-center justify-center border border-slate-700/40 flex-shrink-0 gap-1`}>
        <ImageOff className="w-5 h-5 text-slate-600" />
        {size === 'full' && <span className="text-[10px] text-slate-600">Fără fotografie</span>}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={name}
      className={`${sizeClass} object-cover rounded-xl border border-slate-700/30 flex-shrink-0 bg-slate-900`}
      onError={() => setFailed(true)}
    />
  );
};

// ─── Detail Modal ─────────────────────────────────────────────────────────────
const ItemDetailModal: React.FC<{
  item: InventoryItem;
  onClose: () => void;
  onEdit: (item: InventoryItem) => void;
  canManage: boolean;
}> = ({ item, onClose, onEdit, canManage }) => {
  const userName = item.assigned_to_detail?.full_name?.trim() || item.assigned_to_detail?.username || '—';
  const initials = userName.charAt(0).toUpperCase();

  const formatDate = (ds: string) => {
    try {
      return new Date(ds).toLocaleString('ro-RO', { dateStyle: 'long', timeStyle: 'short' });
    } catch { return ds; }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl glass-panel rounded-2xl z-10 overflow-hidden shadow-2xl">

        {/* ── Photo header ── */}
        <div className="relative">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.name}
              className="w-full h-56 object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-44 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center gap-2 border-b border-slate-800/60">
              <Package className="w-16 h-16 text-slate-700 stroke-1" />
              <span className="text-xs text-slate-600">Nicio fotografie atașată</span>
            </div>
          )}
          {/* Gradient overlay at bottom of image */}
          {item.image_url && (
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-900/90 to-transparent" />
          )}
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
          {/* Inventory number badge */}
          {item.inventory_number && (
            <div className="absolute top-3 left-3 px-2 py-1 bg-sidesi-600/80 backdrop-blur-sm border border-sidesi-500/40 rounded-lg text-xs font-mono font-bold text-white">
              #{item.inventory_number}
            </div>
          )}
        </div>

        {/* ── Details body ── */}
        <div className="p-5 space-y-4">
          {/* Name + Quantity */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white">{item.name}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {item.inventory_number ? `Nr. Inventar: ${item.inventory_number}` : 'Fără număr de inventar'}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sidesi-500/10 border border-sidesi-500/20 text-sidesi-300 font-black text-lg">
                {item.quantity}
                <span className="text-xs font-normal text-sidesi-400">buc.</span>
              </span>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Assigned user */}
            <div className="col-span-2 p-3 bg-slate-900/50 rounded-xl border border-slate-800/40 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sidesi-500 to-cyan-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {initials}
              </div>
              <div>
                <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Responsabil / Deținător</p>
                <p className="text-sm font-bold text-white capitalize">{userName}</p>
                {item.assigned_to_detail?.email && (
                  <p className="text-[10px] text-slate-500">{item.assigned_to_detail.email}</p>
                )}
              </div>
            </div>

            {/* Created at */}
            <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/30">
              <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider flex items-center gap-1 mb-1">
                <Calendar className="w-3 h-3" /> Dată Alocare
              </p>
              <p className="text-xs font-semibold text-slate-200">{formatDate(item.created_at)}</p>
            </div>

            {/* Updated at */}
            <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/30">
              <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider flex items-center gap-1 mb-1">
                <Calendar className="w-3 h-3" /> Ultima Modificare
              </p>
              <p className="text-xs font-semibold text-slate-200">{formatDate(item.updated_at)}</p>
            </div>
          </div>

          {/* Description */}
          {item.description && (
            <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/30">
              <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider flex items-center gap-1 mb-2">
                <Info className="w-3 h-3" /> Descriere / Observații
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">{item.description}</p>
            </div>
          )}

          {/* Actions */}
          {canManage && (
            <div className="flex justify-end gap-2 pt-1 border-t border-slate-800/40">
              <button
                onClick={() => { onClose(); onEdit(item); }}
                className="glass-button-primary py-2 text-xs flex items-center gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" />
                Editează Obiect
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Export Format Selector ───────────────────────────────────────────────────
type ExportFormat = 'excel' | 'excel_with_images' | 'pdf' | 'pdf_with_images';

interface ExportOption {
  id: ExportFormat;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  color: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'excel',
    icon: <FileSpreadsheet className="w-5 h-5" />,
    label: 'Excel — Date',
    sublabel: 'Tabel Excel compact, fără imagini. Ideal pentru editare și filtrare.',
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    id: 'excel_with_images',
    icon: <FileSpreadsheet className="w-5 h-5" />,
    label: 'Excel — Cu Fotografii',
    sublabel: 'Tabel Excel cu imaginile obiectelor inserate în celule.',
    color: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
  },
  {
    id: 'pdf',
    icon: <FilePdf className="w-5 h-5" />,
    label: 'PDF — Raport',
    sublabel: 'Raport PDF elegant, pregătit pentru imprimare. Fără imagini.',
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  },
  {
    id: 'pdf_with_images',
    icon: <FilePdf className="w-5 h-5" />,
    label: 'PDF — Cu Fotografii',
    sublabel: 'Raport PDF complet cu imaginile obiectelor. Fișier mai mare.',
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  },
];


// ─── Main Page ───────────────────────────────────────────────────────────────
export const InventoryPage: React.FC = () => {
  const { hasPermission } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);

  // Data
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & pagination
  const [search, setSearch] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Detail modal
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);

  // Form modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Export state
  const [exportUser, setExportUser] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel');

  // Form fields
  const [formName, setFormName] = useState('');
  const [formInvNumber, setFormInvNumber] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formQuantity, setFormQuantity] = useState(1);
  const [formAssignedTo, setFormAssignedTo] = useState('');
  const [formImage, setFormImage] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string | null>(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchItems(search, filterUser, currentPage);
      setItems(data.results);
      setTotalCount(data.count);
    } catch (e: any) {
      setError(e.message || 'Eroare necunoscută.');
    } finally {
      setIsLoading(false);
    }
  }, [search, filterUser, currentPage]);

  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { fetchUsers().then(setUsers).catch(() => {}); }, []);

  // ── Form helpers ───────────────────────────────────────────────────────────
  const resetForm = () => {
    setEditingItem(null);
    setFormName('');
    setFormInvNumber('');
    setFormDescription('');
    setFormQuantity(1);
    setFormAssignedTo('');
    setFormImage(null);
    setFormImagePreview(null);
  };

  const openCreate = () => { resetForm(); setIsFormOpen(true); };

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormInvNumber(item.inventory_number || '');
    setFormDescription(item.description || '');
    setFormQuantity(item.quantity);
    setFormAssignedTo(item.assigned_to);
    setFormImage(null);
    setFormImagePreview(item.image_url || null);
    setIsFormOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormImage(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setFormImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFormImagePreview(editingItem?.image_url || null);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formAssignedTo) {
      addToast('Completați câmpurile obligatorii: Denumire și Responsabil.', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', formName.trim());
      fd.append('quantity', String(formQuantity));
      fd.append('assigned_to', formAssignedTo);
      if (formInvNumber.trim()) fd.append('inventory_number', formInvNumber.trim());
      if (formDescription.trim()) fd.append('description', formDescription.trim());
      if (formImage) fd.append('image', formImage);

      if (editingItem) {
        await updateItem(editingItem.id, fd);
        addToast('Obiect actualizat cu succes!', 'success');
      } else {
        await createItem(fd);
        addToast('Obiect adăugat în inventar!', 'success');
      }
      setIsFormOpen(false);
      resetForm();
      loadItems();
    } catch (e: any) {
      addToast(`Eroare: ${e.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteItem(deleteTarget);
      addToast('Obiectul a fost șters din inventar.', 'success');
      setDeleteTarget(null);
      loadItems();
    } catch {
      addToast('Ștergerea a eșuat.', 'error');
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExporting(true);
    try {
      const isPdf         = exportFormat.startsWith('pdf');
      const includeImages = exportFormat.endsWith('_with_images');
      const endpoint      = isPdf ? '/inventory/items/export-pdf/' : '/inventory/items/export/';
      const mimeType      = isPdf
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const extension     = isPdf ? 'pdf' : 'xlsx';

      const params: any = { include_images: includeImages };
      if (exportUser) params.assigned_to = exportUser;

      const response = await api.get(endpoint, { params, responseType: 'blob' });

      const blob = new Blob([response.data as BlobPart], { type: mimeType });
      const url  = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `Raport_Inventar_SIDESI_${new Date().toISOString().slice(0, 10)}.${extension}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      addToast(`Raportul ${extension.toUpperCase()} a fost descărcat cu succes!`, 'success');
      setIsExportOpen(false);
    } catch (e: any) {
      addToast(`Eroare la export: ${e.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const itemsWithInvNumber = items.filter((i) => i.inventory_number).length;
  const userItemCounts: Record<string, { name: string; count: number }> = {};
  items.forEach((i) => {
    const uid = i.assigned_to;
    if (!userItemCounts[uid]) {
      userItemCounts[uid] = { name: i.assigned_to_detail?.full_name || i.assigned_to_detail?.username, count: 0 };
    }
    userItemCounts[uid].count += i.quantity;
  });
  const topUser = Object.values(userItemCounts).sort((a, b) => b.count - a.count)[0];

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 4) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
      if (currentPage < totalPages - 3) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col space-y-4 animate-fade-in">

      {/* ── Title + Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight dark:text-white flex items-center gap-2">
            <Package className="w-7 h-7 text-sidesi-400" />
            Inventar
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Evidența obiectelor alocate personalului — mobilier, echipamente IT, periferice.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setExportUser(filterUser); setExportFormat('excel'); setIsExportOpen(true); }}
            className="glass-button-secondary py-2 text-xs flex items-center gap-2"
          >
            <FileDown className="w-4 h-4" />
            <span>Export Raport</span>
          </button>
          {hasPermission('inventory:manage') && (
            <button onClick={openCreate} className="glass-button-primary py-2 text-xs flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>Adaugă Obiect</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-shrink-0">
        <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sidesi-500/10 border border-sidesi-500/20 flex items-center justify-center flex-shrink-0">
            <Boxes className="w-5 h-5 text-sidesi-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Total Obiecte</p>
            <p className="text-xl font-black text-white">{totalCount}</p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Cu Nr. Inventar</p>
            <p className="text-xl font-black text-white">{itemsWithInvNumber}</p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <UserCheck className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Top Responsabil</p>
            <p className="text-sm font-bold text-white truncate max-w-[160px]">{topUser?.name || '—'}</p>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="glass-panel p-3 rounded-xl flex flex-col sm:flex-row gap-3 flex-shrink-0">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Caută după denumire, număr de inventar, descriere..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full glass-input pl-9 text-sm"
          />
        </div>
        <select
          value={filterUser}
          onChange={(e) => { setFilterUser(e.target.value); setCurrentPage(1); }}
          className="glass-input text-sm min-w-[200px]"
        >
          <option value="">Toți utilizatorii</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name || u.username} ({u.username})
            </option>
          ))}
        </select>
      </div>

      {/* ── Main Content ── */}
      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <div className="p-8 text-center glass-panel rounded-2xl space-y-2 flex-shrink-0">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="font-bold text-white">A apărut o eroare</h3>
          <p className="text-xs text-slate-400">{error}</p>
        </div>
      ) : items.length > 0 ? (
        <div className="flex flex-col space-y-4">
          <div className="glass-panel rounded-2xl overflow-hidden shadow-xl border border-slate-200/50 dark:border-slate-800/40">
            <div className="table-scroll-hint overflow-x-auto touch-scroll">
              <table className="min-w-[700px] w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/50 dark:bg-slate-900/60 border-b border-slate-200/50 dark:border-slate-800/40 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider h-11 select-none">
                    <th className="px-4 py-3 w-14">Poză</th>
                    <th className="px-4 py-3">Denumire Obiect</th>
                    <th className="px-4 py-3">Nr. Inventar</th>
                    <th className="px-4 py-3 text-center">Cant.</th>
                    <th className="px-4 py-3">Responsabil</th>
                    <th className="px-4 py-3">Descriere</th>
                    <th className="px-4 py-3 text-right">Acțiuni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/20 font-medium">
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setDetailItem(item)}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors text-slate-800 dark:text-slate-200 cursor-pointer group"
                    >
                      <td className="px-4 py-2">
                        <ItemImage url={item.image_url} name={item.name} size="sm" />
                      </td>
                      <td className="px-4 py-2 font-semibold dark:text-white">
                        <span className="group-hover:text-sidesi-400 transition-colors">{item.name}</span>
                      </td>
                      <td className="px-4 py-2 font-mono text-slate-500 dark:text-slate-400">
                        {item.inventory_number ? (
                          <span className="inline-flex items-center gap-1">
                            <Hash className="w-3 h-3 text-sidesi-400 flex-shrink-0" />
                            {item.inventory_number}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-sidesi-500/10 text-sidesi-400 font-bold border border-sidesi-500/20 text-xs">
                          {item.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sidesi-500 to-cyan-400 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                            {(item.assigned_to_detail?.full_name || item.assigned_to_detail?.username || '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-slate-700 dark:text-slate-300 font-semibold capitalize truncate max-w-[140px]">
                            {item.assigned_to_detail?.full_name || item.assigned_to_detail?.username}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={item.description || undefined}>
                        {item.description || '—'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setDetailItem(item)}
                            className="p-2 text-slate-400 hover:text-sidesi-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Detalii"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {hasPermission('inventory:manage') && (
                            <>
                              <button
                                onClick={() => openEdit(item)}
                                className="p-2 text-slate-400 hover:text-sidesi-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title="Editează"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(item.id)}
                                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title="Șterge"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 glass-panel rounded-2xl border border-slate-200/50 dark:border-slate-800/40 text-xs font-semibold flex-shrink-0">
              <div className="text-slate-500 dark:text-slate-400">
                Pagina <span className="font-bold text-white">{currentPage}</span> din <span className="font-bold text-white">{totalPages}</span> ({totalCount} înregistrări)
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="glass-button-secondary py-1.5 px-3 flex items-center gap-1 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-4 h-4" /><span>Înapoi</span>
                </button>
                {getPageNumbers().map((p, idx) =>
                  p === '...'
                    ? <span key={`ell-${idx}`} className="px-1.5 text-slate-400 select-none">...</span>
                    : (
                      <button
                        key={`page-${p}`}
                        onClick={() => setCurrentPage(p as number)}
                        className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all ${
                          p === currentPage
                            ? 'bg-sidesi-500 text-white shadow-md'
                            : 'glass-button-secondary'
                        }`}
                      >
                        {p}
                      </button>
                    )
                )}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="glass-button-secondary py-1.5 px-3 flex items-center gap-1 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span>Înainte</span><ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 glass-panel rounded-2xl space-y-3 flex-shrink-0">
          <Package className="w-16 h-16 mx-auto text-slate-600 stroke-1" />
          <h3 className="font-bold text-white text-lg">Inventarul este gol</h3>
          <p className="text-xs text-slate-400">Nu există obiecte înregistrate. Adaugă primul obiect din inventar.</p>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onEdit={openEdit}
          canManage={hasPermission('inventory:manage')}
        />
      )}

      {/* ── Create / Edit Modal ── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => { setIsFormOpen(false); resetForm(); }} />
          <div className="relative w-full max-w-xl glass-panel p-6 rounded-2xl max-h-[90vh] overflow-y-auto z-10 space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800/40">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-sidesi-400" />
                {editingItem ? 'Editează Obiect Inventar' : 'Adaugă Obiect Nou'}
              </h3>
              <button onClick={() => { setIsFormOpen(false); resetForm(); }} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-slate-400">Denumire Obiect *</label>
                  <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="ex: Masă de birou, Monitor" className="w-full glass-input text-xs" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400">Număr Inventar (Opțional)</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                    <input type="text" value={formInvNumber} onChange={(e) => setFormInvNumber(e.target.value)} placeholder="ex: INV-2024-0001" className="w-full glass-input text-xs pl-8" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-slate-400">Cantitate *</label>
                  <input type="number" min={1} value={formQuantity} onChange={(e) => setFormQuantity(Number(e.target.value))} className="w-full glass-input text-xs" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400">Responsabil / Deținător *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                    <select value={formAssignedTo} onChange={(e) => setFormAssignedTo(e.target.value)} className="w-full glass-input text-xs pl-8 appearance-none" required>
                      <option value="">— Selectați utilizatorul —</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.full_name || u.username} ({u.username})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400">Descriere / Observații (Opțional)</label>
                <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="ex: Masă albă IKEA, stare bună. Serial number: XYZ-123" rows={3} className="w-full glass-input text-xs resize-none" />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800/40">
                <label className="text-slate-400">Fotografie Obiect</label>
                <div className="flex gap-3 items-start">
                  {formImagePreview ? (
                    <div className="relative flex-shrink-0">
                      <img src={formImagePreview} alt="Preview" className="w-20 h-20 object-cover rounded-xl border border-slate-700/40" />
                      <button type="button" onClick={() => { setFormImage(null); setFormImagePreview(null); }} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 rounded-full text-white flex items-center justify-center hover:bg-rose-600 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-slate-800/60 border border-dashed border-slate-700 flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-6 h-6 text-slate-600" />
                    </div>
                  )}
                  <label className="flex-grow border border-dashed border-slate-700 rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:bg-slate-800/30 hover:border-sidesi-500/50 transition-all text-center">
                    <input type="file" accept="image/*" onChange={handleImageChange} className="sr-only" />
                    <Upload className="w-6 h-6 text-sidesi-400" />
                    <span className="text-slate-400 text-[11px]">{formImage ? formImage.name : 'Click sau drag & drop imagine'}</span>
                    <span className="text-slate-600 text-[10px]">PNG, JPG — Imaginea va fi comprimată automat pe server</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800/40">
                <button type="button" onClick={() => { setIsFormOpen(false); resetForm(); }} className="glass-button-secondary py-2">Anulează</button>
                <button type="submit" disabled={isSaving} className="glass-button-primary py-2 disabled:opacity-60 disabled:pointer-events-none">
                  {isSaving ? 'Se salvează...' : (editingItem ? 'Salvează Modificările' : 'Adaugă în Inventar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Export Modal ── */}
      {isExportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" onClick={() => setIsExportOpen(false)} />
          <div className="relative w-full max-w-md glass-panel p-6 rounded-2xl z-10 space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800/40">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileDown className="w-5 h-5 text-sidesi-400" />
                Exportă Raport Inventar
              </h3>
              <button onClick={() => setIsExportOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExport} className="space-y-4 text-xs font-semibold">
              {/* User filter */}
              <div className="space-y-1.5">
                <label className="text-slate-400">Filtrare după Utilizator</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                  <select value={exportUser} onChange={(e) => setExportUser(e.target.value)} className="w-full glass-input text-xs pl-8 appearance-none">
                    <option value="">Toți utilizatorii (Raport general)</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.username} ({u.username})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Format selector */}
              <div className="space-y-2">
                <label className="text-slate-400">Format raport</label>
                <div className="grid grid-cols-1 gap-2">
                  {EXPORT_OPTIONS.map((opt) => (
                    <label key={opt.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${
                      exportFormat === opt.id
                        ? 'border-sidesi-500/50 bg-sidesi-500/10'
                        : 'border-slate-800/50 bg-slate-900/30 hover:bg-slate-900/50'
                    }`}>
                      <input type="radio" name="exportFormat" value={opt.id} checked={exportFormat === opt.id} onChange={() => setExportFormat(opt.id)} className="sr-only" />
                      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${opt.color}`}>
                        {opt.icon}
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="font-bold text-white">{opt.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{opt.sublabel}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${exportFormat === opt.id ? 'border-sidesi-400 bg-sidesi-400' : 'border-slate-600'}`}>
                        {exportFormat === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800/40">
                <button type="button" onClick={() => setIsExportOpen(false)} className="glass-button-secondary py-2">Anulează</button>
                <button type="submit" disabled={isExporting} className="glass-button-primary py-2 disabled:opacity-60 disabled:pointer-events-none flex items-center gap-2">
                  {isExporting
                    ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Se generează...</>
                    : <><FileDown className="w-3.5 h-3.5" />Descarcă Raport</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Șterge Obiect"
        message="Ești sigur că vrei să ștergi acest obiect din inventar? Acțiunea este ireversibilă."
        confirmLabel="Șterge"
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default InventoryPage;
