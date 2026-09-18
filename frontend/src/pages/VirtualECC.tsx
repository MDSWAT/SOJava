import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Cpu, Plus, Search, ClipboardCopy, Edit,
  Trash2, Upload, FileDown, Download, X,
  ChevronLeft, ChevronRight, Loader2, Info, MapPin,
  Filter, CheckSquare, Network, AlertTriangle, CheckCircle, XCircle, Link2, KeyRound, Eye, EyeOff, Phone,
  ArrowUpDown, ArrowUp, ArrowDown, MessageSquare
} from 'lucide-react';
import { useAuthStore } from '@/context/authStore';
import { useToastStore } from '@/context/toastStore';
import TableSkeleton from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import api from '@/services/api';
import { VirtualECCItem, RaionStats } from '@/types';

// Clipboard helper with fallback
const copyToClipboard = async (text: string): Promise<void> => {
  if (!text) return;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fallback to execCommand below
  }
  return new Promise((resolve, reject) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, 99999);
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      ok ? resolve() : reject(new Error('Copy failed'));
    } catch (err) {
      reject(err);
    }
  });
};

const PAGE_SIZE = 10;

// Quick-copy reference links/credentials for MEV/ECC virtual terminal configuration
const MEV_QUICK_LINKS = [
  { label: 'HOST', value: 'https://sift-mev.sfs.md/api/v3/ACPS/' },
  { label: 'Check Host', value: 'https://mev.sfs.md/receipt-verifier/' },
];
const MEV_QUICK_PASSWORD = 'K0EdbvEk2k0zH6K';

const EXPORT_COLUMN_OPTIONS: Record<string, string> = {
  oficiu: 'Oficiu',
  tel_oficiu: 'Telefon Oficiu',
  terminal_id: 'ID Terminal',
  nr_inregistrare_sfs: 'Nr. Înregistrare SFS',
  nr_ordine: 'Nr. Ordine',
  data_inregistrare: 'Dată Înregistrare',
  denumire_entitate: 'Denumire Entitate',
  idno: 'IDNO',
  model_ecc: 'Model ECC',
  adresa_ecc: 'Adresă ECC',
  ip_adresa: 'IP Adresă',
  status: 'Statut',
  mev_key: 'Cheie MEV',
  comentarii: 'Comentarii',
  created_at: 'Data Creării',
};

export const VirtualECC: React.FC = () => {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const addToast = useToastStore((state) => state.addToast);

  const canManage = hasPermission('virtual_ecc:manage');

  // Lists & pagination
  const [items, setItems] = useState<VirtualECCItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || '');
  const [raionFilter, setRaionFilter] = useState(''); // '' = all, 'nealocat' = unassigned, uuid = specific raion
  const [hasMevKeyFilter, setHasMevKeyFilter] = useState('');
  const [ordering, setOrdering] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Raioane state
  const [raionStats, setRaionStats] = useState<RaionStats>({ raioane: [], unassigned: 0 });
  // New raion creation mini-form
  const [isRaionFormOpen, setIsRaionFormOpen] = useState(false);
  const [raionFormName, setRaionFormName] = useState('');
  const [raionFormCode, setRaionFormCode] = useState('');
  const [raionFormColor, setRaionFormColor] = useState('#3b82f6');
  const [isSavingRaion, setIsSavingRaion] = useState(false);
  // For import PDF modal raion selection
  const [importRaionId, setImportRaionId] = useState('');

  // Sync status filter from URL param once on mount (e.g. navigated from Dashboard)
  useEffect(() => {
    const paramStatus = searchParams.get('status');
    if (paramStatus && paramStatus !== statusFilter) {
      setStatusFilter(paramStatus);
    }
    // Clear the param from URL after reading so the URL stays clean
    if (searchParams.has('status')) {
      setSearchParams(prev => { prev.delete('status'); return prev; }, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Revealed keys cache (eccId -> decryptedKey)
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({});

  // Quick MEV password reveal toggle
  const [isMevPasswordRevealed, setIsMevPasswordRevealed] = useState(false);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VirtualECCItem | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Import modal states
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: { filename: string; terminal_id: string; oficiu: string; action: string }[];
    failed: { filename: string; error: string }[];
  } | null>(null);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });

  // Deletion confirm state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Export modal state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportColumns, setExportColumns] = useState<string[]>([
    'oficiu', 'terminal_id', 'nr_inregistrare_sfs', 'nr_ordine',
    'data_inregistrare', 'denumire_entitate', 'idno', 'adresa_ecc', 'status'
  ]);
  const [exportOficii, setExportOficii] = useState<string[]>([]);
  const [exportStatuses, setExportStatuses] = useState<string[]>([]);
  const [officeList, setOfficeList] = useState<string[]>([]);

  // Import IP modal state
  const [isIpImportOpen, setIsIpImportOpen] = useState(false);
  const [isIpImporting, setIsIpImporting] = useState(false);
  const [ipImportFile, setIpImportFile] = useState<File | null>(null);
  const [isIpDragging, setIsIpDragging] = useState(false);
  const [ipImportResult, setIpImportResult] = useState<any>(null);
  const [ipForceOverwrite, setIpForceOverwrite] = useState(false);

  // Import MEV keys modal state
  const [isMevImportOpen, setIsMevImportOpen] = useState(false);
  const [isMevImporting, setIsMevImporting] = useState(false);
  const [mevImportFile, setMevImportFile] = useState<File | null>(null);
  const [isMevDragging, setIsMevDragging] = useState(false);
  const [mevImportResult, setMevImportResult] = useState<any>(null);

  // Form inputs
  const [formTerminalId, setFormTerminalId] = useState('');
  const [formTelOficiu, setFormTelOficiu] = useState('');
  const [formNrInregistrare, setFormNrInregistrare] = useState('');
  const [formNrOrdine, setFormNrOrdine] = useState('');
  const [formDataInregistrare, setFormDataInregistrare] = useState('');
  const [formDenumireEntitate, setFormDenumireEntitate] = useState('');
  const [formIdno, setFormIdno] = useState('');
  const [formModelEcc, setFormModelEcc] = useState('');
  const [formAdresaEcc, setFormAdresaEcc] = useState('');
  const [formIpAdresa, setFormIpAdresa] = useState('');
  const [formMevKey, setFormMevKey] = useState('');
  const [deleteMevKey, setDeleteMevKey] = useState(false);
  const [showMevKey, setShowMevKey] = useState(true);
  const [formStatus, setFormStatus] = useState<'neconfigurat' | 'aplicatie_instalata' | 'in_certificare' | 'certificat' | 'eroare_certificare' | 'pus_in_exploatare'>('neconfigurat');
  const [formZRaport, setFormZRaport] = useState(false);
  const [formComentarii, setFormComentarii] = useState('');
  const [formPdfFile, setFormPdfFile] = useState<File | null>(null);
  const [formRaionId, setFormRaionId] = useState('');

  // KPI stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    appInstalled: 0,
    inCertification: 0,
    certified: 0,
    erroareCertificare: 0,
    unconfigured: 0,
    withIp: 0,
    withoutIp: 0,
    withMev: 0,
    withoutMev: 0,
  });

  const handleSortToggle = (ascField: string, descField: string) => {
    setCurrentPage(1);
    if (ordering === ascField) {
      setOrdering(descField);
    } else if (ordering === descField) {
      setOrdering('');
    } else {
      setOrdering(ascField);
    }
  };

  const renderSortIndicator = (ascField: string, descField: string) => {
    if (ordering === ascField) {
      return <ArrowUp className="w-3.5 h-3.5 text-sidesi-400 inline ml-1.5" />;
    }
    if (ordering === descField) {
      return <ArrowDown className="w-3.5 h-3.5 text-sidesi-400 inline ml-1.5" />;
    }
    return <ArrowUpDown className="w-3 h-3 text-slate-400/40 inline ml-1.5 opacity-40 group-hover:opacity-100 transition-opacity" />;
  };

  const fetchECCList = async () => {
    setIsLoading(true);
    try {
      const params: any = { page: currentPage, page_size: PAGE_SIZE };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (hasMevKeyFilter) params.has_mev_key = hasMevKeyFilter;
      if (ordering) params.ordering = ordering;
      if (raionFilter) params.raion = raionFilter;
      
      // Fetch paginated list, stats and raion stats in parallel
      const [res, statsRes, raionRes] = await Promise.all([
        api.get('/virtual-ecc/ecc/', { params }),
        api.get('/virtual-ecc/ecc/stats/'),
        api.get('/virtual-ecc/raioane/stats/')
      ]);

      const pageItems = res.data.results || res.data;
      setItems(pageItems);
      setTotalCount(res.data.count || pageItems.length);
      setRaionStats(raionRes.data);

      // Stats come from DB-level COUNT — always accurate regardless of pagination
      const s = statsRes.data;
      const byStatus = s.by_status || {};
      setStats({
        total: s.total || 0,
        active: byStatus['pus_in_exploatare'] || 0,
        appInstalled: byStatus['aplicatie_instalata'] || 0,
        inCertification: byStatus['in_certificare'] || 0,
        certified: byStatus['certificat'] || 0,
        erroareCertificare: byStatus['eroare_certificare'] || 0,
        unconfigured: byStatus['neconfigurat'] || 0,
        withIp: s.with_ip || 0,
        withoutIp: s.without_ip || 0,
        withMev: s.with_mev || 0,
        withoutMev: s.without_mev || 0,
      });

      // Pre-populate revealed keys directly from plain_mev_key (immediate, no masking)
      const directKeys: Record<string, string> = {};
      pageItems.forEach((item: VirtualECCItem) => {
        if (item.plain_mev_key) {
          directKeys[item.id] = item.plain_mev_key;
        }
      });
      setRevealedKeys(prev => ({ ...prev, ...directKeys }));

      // Fallback bulk reveal if any key is still missing plain text
      const idsWithKeys = pageItems
        .filter((item: VirtualECCItem) => (item.masked_mev_key || item.plain_mev_key) && !directKeys[item.id])
        .map((item: VirtualECCItem) => item.id);
      if (idsWithKeys.length > 0) {
        try {
          const revealRes = await api.get('/virtual-ecc/ecc/reveal-bulk/', {
            params: { ids: idsWithKeys.join(',') }
          });
          if (revealRes.data.keys) {
            setRevealedKeys(prev => ({ ...prev, ...revealRes.data.keys }));
          }
        } catch {
          // Silently fail
        }
      }
    } catch (err) {
      addToast('Eroare la încărcarea listei de aparate.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOfficeList = async () => {
    try {
      const res = await api.get('/virtual-ecc/ecc/', { params: { page_size: 500 } });
      const allItems = res.data.results || res.data;
      const offices = [...new Set(allItems.map((item: VirtualECCItem) => item.oficiu))].sort() as string[];
      setOfficeList(offices);
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    fetchECCList();
  }, [search, statusFilter, raionFilter, hasMevKeyFilter, ordering, currentPage]);

  const handleOpenForm = async (item: VirtualECCItem | null = null) => {
    if (item) {
      setEditingItem(item);
      setIsEditMode(false); // Start in view mode
      setFormTerminalId(item.terminal_id);
      setFormTelOficiu(item.tel_oficiu || '');
      setFormNrInregistrare(item.nr_inregistrare_sfs || '');
      setFormNrOrdine(item.nr_ordine || '');
      setFormDataInregistrare(item.data_inregistrare || '');
      setFormDenumireEntitate(item.denumire_entitate || '');
      setFormIdno(item.idno || '');
      setFormModelEcc(item.model_ecc || '');
      setFormAdresaEcc(item.adresa_ecc || '');
      setFormIpAdresa(item.ip_adresa || '');
      setFormComentarii(item.comentarii || '');
      setDeleteMevKey(false);
      setShowMevKey(true);
      setFormStatus(item.status);
      setFormZRaport(Boolean(item.z_raport));
      setFormRaionId(item.raion_id || '');
      // Pre-populate MEV key with decrypted value if it exists
      if (item.plain_mev_key) {
        setFormMevKey(item.plain_mev_key);
      } else if (revealedKeys[item.id]) {
        setFormMevKey(revealedKeys[item.id]);
      } else if (item.masked_mev_key) {
        setFormMevKey(''); // Clear while loading
        try {
          const res = await api.get(`/virtual-ecc/ecc/${item.id}/reveal/`);
          const key = res.data.mev_key || '';
          setFormMevKey(key);
          setRevealedKeys(prev => ({ ...prev, [item.id]: key }));
        } catch {
          setFormMevKey('');
        }
      } else {
        setFormMevKey('');
      }
    } else {
      setEditingItem(null);
      setIsEditMode(true); // New item = edit mode
      setFormTerminalId('');
      setFormTelOficiu('');
      setFormNrInregistrare('');
      setFormNrOrdine('');
      setFormDataInregistrare('');
      setFormDenumireEntitate('');
      setFormIdno('');
      setFormModelEcc('');
      setFormAdresaEcc('');
      setFormIpAdresa('');
      setFormComentarii('');
      setFormMevKey('');
      setDeleteMevKey(false);
      setShowMevKey(true);
      setFormStatus('neconfigurat');
      setFormZRaport(false);
      setFormRaionId('');
    }
    setFormPdfFile(null);
    setIsFormOpen(true);
  };

  const handleFormStatusChange = (newStatus: 'neconfigurat' | 'aplicatie_instalata' | 'in_certificare' | 'certificat' | 'eroare_certificare' | 'pus_in_exploatare') => {
    setFormStatus(newStatus);
    if (newStatus === 'pus_in_exploatare') {
      const today = new Date().toISOString().split('T')[0];
      setFormDataInregistrare(today);
      setFormZRaport(true);
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTerminalId) {
      addToast('ID-ul Terminalului este obligatoriu.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('terminal_id', formTerminalId);
    formData.append('tel_oficiu', formTelOficiu);
    formData.append('nr_inregistrare_sfs', formNrInregistrare);
    formData.append('nr_ordine', formNrOrdine);
    if (formDataInregistrare) {
      formData.append('data_inregistrare', formDataInregistrare);
    }
    formData.append('denumire_entitate', formDenumireEntitate);
    formData.append('idno', formIdno);
    formData.append('model_ecc', formModelEcc);
    formData.append('adresa_ecc', formAdresaEcc);
    formData.append('ip_adresa', formIpAdresa);
    formData.append('status', formStatus);
    formData.append('z_raport', String(formZRaport));
    formData.append('comentarii', formComentarii);
    if (formRaionId) {
      formData.append('raion_id', formRaionId);
    } else {
      formData.append('raion_id', '');
    }
    if (formMevKey) {
      formData.append('mev_key', formMevKey);
    } else if (deleteMevKey) {
      formData.append('mev_key', '');
    }
    if (formPdfFile) {
      formData.append('pdf_file', formPdfFile);
    }

    try {
      if (editingItem) {
        await api.patch(`/virtual-ecc/ecc/${editingItem.id}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        addToast('Aparatul de casă a fost actualizat cu succes.', 'success');
      } else {
        await api.post('/virtual-ecc/ecc/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        addToast('Aparatul de casă a fost adăugat cu succes.', 'success');
      }
      setIsFormOpen(false);
      fetchECCList();
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.response?.data?.terminal_id?.[0] || 'Eroare la salvare.';
      addToast(errorMsg, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/virtual-ecc/ecc/${deleteTarget}/`);
      addToast('Aparatul a fost șters.', 'success');
      setDeleteTarget(null);
      fetchECCList();
    } catch (err) {
      addToast('Eroare la ștergerea aparatului.', 'error');
    }
  };

  const handleCopyKey = async (id: string, directKey?: string | null) => {
    let keyToCopy = directKey || revealedKeys[id];
    if (!keyToCopy) {
      try {
        const res = await api.get(`/virtual-ecc/ecc/${id}/reveal/`);
        keyToCopy = res.data.mev_key;
        if (keyToCopy) {
          setRevealedKeys(prev => ({ ...prev, [id]: keyToCopy }));
        }
      } catch (err) {
        addToast('Eroare la copiere.', 'error');
        return;
      }
    }
    if (keyToCopy) {
      await copyToClipboard(keyToCopy);
      addToast('Cheia MEV copiată în clipboard.', 'success');
    }
  };

  const handleDownloadPdf = async (item: VirtualECCItem) => {
    try {
      const response = await api.get(`/virtual-ecc/ecc/${item.id}/download/`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `${item.terminal_id}_Cartela.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      addToast('Eroare la descărcarea fișierului PDF.', 'error');
    }
  };

  const handleExportExcel = async () => {
    if (exportColumns.length === 0) {
      addToast('Selectați cel puțin o coloană pentru export.', 'error');
      return;
    }
    setIsExporting(true);
    try {
      const params: Record<string, string> = {
        columns: exportColumns.join(','),
      };
      if (exportOficii.length > 0) params.oficiu = exportOficii.join(',');
      if (exportStatuses.length > 0) params.status = exportStatuses.join(',');
      if (search) params.search = search;
      if (ordering) params.ordering = ordering;

      const response = await api.get('/virtual-ecc/ecc/export/', {
        responseType: 'blob',
        params
      });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `SIDESI_Echipamente_Virtuale_${new Date().toISOString().slice(0,10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setIsExportOpen(false);
      addToast('Exportul Excel a fost generat cu succes.', 'success');
    } catch (err) {
      addToast('Eroare la exportul datelor în Excel.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Status Switcher logic
  const handleQuickStatusChange = async (item: VirtualECCItem, newStatus: 'neconfigurat' | 'aplicatie_instalata' | 'in_certificare' | 'certificat' | 'eroare_certificare' | 'pus_in_exploatare') => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const formData = new FormData();
      formData.append('status', newStatus);

      let updatedDate = item.data_inregistrare;
      let updatedZRaport = item.z_raport;

      if (newStatus === 'pus_in_exploatare') {
        updatedDate = today;
        updatedZRaport = true;
        formData.append('data_inregistrare', updatedDate);
        formData.append('z_raport', 'true');
      }

      await api.patch(`/virtual-ecc/ecc/${item.id}/`, formData);
      const statusLabels = {
        neconfigurat: 'Neconfigurat',
        aplicatie_instalata: 'Aplicație instalată',
        in_certificare: 'În certificare',
        certificat: 'Certificat',
        eroare_certificare: 'Eroare la certificare',
        pus_in_exploatare: 'Pus în exploatare'
      };
      addToast(`Statut schimbat în: ${statusLabels[newStatus]}`, 'success');
      setItems(prev => prev.map(it => it.id === item.id ? {
        ...it,
        status: newStatus,
        data_inregistrare: updatedDate,
        z_raport: updatedZRaport
      } : it));
    } catch (err) {
      addToast('Eroare la schimbarea statutului.', 'error');
    }
  };

  // Z Raport toggle
  const handleToggleZRaport = async (item: VirtualECCItem) => {
    try {
      const formData = new FormData();
      formData.append('z_raport', String(!item.z_raport));
      await api.patch(`/virtual-ecc/ecc/${item.id}/`, formData);
      addToast(`Z Raport ${!item.z_raport ? 'bifat' : 'debifat'} pentru ${item.terminal_id}.`, 'success');
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, z_raport: !item.z_raport } : it));
    } catch (err) {
      addToast('Eroare la actualizarea Z Raport.', 'error');
    }
  };

  // Multiple PDF uploading functions
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.pdf'));
      if (newFiles.length === 0) {
        addToast('Vă rugăm să încărcați doar fișiere PDF.', 'warning');
      } else {
        setImportFiles(prev => [...prev, ...newFiles]);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).filter(f => f.name.endsWith('.pdf'));
      setImportFiles(prev => [...prev, ...newFiles]);
    }
  };

  const BATCH_SIZE = 20;

  const handleStartImport = async () => {
    if (importFiles.length === 0) {
      addToast('Vă rugăm să selectați cel puțin un fișier PDF.', 'error');
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    // Split files into chunks of BATCH_SIZE
    const chunks: File[][] = [];
    for (let i = 0; i < importFiles.length; i += BATCH_SIZE) {
      chunks.push(importFiles.slice(i, i + BATCH_SIZE));
    }

    const allSuccess: { filename: string; terminal_id: string; oficiu: string; action: string }[] = [];
    const allFailed: { filename: string; error: string }[] = [];
    setBatchProgress({ done: 0, total: importFiles.length });

    try {
      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];
        const formData = new FormData();
        chunk.forEach(file => formData.append('file', file));
        if (importRaionId) {
          formData.append('raion_id', importRaionId);
        }

        const res = await api.post('/virtual-ecc/ecc/import/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        allSuccess.push(...(res.data.success || []));
        allFailed.push(...(res.data.failed || []));
        setBatchProgress({ done: Math.min((ci + 1) * BATCH_SIZE, importFiles.length), total: importFiles.length });
      }

      setImportResult({ success: allSuccess, failed: allFailed });
      addToast(`Import finalizat: ${allSuccess.length} importate, ${allFailed.length} eșuate.`, allFailed.length > 0 ? 'warning' : 'success');
      fetchECCList();
    } catch (err) {
      addToast('Eroare la procesarea fișierelor.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleRemoveImportFile = (index: number) => {
    setImportFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleImportIPs = async () => {
    if (!ipImportFile) return;
    setIsIpImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', ipImportFile);
      formData.append('force', ipForceOverwrite ? 'true' : 'false');
      const res = await api.post('/virtual-ecc/ecc/import-ips/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setIpImportResult(res.data);
      const s = res.data.summary;
      addToast(
        `Import IP: ${s.updated} adăugate, ${s.same_ip} neschimbate, ${s.already_has_ip} cu IP existent, ${s.not_found} negăsite, ${s.duplicates} duplicate.`,
        s.not_found > 0 || s.duplicates > 0 || s.already_has_ip > 0 ? 'warning' : 'success'
      );
      fetchECCList();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Eroare la importul adreselor IP.';
      addToast(msg, 'error');
    } finally {
      setIsIpImporting(false);
    }
  };

  const handleImportMevKeys = async () => {
    if (!mevImportFile) return;
    setIsMevImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', mevImportFile);
      const res = await api.post('/virtual-ecc/ecc/import-mev-keys/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMevImportResult(res.data);
      const s = res.data.summary;
      addToast(
        `Import MEV: ${s.updated} chei adăugate, ${s.skipped_has_key} cu chei existente (skipped), ${s.not_found} negăsite, ${s.duplicates} duplicate.`,
        s.not_found > 0 || s.duplicates > 0 || s.skipped_has_key > 0 ? 'warning' : 'success'
      );
      fetchECCList();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Eroare la importul cheilor MEV.';
      addToast(msg, 'error');
    } finally {
      setIsMevImporting(false);
    }
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 4) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 3) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="space-y-6">
      {/* Header & KPI Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Cpu className="w-7 h-7 text-sidesi-500" />
            Evidență Aparate de Casă Virtuale
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestiunea centralizată a echipamentelor de casă virtuale și a cheilor MEV.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchOfficeList(); setIsExportOpen(true); }}
            className="glass-button-secondary py-2.5 px-4 text-xs font-semibold flex items-center gap-2"
          >
            <FileDown className="w-4 h-4 text-slate-400" />
            <span>Export Excel</span>
          </button>
          
          {canManage && (
            <>
              <button
                onClick={() => {
                  setImportFiles([]);
                  setImportResult(null);
                  setIsImportOpen(true);
                }}
                className="glass-button-secondary py-2.5 px-4 text-xs font-semibold flex items-center gap-2 border-dashed"
              >
                <Upload className="w-4 h-4 text-slate-400" />
                <span>Import PDF</span>
              </button>

              <button
                onClick={() => {
                  setIpImportFile(null);
                  setIpImportResult(null);
                  setIpForceOverwrite(false);
                  setIsIpImportOpen(true);
                }}
                className="glass-button-secondary py-2.5 px-4 text-xs font-semibold flex items-center gap-2 border-dashed"
              >
                <Network className="w-4 h-4 text-slate-400" />
                <span>Import IP</span>
              </button>

              <button
                onClick={() => {
                  setMevImportFile(null);
                  setMevImportResult(null);
                  setIsMevImportOpen(true);
                }}
                className="glass-button-secondary py-2.5 px-4 text-xs font-semibold flex items-center gap-2 border-dashed"
              >
                <KeyRound className="w-4 h-4 text-slate-400" />
                <span>Import Chei MEV</span>
              </button>

              <button
                onClick={() => handleOpenForm()}
                className="glass-button-primary py-2.5 px-4 text-xs font-semibold flex items-center gap-2 shadow-lg shadow-sidesi-500/10"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>Adaugă Aparat</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Total Card — click to clear filter */}
        <button
          type="button"
          onClick={() => { setStatusFilter(''); setCurrentPage(1); }}
          className={`glass-panel p-3 rounded-xl flex flex-col justify-between border min-h-20 transition-all duration-150 hover:scale-[1.02] text-left cursor-pointer ${
            statusFilter === '' ? 'border-slate-400/60 dark:border-slate-500/60 ring-2 ring-slate-400/30' : 'border-slate-200/50 dark:border-slate-800/30 hover:border-slate-400/40'
          }`}
          title="Afișează toate aparatele"
        >
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Aparate</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</span>
            {statusFilter === '' && <span className="text-[9px] text-slate-400 font-bold uppercase bg-slate-500/10 px-1.5 py-0.5 rounded">Toate</span>}
          </div>
        </button>

        {/* Active / Pus în exploatare */}
        <button
          type="button"
          onClick={() => { setStatusFilter(prev => prev === 'pus_in_exploatare' ? '' : 'pus_in_exploatare'); setCurrentPage(1); }}
          className={`glass-panel p-3 rounded-xl flex flex-col justify-between border-l-4 border-l-emerald-500 min-h-20 transition-all duration-150 hover:scale-[1.02] text-left cursor-pointer ${
            statusFilter === 'pus_in_exploatare' ? 'border border-emerald-500/60 ring-2 ring-emerald-500/30 bg-emerald-500/5' : 'border border-slate-200/50 dark:border-slate-800/30 hover:border-emerald-500/40'
          }`}
          title="Filtrează după: Pus în exploatare"
        >
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active</span>
          <div className="flex items-baseline gap-1 mt-1 justify-between">
            <span className={`text-2xl font-black ${statusFilter === 'pus_in_exploatare' ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>{stats.active}</span>
            <span className="text-[9px] text-emerald-400 font-extrabold uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded">Exploatare</span>
          </div>
        </button>

        {/* Aplicatie Instalata */}
        <button
          type="button"
          onClick={() => { setStatusFilter(prev => prev === 'aplicatie_instalata' ? '' : 'aplicatie_instalata'); setCurrentPage(1); }}
          className={`glass-panel p-3 rounded-xl flex flex-col justify-between border-l-4 border-l-orange-500 min-h-20 transition-all duration-150 hover:scale-[1.02] text-left cursor-pointer ${
            statusFilter === 'aplicatie_instalata' ? 'border border-orange-500/60 ring-2 ring-orange-500/30 bg-orange-500/5' : 'border border-slate-200/50 dark:border-slate-800/30 hover:border-orange-500/40'
          }`}
          title="Filtrează după: Aplicație instalată"
        >
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Aplic. Instalată</span>
          <div className="flex items-baseline gap-1 mt-1 justify-between">
            <span className={`text-2xl font-black ${statusFilter === 'aplicatie_instalata' ? 'text-orange-400' : 'text-slate-900 dark:text-white'}`}>{stats.appInstalled}</span>
            <span className="text-[9px] text-orange-400 font-extrabold uppercase bg-orange-500/10 px-1.5 py-0.5 rounded">Instalată</span>
          </div>
        </button>

        {/* In Certificare */}
        <button
          type="button"
          onClick={() => { setStatusFilter(prev => prev === 'in_certificare' ? '' : 'in_certificare'); setCurrentPage(1); }}
          className={`glass-panel p-3 rounded-xl flex flex-col justify-between border-l-4 border-l-amber-500 min-h-20 transition-all duration-150 hover:scale-[1.02] text-left cursor-pointer ${
            statusFilter === 'in_certificare' ? 'border border-amber-500/60 ring-2 ring-amber-500/30 bg-amber-500/5' : 'border border-slate-200/50 dark:border-slate-800/30 hover:border-amber-500/40'
          }`}
          title="Filtrează după: În certificare"
        >
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Certificare</span>
          <div className="flex items-baseline gap-1 mt-1 justify-between">
            <span className={`text-2xl font-black ${statusFilter === 'in_certificare' ? 'text-amber-400' : 'text-slate-900 dark:text-white'}`}>{stats.inCertification}</span>
            <span className="text-[9px] text-amber-400 font-extrabold uppercase bg-amber-500/10 px-1.5 py-0.5 rounded">În Curs</span>
          </div>
        </button>

        {/* Certificat */}
        <button
          type="button"
          onClick={() => { setStatusFilter(prev => prev === 'certificat' ? '' : 'certificat'); setCurrentPage(1); }}
          className={`glass-panel p-3 rounded-xl flex flex-col justify-between border-l-4 border-l-blue-500 min-h-20 transition-all duration-150 hover:scale-[1.02] text-left cursor-pointer ${
            statusFilter === 'certificat' ? 'border border-blue-500/60 ring-2 ring-blue-500/30 bg-blue-500/5' : 'border border-slate-200/50 dark:border-slate-800/30 hover:border-blue-500/40'
          }`}
          title="Filtrează după: Certificat"
        >
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Certificat</span>
          <div className="flex items-baseline gap-1 mt-1 justify-between">
            <span className={`text-2xl font-black ${statusFilter === 'certificat' ? 'text-blue-400' : 'text-slate-900 dark:text-white'}`}>{stats.certified}</span>
            <span className="text-[9px] text-blue-400 font-extrabold uppercase bg-blue-500/10 px-1.5 py-0.5 rounded">Certificat</span>
          </div>
        </button>

        {/* Eroare Certificare */}
        <button
          type="button"
          onClick={() => { setStatusFilter(prev => prev === 'eroare_certificare' ? '' : 'eroare_certificare'); setCurrentPage(1); }}
          className={`glass-panel p-3 rounded-xl flex flex-col justify-between border-l-4 border-l-pink-500 min-h-20 transition-all duration-150 hover:scale-[1.02] text-left cursor-pointer ${
            statusFilter === 'eroare_certificare' ? 'border border-pink-500/60 ring-2 ring-pink-500/30 bg-pink-500/5' : 'border border-slate-200/50 dark:border-slate-800/30 hover:border-pink-500/40'
          }`}
          title="Filtrează după: Eroare la certificare"
        >
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Eroare Cert.</span>
          <div className="flex items-baseline gap-1 mt-1 justify-between">
            <span className={`text-2xl font-black ${statusFilter === 'eroare_certificare' ? 'text-pink-400' : 'text-slate-900 dark:text-white'}`}>{stats.erroareCertificare}</span>
            <span className="text-[9px] text-pink-400 font-extrabold uppercase bg-pink-500/10 px-1.5 py-0.5 rounded">Eroare</span>
          </div>
        </button>

        {/* Neconfigurat */}
        <button
          type="button"
          onClick={() => { setStatusFilter(prev => prev === 'neconfigurat' ? '' : 'neconfigurat'); setCurrentPage(1); }}
          className={`glass-panel p-3 rounded-xl flex flex-col justify-between border-l-4 border-l-rose-500 min-h-20 transition-all duration-150 hover:scale-[1.02] text-left cursor-pointer ${
            statusFilter === 'neconfigurat' ? 'border border-rose-500/60 ring-2 ring-rose-500/30 bg-rose-500/5' : 'border border-slate-200/50 dark:border-slate-800/30 hover:border-rose-500/40'
          }`}
          title="Filtrează după: Neconfigurat"
        >
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Neconfigurat</span>
          <div className="flex items-baseline gap-1 mt-1 justify-between">
            <span className={`text-2xl font-black ${statusFilter === 'neconfigurat' ? 'text-rose-400' : 'text-slate-900 dark:text-white'}`}>{stats.unconfigured}</span>
            <span className="text-[9px] text-rose-500 font-extrabold uppercase bg-rose-500/10 px-1.5 py-0.5 rounded">Neconf.</span>
          </div>
        </button>
      </div>

      {/* ── Raioane Panel ────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl border border-slate-200/50 dark:border-slate-800/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-sidesi-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Raioane</span>
            <span className="text-[10px] text-slate-400 font-medium">
              — {raionStats.raioane.length} raion{raionStats.raioane.length !== 1 ? 'e' : ''} definit{raionStats.raioane.length !== 1 ? 'e' : ''}
            </span>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => { setIsRaionFormOpen(v => !v); setRaionFormName(''); setRaionFormCode(''); setRaionFormColor('#3b82f6'); }}
              className="flex items-center gap-1.5 text-[10px] font-bold text-sidesi-500 hover:text-sidesi-400 px-2.5 py-1.5 rounded-lg hover:bg-sidesi-500/10 transition-colors border border-sidesi-500/30"
            >
              <Plus className="w-3 h-3" />
              Adaugă Raion
            </button>
          )}
        </div>

        {/* Mini-form creare raion */}
        {isRaionFormOpen && canManage && (
          <div className="flex flex-wrap items-end gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Denumire*</label>
              <input
                type="text"
                placeholder="ex: Chișinău"
                value={raionFormName}
                onChange={e => setRaionFormName(e.target.value)}
                className="glass-input text-xs w-36"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cod*</label>
              <input
                type="text"
                placeholder="ex: CHI"
                value={raionFormCode}
                onChange={e => setRaionFormCode(e.target.value.toUpperCase().slice(0, 10))}
                className="glass-input text-xs w-24"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Culoare</label>
              <input
                type="color"
                value={raionFormColor}
                onChange={e => setRaionFormColor(e.target.value)}
                className="h-9 w-12 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent p-0.5"
              />
            </div>
            <button
              type="button"
              disabled={isSavingRaion || !raionFormName.trim() || !raionFormCode.trim()}
              onClick={async () => {
                setIsSavingRaion(true);
                try {
                  await api.post('/virtual-ecc/raioane/', { name: raionFormName.trim(), code: raionFormCode.trim(), color: raionFormColor });
                  addToast(`Raionul „${raionFormName}" a fost creat.`, 'success');
                  setIsRaionFormOpen(false);
                  fetchECCList(); // re-fetches raionStats too
                } catch (err: any) {
                  addToast(err.response?.data?.name?.[0] || err.response?.data?.code?.[0] || 'Eroare la creare raion.', 'error');
                } finally {
                  setIsSavingRaion(false);
                }
              }}
              className="glass-button-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSavingRaion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Salvează
            </button>
            <button
              type="button"
              onClick={() => setIsRaionFormOpen(false)}
              className="glass-button-secondary py-2 px-3 text-xs font-bold"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Raion cards grid */}
        <div className="flex flex-wrap gap-2">
          {/* Toate */}
          <button
            type="button"
            onClick={() => { setRaionFilter(''); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all duration-150 hover:scale-[1.02] ${
              raionFilter === ''
                ? 'bg-sidesi-500 text-white border-sidesi-500 shadow-md shadow-sidesi-500/20'
                : 'glass-panel border-slate-200/50 dark:border-slate-800/30 text-slate-600 dark:text-slate-300 hover:border-sidesi-400/50'
            }`}
          >
            <span>Toate raioanele</span>
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${raionFilter === '' ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
              {stats.total}
            </span>
          </button>

          {/* Nealocat */}
          {raionStats.unassigned > 0 && (
            <button
              type="button"
              onClick={() => { setRaionFilter(prev => prev === 'nealocat' ? '' : 'nealocat'); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all duration-150 hover:scale-[1.02] ${
                raionFilter === 'nealocat'
                  ? 'bg-slate-500 text-white border-slate-500 shadow-md'
                  : 'glass-panel border-slate-300/50 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-slate-400/50'
              }`}
            >
              <span>Nealocat</span>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${raionFilter === 'nealocat' ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                {raionStats.unassigned}
              </span>
            </button>
          )}

          {/* Per raion */}
          {raionStats.raioane.map(raion => (
            <div key={raion.id} className="relative group">
              <button
                type="button"
                onClick={() => { setRaionFilter(prev => prev === raion.id ? '' : raion.id); setCurrentPage(1); }}
                style={raionFilter === raion.id ? { backgroundColor: raion.color, borderColor: raion.color } : { borderColor: raion.color + '60' }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all duration-150 hover:scale-[1.02] ${
                  raionFilter === raion.id
                    ? 'text-white shadow-md'
                    : 'glass-panel text-slate-700 dark:text-slate-200 hover:opacity-90'
                }`}
                title={`Filtrează: ${raion.name} — ${raion.ecc_count} aparate`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: raionFilter === raion.id ? 'rgba(255,255,255,0.6)' : raion.color }}
                />
                <span>{raion.name}</span>
                <span
                  style={raionFilter === raion.id ? { backgroundColor: 'rgba(255,255,255,0.2)' } : { backgroundColor: raion.color + '20', color: raion.color }}
                  className="text-[10px] font-black px-1.5 py-0.5 rounded"
                >
                  {raion.ecc_count}
                </span>
              </button>
              {/* Delete raion button (only visible on hover, only if canManage and no devices) */}
              {canManage && raion.ecc_count === 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Ștergi raionul „${raion.name}"?`)) return;
                    try {
                      await api.delete(`/virtual-ecc/raioane/${raion.id}/`);
                      addToast(`Raionul „${raion.name}" a fost șters.`, 'success');
                      if (raionFilter === raion.id) setRaionFilter('');
                      fetchECCList();
                    } catch { addToast('Eroare la ștergere raion.', 'error'); }
                  }}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] items-center justify-center hidden group-hover:flex hover:bg-rose-600 transition-colors"
                  title="Șterge raion (fără aparate)"
                >×</button>
              )}
            </div>
          ))}

          {raionStats.raioane.length === 0 && !isRaionFormOpen && (
            <p className="text-xs text-slate-400 italic">Niciun raion definit. Apasă „Adaugă Raion" pentru a crea primul raion.</p>
          )}
        </div>
      </div>

      {/* IP Status Indicator + MEV Status Indicator + MEV Quick-Copy Reference Panel */}

      <div className="flex flex-col lg:flex-row flex-wrap items-stretch lg:items-center gap-2 text-xs">
        <div className="flex items-center gap-2 glass-panel px-3 py-2 rounded-xl border border-slate-200/50 dark:border-slate-800/30 shrink-0">
          <Network className="w-4 h-4 text-emerald-400" />
          <button
            type="button"
            onClick={() => {
              setOrdering(prev => prev === 'ip_adresa' ? '' : 'ip_adresa');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
              ordering === 'ip_adresa' ? 'bg-emerald-500/20 text-emerald-300 font-black ring-1 ring-emerald-500/40' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Filtrează: doar cartelele cu IP"
          >
            <span className="font-bold text-slate-600 dark:text-slate-300">Cu IP:</span>
            <span className="font-black text-emerald-500">{stats.withIp}</span>
          </button>
          <span className="text-slate-400">/</span>
          <button
            type="button"
            onClick={() => {
              setOrdering(prev => prev === '-ip_adresa' ? '' : '-ip_adresa');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
              ordering === '-ip_adresa' ? 'bg-rose-500/20 text-rose-300 font-black ring-1 ring-rose-500/40' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Filtrează: doar cartelele fără IP"
          >
            <span className="font-bold text-slate-400">Fără IP:</span>
            <span className="font-black text-rose-400">{stats.withoutIp}</span>
          </button>
          <span className="text-slate-400">din</span>
          <span className="font-black text-slate-600 dark:text-white">{stats.total}</span>
        </div>

        <div className="flex items-center gap-2 glass-panel px-3 py-2 rounded-xl border border-slate-200/50 dark:border-slate-800/30 shrink-0">
          <KeyRound className="w-4 h-4 text-emerald-400" />
          <button
            type="button"
            onClick={() => {
              setHasMevKeyFilter(prev => prev === 'true' ? '' : 'true');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
              hasMevKeyFilter === 'true' ? 'bg-emerald-500/20 text-emerald-300 font-black ring-1 ring-emerald-500/40' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Filtrează: doar cartelele cu cheie MEV"
          >
            <span className="font-bold text-slate-600 dark:text-slate-300">Cu Cheie MEV:</span>
            <span className="font-black text-emerald-500">{stats.withMev}</span>
          </button>
          <span className="text-slate-400">/</span>
          <button
            type="button"
            onClick={() => {
              setHasMevKeyFilter(prev => prev === 'false' ? '' : 'false');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
              hasMevKeyFilter === 'false' ? 'bg-rose-500/20 text-rose-300 font-black ring-1 ring-rose-500/40' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Filtrează: doar cartelele fără cheie MEV"
          >
            <span className="font-bold text-slate-400">Fără Cheie:</span>
            <span className="font-black text-rose-400">{stats.withoutMev}</span>
          </button>
          <span className="text-slate-400">din</span>
          <span className="font-black text-slate-600 dark:text-white">{stats.total}</span>
        </div>

        <div className="glass-panel p-2 rounded-xl border border-slate-200/50 dark:border-slate-800/30 flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center flex-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0 pl-1">
            <Link2 className="w-3.5 h-3.5 text-sidesi-400" />
            Legături MEV
          </span>
          {MEV_QUICK_LINKS.map((link) => (
            <button
              key={link.value}
              type="button"
              onClick={() => {
                copyToClipboard(link.value);
                addToast(`${link.label} copiat în clipboard.`, 'success');
              }}
              title={`Copiază: ${link.value}`}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sidesi-400 dark:hover:border-sidesi-500 transition-colors group max-w-full"
            >
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">{link.label}:</span>
              <span className="font-mono text-[10px] text-cyan-600 dark:text-cyan-400 truncate max-w-[200px]">{link.value}</span>
              <ClipboardCopy className="w-3 h-3 text-slate-400 group-hover:text-sidesi-400 flex-shrink-0" />
            </button>
          ))}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <KeyRound className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Parolă:</span>
            <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 min-w-[100px]">
              {isMevPasswordRevealed ? MEV_QUICK_PASSWORD : '•'.repeat(MEV_QUICK_PASSWORD.length)}
            </span>
            <button
              type="button"
              onClick={() => setIsMevPasswordRevealed((prev) => !prev)}
              title={isMevPasswordRevealed ? 'Ascunde parola' : 'Dezvăluie parola'}
              className="p-0.5 text-slate-400 hover:text-emerald-400 transition-colors flex-shrink-0"
            >
              {isMevPasswordRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
            <button
              type="button"
              onClick={() => {
                copyToClipboard(MEV_QUICK_PASSWORD);
                addToast('Parolă MEV copiată în clipboard.', 'success');
              }}
              title="Copiază parola MEV"
              className="p-0.5 text-slate-400 hover:text-emerald-400 transition-colors flex-shrink-0"
            >
              <ClipboardCopy className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Căutare după terminal ID, oficiu, nr. înregistrare, IP..."
            className="glass-input pl-10"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="glass-input text-xs py-2 px-3 w-full sm:w-40"
            >
              <option value="">Toate statusurile</option>
              <option value="neconfigurat">Neconfigurat (Roșu)</option>
              <option value="aplicatie_instalata">Aplicație instalată (Portocaliu)</option>
              <option value="in_certificare">În certificare (Galben)</option>
              <option value="certificat">Certificat (Albastru)</option>
              <option value="eroare_certificare">Eroare la certificare (Roz)</option>
              <option value="pus_in_exploatare">Pus în exploatare (Verde)</option>
            </select>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Cheie MEV:</span>
            <select
              value={hasMevKeyFilter}
              onChange={(e) => { setHasMevKeyFilter(e.target.value); setCurrentPage(1); }}
              className="glass-input text-xs py-2 px-3 w-full sm:w-40"
            >
              <option value="">Toate</option>
              <option value="true">Cu cheie MEV</option>
              <option value="false">Fără cheie MEV</option>
            </select>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Sortare:</span>
            <select
              value={ordering}
              onChange={(e) => { setOrdering(e.target.value); setCurrentPage(1); }}
              className="glass-input text-xs py-2 px-3 w-full sm:w-40"
            >
              <option value="">Ordonare implicită</option>
              <option value="oficiu">Oficiu (A-Z)</option>
              <option value="-oficiu">Oficiu (Z-A)</option>
              <option value="status">Statut (A-Z)</option>
              <option value="-status">Statut (Z-A)</option>
              <option value="adresa_ecc">Adresă (A-Z)</option>
              <option value="-adresa_ecc">Adresă (Z-A)</option>
              <option value="terminal_id">ID Terminal (A-Z)</option>
              <option value="-terminal_id">ID Terminal (Z-A)</option>
              <option value="ip_adresa">Cu IP Adresă</option>
              <option value="-ip_adresa">Fără IP Adresă</option>
              <option value="mev_key">Cu cheie MEV</option>
              <option value="-mev_key">Fără cheie MEV</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table grid */}
      <div className="glass-panel rounded-2xl border border-slate-200/50 dark:border-slate-800/40 overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-2">
            <Cpu className="w-12 h-12 stroke-1 text-slate-700" />
            <span className="text-sm font-semibold">Nu s-a găsit niciun aparat de casă virtual.</span>
            {canManage && (
              <button
                onClick={() => handleOpenForm()}
                className="mt-2 text-xs font-bold text-sidesi-400 hover:text-sidesi-300 underline"
              >
                Adăugați unul manual
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-slate-700 dark:text-slate-300 text-xs">
              <thead>
                <tr className="border-b border-slate-200/50 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/40 font-bold text-slate-600 dark:text-slate-400 select-none">
                  <th
                    onClick={() => handleSortToggle('oficiu', '-oficiu')}
                    className="p-4 w-24 text-center cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors group"
                    title="Sortează după Oficiu"
                  >
                    <span>Oficiu</span>
                    {renderSortIndicator('oficiu', '-oficiu')}
                  </th>
                  <th
                    onClick={() => handleSortToggle('terminal_id', '-terminal_id')}
                    className="p-4 w-32 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors group"
                    title="Sortează după ID Terminal"
                  >
                    <span>ID Terminal / Factory</span>
                    {renderSortIndicator('terminal_id', '-terminal_id')}
                  </th>
                  <th className="p-4 w-40">Detalii Entitate / IDNO</th>
                  <th className="p-4 w-48">Mev Number</th>
                  <th
                    onClick={() => handleSortToggle('adresa_ecc', '-adresa_ecc')}
                    className="p-4 w-40 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors group"
                    title="Sortează după Adresă"
                  >
                    <span>Adresă ECC</span>
                    {renderSortIndicator('adresa_ecc', '-adresa_ecc')}
                  </th>
                  <th
                    onClick={() => handleSortToggle('ip_adresa', '-ip_adresa')}
                    className="p-4 w-36 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors group"
                    title="Sortează: Cu IP / Fără IP"
                  >
                    <span>IP Adresă</span>
                    {renderSortIndicator('ip_adresa', '-ip_adresa')}
                  </th>
                  <th
                    onClick={() => handleSortToggle('mev_key', '-mev_key')}
                    className="p-4 w-44 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors group"
                    title="Sortează: Cu cheie MEV / Fără cheie MEV"
                  >
                    <span>Cheie MEV</span>
                    {renderSortIndicator('mev_key', '-mev_key')}
                  </th>
                  <th
                    onClick={() => handleSortToggle('status', '-status')}
                    className="p-4 w-36 text-center cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors group"
                    title="Sortează după Statut"
                  >
                    <span>Statut</span>
                    {renderSortIndicator('status', '-status')}
                  </th>
                  <th className="p-4 w-28 text-center">Fișier</th>
                  <th className="p-4 w-20 text-center">Z Raport</th>
                  <th className="p-4 w-24 text-center">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-850">
                {items.map((item) => {
                  const hasComment = Boolean(item.comentarii && item.comentarii.trim());
                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleOpenForm(item)}
                      className={`transition-colors cursor-pointer ${
                        hasComment
                          ? 'bg-purple-500/10 dark:bg-purple-950/25 hover:bg-purple-500/20 dark:hover:bg-purple-950/40 border-l-4 border-l-purple-500'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-900/10'
                      }`}
                    >
                      {/* Oficiu */}
                      <td className="p-4 text-center space-y-1">
                        <span className="inline-block px-2.5 py-1 bg-sidesi-500/15 dark:bg-sidesi-500/20 border border-sidesi-500/40 rounded-lg font-mono font-black text-sidesi-700 dark:text-sidesi-300 text-[11px] uppercase">
                          {item.oficiu}
                        </span>
                        {item.tel_oficiu && (
                          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            <span className="font-mono">{item.tel_oficiu}</span>
                          </div>
                        )}
                      </td>
                      {/* ID Terminal */}
                      <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{item.terminal_id}</span>
                          {hasComment && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-600 dark:text-purple-300 text-[10px] font-sans font-medium"
                              title={item.comentarii || ''}
                            >
                              <MessageSquare className="w-3 h-3 text-purple-500 flex-shrink-0" />
                              <span className="max-w-[120px] truncate hidden sm:inline">{item.comentarii}</span>
                            </span>
                          )}
                        </div>
                      </td>
                    {/* Detalii Entitate / IDNO */}
                    <td className="p-4 space-y-1">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]" title={item.denumire_entitate || ''}>
                        {item.denumire_entitate || '—'}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {item.idno ? `IDNO: ${item.idno}` : '—'}
                      </div>
                    </td>
                    {/* Informatii SFS */}
                    <td className="p-4 space-y-1">
                      <div className="text-slate-400">
                        Mev Number: <span className="font-mono text-slate-900 dark:text-white">{item.nr_inregistrare_sfs || '—'}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Dată: <span className="font-semibold text-slate-400">{item.data_inregistrare || '—'}</span>
                      </div>
                    </td>
                    {/* Adresa ECC */}
                    <td className="p-4 space-y-1">
                      <div className="text-slate-600 dark:text-slate-350 flex items-start gap-1 max-w-xs whitespace-normal break-words" title={item.adresa_ecc || ''}>
                        <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                        <span>{item.adresa_ecc || 'Fără adresă'}</span>
                      </div>
                    </td>
                    {/* IP Adresă */}
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      {item.ip_adresa ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 px-2 py-1 rounded-lg text-cyan-600 dark:text-cyan-400 font-semibold max-w-[120px] truncate">
                            {item.ip_adresa}
                          </span>
                          <button
                            onClick={() => {
                              copyToClipboard(item.ip_adresa || '');
                              addToast('IP copiat în clipboard.', 'success');
                            }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-cyan-400 transition-colors flex-shrink-0"
                            title="Copiază adresa IP"
                          >
                            <ClipboardCopy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] italic text-slate-400 dark:text-slate-600">IP nealocat</span>
                      )}
                    </td>
                    {/* Cheie MEV — always visible with copy button */}
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      {item.plain_mev_key || revealedKeys[item.id] || item.masked_mev_key ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-mono text-[11px] bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 px-2 py-1 rounded-lg text-emerald-600 dark:text-emerald-300 font-semibold select-all max-w-[120px] truncate"
                            title={item.plain_mev_key || revealedKeys[item.id] || 'Cheie MEV'}
                          >
                            {item.plain_mev_key || revealedKeys[item.id] || '••••••••'}
                          </span>

                          <button
                            onClick={() => handleCopyKey(item.id, item.plain_mev_key)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-emerald-400 transition-colors flex-shrink-0"
                            title="Copiază cheia MEV"
                          >
                            <ClipboardCopy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 italic">Lipsă cheie</span>
                      )}
                    </td>
                    {/* Statut switcher */}
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      {canManage ? (
                        <select
                          value={item.status}
                          onChange={(e) => handleQuickStatusChange(item, e.target.value as any)}
                          className={`text-[10px] font-extrabold rounded-full px-2.5 py-1 border transition-colors cursor-pointer select-none bg-slate-100 dark:bg-slate-900 focus:outline-none ${
                            item.status === 'pus_in_exploatare'
                              ? 'text-emerald-400 border-emerald-500/30 hover:border-emerald-400'
                              : item.status === 'certificat'
                              ? 'text-blue-400 border-blue-500/30 hover:border-blue-400'
                              : item.status === 'in_certificare'
                              ? 'text-amber-400 border-amber-500/30 hover:border-amber-400'
                              : item.status === 'aplicatie_instalata'
                              ? 'text-orange-400 border-orange-500/30 hover:border-orange-400'
                              : item.status === 'eroare_certificare'
                              ? 'text-pink-400 border-pink-500/30 hover:border-pink-400'
                              : 'text-rose-400 border-rose-500/30 hover:border-rose-400'
                          }`}
                        >
                          <option value="neconfigurat" className="text-rose-400 bg-white dark:bg-slate-950 font-bold">Neconfigurat</option>
                          <option value="aplicatie_instalata" className="text-orange-400 bg-white dark:bg-slate-950 font-bold">Aplicație instalată</option>
                          <option value="in_certificare" className="text-amber-400 bg-white dark:bg-slate-950 font-bold">În certificare</option>
                          <option value="certificat" className="text-blue-400 bg-white dark:bg-slate-950 font-bold">Certificat</option>
                          <option value="eroare_certificare" className="text-pink-400 bg-white dark:bg-slate-950 font-bold">Eroare la certificare</option>
                          <option value="pus_in_exploatare" className="text-emerald-400 bg-white dark:bg-slate-950 font-bold">Pus în exploatare</option>
                        </select>
                      ) : (
                        <span className={`inline-block text-[10px] font-extrabold rounded-full px-2.5 py-0.5 border ${
                          item.status === 'pus_in_exploatare'
                            ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
                            : item.status === 'certificat'
                            ? 'text-blue-400 border-blue-500/20 bg-blue-500/5'
                            : item.status === 'in_certificare'
                            ? 'text-amber-400 border-amber-500/20 bg-amber-500/5'
                            : item.status === 'aplicatie_instalata'
                            ? 'text-orange-400 border-orange-500/20 bg-orange-500/5'
                            : item.status === 'eroare_certificare'
                            ? 'text-pink-400 border-pink-500/20 bg-pink-500/5'
                            : 'text-rose-400 border-rose-500/20 bg-rose-500/5'
                        }`}>
                          {item.status === 'pus_in_exploatare'
                            ? 'Pus în exploatare'
                            : item.status === 'certificat'
                            ? 'Certificat'
                            : item.status === 'in_certificare'
                            ? 'În certificare'
                            : item.status === 'aplicatie_instalata'
                            ? 'Aplicație instalată'
                            : item.status === 'eroare_certificare'
                            ? 'Eroare la certificare'
                            : 'Neconfigurat'}
                        </span>
                      )}
                    </td>
                    {/* Fisier PDF */}
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      {item.pdf_file ? (
                        <button
                          onClick={() => handleDownloadPdf(item)}
                          className="glass-button-secondary py-1 px-2.5 text-[10px] flex items-center gap-1 mx-auto hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Download className="w-3 h-3 text-slate-400" />
                          <span>PDF</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">—</span>
                      )}
                    </td>
                    {/* Z Raport checkbox */}
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={item.z_raport}
                        onChange={() => handleToggleZRaport(item)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-sidesi-500 focus:ring-sidesi-400 cursor-pointer"
                        title="Z Raport"
                      />
                    </td>
                    {/* Actiuni */}
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenForm(item)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                          title="Editare"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {canManage && (
                          <button
                            onClick={() => setDeleteTarget(item.id)}
                            className="p-1.5 hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
                            title="Ștergere"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-800/40 pt-4">
          <span className="text-xs text-slate-400 font-semibold">
            Pagina {currentPage} din {totalPages} (Total {totalCount} înregistrări)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 glass-button-secondary disabled:opacity-30 disabled:pointer-events-none rounded-xl"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {getPageNumbers().map((p, idx) => (
              <button
                key={idx}
                onClick={() => typeof p === 'number' && setCurrentPage(p)}
                disabled={p === '...' || p === currentPage}
                className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${
                  p === currentPage
                    ? 'bg-sidesi-500 text-white shadow-md shadow-sidesi-500/10'
                    : p === '...'
                    ? 'text-slate-400 dark:text-slate-600 cursor-default'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 glass-button-secondary disabled:opacity-30 disabled:pointer-events-none rounded-xl"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Unified View / Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 dark:bg-slate-950/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-2xl glass-panel rounded-2xl z-10 overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800/60 max-h-[92vh] flex flex-col">

            {/* Modal Header — same style as detail popup */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800/60 flex items-center justify-between flex-shrink-0 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${editingItem ? 'bg-sidesi-500/15 dark:bg-sidesi-500/20 border border-sidesi-500/30' : 'bg-emerald-500/15 border border-emerald-500/30'}`}>
                  <Cpu className={`w-5 h-5 ${editingItem ? 'text-sidesi-500' : 'text-emerald-500'}`} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    {editingItem ? formTerminalId || editingItem.terminal_id : 'Aparat Nou'}
                  </h2>
                  {editingItem ? (
                    <span
                      onClick={!isEditMode && editingItem.oficiu ? () => { copyToClipboard(editingItem.oficiu); addToast('Oficiu copiat.', 'success'); } : undefined}
                      className={`inline-block mt-0.5 px-2 py-0.5 bg-sidesi-500/15 dark:bg-sidesi-500/20 border border-sidesi-500/40 rounded-md font-mono font-bold text-sidesi-700 dark:text-sidesi-300 text-[10px] uppercase ${!isEditMode ? 'cursor-pointer hover:border-sidesi-500 hover:bg-sidesi-500/25 transition-all' : ''}`}
                      title={!isEditMode ? 'Apasă pentru a copia oficiul' : undefined}
                    >
                      {editingItem.oficiu}
                    </span>
                  ) : (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Completează câmpurile pentru a adăuga un echipament nou</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Quick MEV Links & Password — same as detail popup */}
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-900/20 flex flex-wrap items-center gap-2">
              {MEV_QUICK_LINKS.map((link) => (
                <button
                  key={link.value}
                  type="button"
                  onClick={() => {
                    copyToClipboard(link.value);
                    addToast(`${link.label} copiat în clipboard.`, 'success');
                  }}
                  title={`Copiază: ${link.value}`}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sidesi-400 dark:hover:border-sidesi-500 transition-colors group"
                >
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">{link.label}:</span>
                  <span className="font-mono text-[10px] text-cyan-600 dark:text-cyan-400 truncate max-w-[140px]">{link.value}</span>
                  <ClipboardCopy className="w-3 h-3 text-slate-400 group-hover:text-sidesi-400 flex-shrink-0" />
                </button>
              ))}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <KeyRound className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Parolă:</span>
                <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 min-w-[80px]">
                  {isMevPasswordRevealed ? MEV_QUICK_PASSWORD : '•'.repeat(MEV_QUICK_PASSWORD.length)}
                </span>
                <button
                  type="button"
                  onClick={() => setIsMevPasswordRevealed((prev) => !prev)}
                  title={isMevPasswordRevealed ? 'Ascunde' : 'Dezvăluie'}
                  className="p-0.5 text-slate-400 hover:text-emerald-400 transition-colors flex-shrink-0"
                >
                  {isMevPasswordRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    copyToClipboard(MEV_QUICK_PASSWORD);
                    addToast('Parolă MEV copiată.', 'success');
                  }}
                  title="Copiază parola"
                  className="p-0.5 text-slate-400 hover:text-emerald-400 transition-colors flex-shrink-0"
                >
                  <ClipboardCopy className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Modal Body — editable 2-column card grid */}
            <form onSubmit={handleSaveForm} className="flex-grow overflow-y-auto p-5 space-y-3">

              {/* Row 1: Cheie MEV (editable) | MEV Number (editable) */}
              <div className="grid grid-cols-2 gap-3">
                {/* Cheie MEV — editable with show/hide */}
                <div
                  onClick={!isEditMode && formMevKey ? () => { copyToClipboard(formMevKey); addToast('Cheie MEV copiată.', 'success'); } : undefined}
                  className={`p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 space-y-1.5 ${!isEditMode && formMevKey ? 'cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-100/40 dark:hover:bg-emerald-900/30 transition-all' : ''}`}
                  title={!isEditMode && formMevKey ? 'Apasă pentru a copia' : undefined}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">Cheie MEV</div>
                    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setShowMevKey(prev => !prev)}
                        className="p-0.5 text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-500 transition-colors"
                        title={showMevKey ? 'Ascunde' : 'Afișează'}
                      >
                        {showMevKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (formMevKey) { copyToClipboard(formMevKey); addToast('Cheie MEV copiată.', 'success'); } }}
                        className="p-0.5 text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Copiază"
                        disabled={!formMevKey}
                      >
                        <ClipboardCopy className="w-3.5 h-3.5" />
                      </button>
                      {isEditMode && canManage && (editingItem?.plain_mev_key || editingItem?.masked_mev_key) && !deleteMevKey && (
                        <button
                          type="button"
                          onClick={() => { setDeleteMevKey(true); setFormMevKey(''); }}
                          className="p-0.5 text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-500 transition-colors"
                          title="Șterge cheia"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type={showMevKey ? 'text' : 'password'}
                    value={formMevKey}
                    onChange={(e) => {
                      setFormMevKey(e.target.value);
                      if (e.target.value) setDeleteMevKey(false);
                    }}
                    placeholder={deleteMevKey ? 'Cheia va fi ștearsă' : (editingItem ? 'Cheia MEV' : 'Introdu cheia MEV')}
                    className={`w-full bg-transparent border-0 border-b border-emerald-300 dark:border-emerald-800/40 font-mono text-emerald-700 dark:text-emerald-300 text-sm focus:outline-none focus:border-emerald-500 px-0 py-1 ${!isEditMode ? 'pointer-events-none' : ''}`}
                    readOnly={!isEditMode}
                    disabled={deleteMevKey}
                  />
                  {deleteMevKey && (
                    <div className="flex items-center gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
                      <AlertTriangle className="w-3 h-3 text-rose-400 flex-shrink-0" />
                      <span className="text-[10px] text-rose-500 font-semibold flex-1">Cheia va fi ștearsă!</span>
                      <button
                        type="button"
                        onClick={() => setDeleteMevKey(false)}
                        className="text-[9px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        Anulează
                      </button>
                    </div>
                  )}
                </div>

                {/* MEV Number — editable */}
                <div
                  onClick={!isEditMode && formNrInregistrare ? () => { copyToClipboard(formNrInregistrare); addToast('MEV Number copiat.', 'success'); } : undefined}
                  className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60 space-y-1.5 ${!isEditMode && formNrInregistrare ? 'cursor-pointer hover:border-sidesi-400 dark:hover:border-sidesi-500 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all' : ''}`}
                  title={!isEditMode && formNrInregistrare ? 'Apasă pentru a copia' : undefined}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">MEV Number</div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (formNrInregistrare) { copyToClipboard(formNrInregistrare); addToast('MEV Number copiat.', 'success'); }
                      }}
                      className="p-0.5 text-slate-500 hover:text-sidesi-500 dark:text-slate-400 dark:hover:text-sidesi-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Copiază"
                      disabled={!formNrInregistrare}
                    >
                      <ClipboardCopy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formNrInregistrare}
                    onChange={(e) => setFormNrInregistrare(e.target.value)}
                    placeholder="S01702011189"
                    className={`w-full bg-transparent border-0 border-b border-slate-300 dark:border-slate-700 font-mono text-slate-900 dark:text-white text-sm focus:outline-none focus:border-sidesi-500 px-0 py-1 ${!isEditMode ? 'pointer-events-none' : ''}`}
                    readOnly={!isEditMode}
                  />
                </div>
              </div>

              {/* Row 2: Factory / ID Terminal (editable) | IDNO (editable) */}
              <div className="grid grid-cols-2 gap-3">
                {/* Factory / ID Terminal */}
                <div
                  onClick={!isEditMode && formTerminalId ? () => { copyToClipboard(formTerminalId); addToast('ID Terminal copiat.', 'success'); } : undefined}
                  className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60 space-y-1.5 ${!isEditMode && formTerminalId ? 'cursor-pointer hover:border-sidesi-400 dark:hover:border-sidesi-500 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all' : ''}`}
                  title={!isEditMode && formTerminalId ? 'Apasă pentru a copia' : undefined}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Factory / ID Terminal <span className="text-rose-500">*</span></div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (formTerminalId) { copyToClipboard(formTerminalId); addToast('ID Terminal copiat.', 'success'); }
                      }}
                      className="p-0.5 text-slate-500 hover:text-sidesi-500 dark:text-slate-400 dark:hover:text-sidesi-400 transition-colors"
                      title="Copiază"
                    >
                      <ClipboardCopy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={formTerminalId}
                    onChange={(e) => setFormTerminalId(e.target.value)}
                    placeholder="OP206001"
                    className={`w-full bg-transparent border-0 border-b border-slate-300 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white text-sm focus:outline-none focus:border-sidesi-500 px-0 py-1 uppercase ${!isEditMode ? 'pointer-events-none' : ''}`}
                    readOnly={!isEditMode}
                  />
                </div>

                {/* IDNO */}
                <div
                  onClick={!isEditMode && formIdno ? () => { copyToClipboard(formIdno); addToast('IDNO copiat.', 'success'); } : undefined}
                  className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60 space-y-1.5 ${!isEditMode && formIdno ? 'cursor-pointer hover:border-sidesi-400 dark:hover:border-sidesi-500 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all' : ''}`}
                  title={!isEditMode && formIdno ? 'Apasă pentru a copia' : undefined}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">IDNO</div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (formIdno) { copyToClipboard(formIdno); addToast('IDNO copiat.', 'success'); }
                      }}
                      className="p-0.5 text-slate-500 hover:text-sidesi-500 dark:text-slate-400 dark:hover:text-sidesi-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Copiază"
                      disabled={!formIdno}
                    >
                      <ClipboardCopy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formIdno}
                    onChange={(e) => setFormIdno(e.target.value)}
                    placeholder="1002600023242"
                    className={`w-full bg-transparent border-0 border-b border-slate-300 dark:border-slate-700 font-mono text-slate-900 dark:text-white text-sm focus:outline-none focus:border-sidesi-500 px-0 py-1 ${!isEditMode ? 'pointer-events-none' : ''}`}
                    readOnly={!isEditMode}
                  />
                </div>
              </div>

              {/* Row 3: Denumire Entitate (editable) | Adresă ECC (editable) */}
              <div className="grid grid-cols-2 gap-3">
                {/* Denumire Entitate */}
                <div
                  onClick={!isEditMode && formDenumireEntitate ? () => { copyToClipboard(formDenumireEntitate); addToast('Denumire copiată.', 'success'); } : undefined}
                  className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60 space-y-1.5 ${!isEditMode && formDenumireEntitate ? 'cursor-pointer hover:border-sidesi-400 dark:hover:border-sidesi-500 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all' : ''}`}
                  title={!isEditMode && formDenumireEntitate ? 'Apasă pentru a copia' : undefined}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Denumire Entitate</div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (formDenumireEntitate) { copyToClipboard(formDenumireEntitate); addToast('Denumire copiată.', 'success'); }
                      }}
                      className="p-0.5 text-slate-500 hover:text-sidesi-500 dark:text-slate-400 dark:hover:text-sidesi-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Copiază"
                      disabled={!formDenumireEntitate}
                    >
                      <ClipboardCopy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formDenumireEntitate}
                    onChange={(e) => setFormDenumireEntitate(e.target.value)}
                    placeholder="POSTA MOLDOVEI I.S."
                    className={`w-full bg-transparent border-0 border-b border-slate-300 dark:border-slate-700 font-semibold text-slate-900 dark:text-white text-sm focus:outline-none focus:border-sidesi-500 px-0 py-1 ${!isEditMode ? 'pointer-events-none' : ''}`}
                    readOnly={!isEditMode}
                  />
                </div>

                {/* Adresă ECC */}
                <div
                  onClick={!isEditMode && formAdresaEcc ? () => { copyToClipboard(formAdresaEcc); addToast('Adresă copiată.', 'success'); } : undefined}
                  className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60 space-y-1.5 ${!isEditMode && formAdresaEcc ? 'cursor-pointer hover:border-sidesi-400 dark:hover:border-sidesi-500 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all' : ''}`}
                  title={!isEditMode && formAdresaEcc ? 'Apasă pentru a copia' : undefined}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Adresă ECC</div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (formAdresaEcc) { copyToClipboard(formAdresaEcc); addToast('Adresă copiată.', 'success'); }
                      }}
                      className="p-0.5 text-slate-500 hover:text-sidesi-500 dark:text-slate-400 dark:hover:text-sidesi-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Copiază"
                      disabled={!formAdresaEcc}
                    >
                      <ClipboardCopy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={formAdresaEcc}
                    onChange={(e) => setFormAdresaEcc(e.target.value)}
                    placeholder="Adresa amplasării..."
                    rows={1}
                    className={`w-full bg-transparent border-0 border-b border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-sidesi-500 px-0 py-1 resize-none leading-snug ${!isEditMode ? 'pointer-events-none' : ''}`}
                    readOnly={!isEditMode}
                  />
                </div>
              </div>

              {/* Row 4: IP Adresă (editable) | Telefon Oficiu (editable) */}
              <div className="grid grid-cols-2 gap-3">
                {/* IP Adresă */}
                <div
                  onClick={!isEditMode && formIpAdresa ? () => { copyToClipboard(formIpAdresa); addToast('IP copiat.', 'success'); } : undefined}
                  className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60 space-y-1.5 ${!isEditMode && formIpAdresa ? 'cursor-pointer hover:border-cyan-400 dark:hover:border-cyan-500 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all' : ''}`}
                  title={!isEditMode && formIpAdresa ? 'Apasă pentru a copia' : undefined}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">IP Adresă</div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (formIpAdresa) { copyToClipboard(formIpAdresa); addToast('IP copiat.', 'success'); }
                      }}
                      className="p-0.5 text-slate-500 hover:text-cyan-500 dark:text-slate-400 dark:hover:text-cyan-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Copiază"
                      disabled={!formIpAdresa}
                    >
                      <ClipboardCopy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formIpAdresa}
                    onChange={(e) => setFormIpAdresa(e.target.value)}
                    placeholder="192.168.100.45"
                    className={`w-full bg-transparent border-0 border-b border-slate-300 dark:border-slate-700 font-mono text-cyan-700 dark:text-cyan-400 text-sm focus:outline-none focus:border-cyan-500 px-0 py-1 ${!isEditMode ? 'pointer-events-none' : ''}`}
                    readOnly={!isEditMode}
                  />
                </div>

                {/* Telefon Oficiu */}
                <div
                  onClick={!isEditMode && formTelOficiu ? () => { copyToClipboard(formTelOficiu); addToast('Telefon copiat.', 'success'); } : undefined}
                  className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60 space-y-1.5 ${!isEditMode && formTelOficiu ? 'cursor-pointer hover:border-sidesi-400 dark:hover:border-sidesi-500 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all' : ''}`}
                  title={!isEditMode && formTelOficiu ? 'Apasă pentru a copia' : undefined}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Telefon Oficiu</div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (formTelOficiu) { copyToClipboard(formTelOficiu); addToast('Telefon copiat.', 'success'); }
                      }}
                      className="p-0.5 text-slate-500 hover:text-sidesi-500 dark:text-slate-400 dark:hover:text-sidesi-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Copiază"
                      disabled={!formTelOficiu}
                    >
                      <ClipboardCopy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formTelOficiu}
                    onChange={(e) => setFormTelOficiu(e.target.value)}
                    placeholder="022123456"
                    className={`w-full bg-transparent border-0 border-b border-slate-300 dark:border-slate-700 font-mono text-slate-900 dark:text-white text-sm focus:outline-none focus:border-sidesi-500 px-0 py-1 ${!isEditMode ? 'pointer-events-none' : ''}`}
                    readOnly={!isEditMode}
                  />
                </div>
              </div>

              {/* Row 5: Model ECC | Nr. Ordine */}
              <div className="grid grid-cols-2 gap-3">
                {/* Model ECC */}
                <div
                  onClick={!isEditMode && formModelEcc ? () => { copyToClipboard(formModelEcc); addToast('Model ECC copiat.', 'success'); } : undefined}
                  className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60 space-y-1.5 ${!isEditMode && formModelEcc ? 'cursor-pointer hover:border-sidesi-400 dark:hover:border-sidesi-500 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all' : ''}`}
                  title={!isEditMode && formModelEcc ? 'Apasă pentru a copia' : undefined}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Model ECC</div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (formModelEcc) { copyToClipboard(formModelEcc); addToast('Model ECC copiat.', 'success'); }
                      }}
                      className="p-0.5 text-slate-500 hover:text-sidesi-500 dark:text-slate-400 dark:hover:text-sidesi-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Copiază"
                      disabled={!formModelEcc}
                    >
                      <ClipboardCopy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formModelEcc}
                    onChange={(e) => setFormModelEcc(e.target.value)}
                    placeholder="Factura Client"
                    className={`w-full bg-transparent border-0 border-b border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-sidesi-500 px-0 py-1 ${!isEditMode ? 'pointer-events-none' : ''}`}
                    readOnly={!isEditMode}
                  />
                </div>

                {/* Nr. Ordine */}
                <div
                  onClick={!isEditMode && formNrOrdine ? () => { copyToClipboard(formNrOrdine); addToast('Nr. Ordine copiat.', 'success'); } : undefined}
                  className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60 space-y-1.5 ${!isEditMode && formNrOrdine ? 'cursor-pointer hover:border-sidesi-400 dark:hover:border-sidesi-500 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all' : ''}`}
                  title={!isEditMode && formNrOrdine ? 'Apasă pentru a copia' : undefined}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nr. Ordine</div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (formNrOrdine) { copyToClipboard(formNrOrdine); addToast('Nr. Ordine copiat.', 'success'); }
                      }}
                      className="p-0.5 text-slate-500 hover:text-sidesi-500 dark:text-slate-400 dark:hover:text-sidesi-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Copiază"
                      disabled={!formNrOrdine}
                    >
                      <ClipboardCopy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formNrOrdine}
                    onChange={(e) => setFormNrOrdine(e.target.value)}
                    placeholder="1"
                    className={`w-full bg-transparent border-0 border-b border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-sidesi-500 px-0 py-1 ${!isEditMode ? 'pointer-events-none' : ''}`}
                    readOnly={!isEditMode}
                  />
                </div>
              </div>

              {/* Row 6: Data Înregistrare | Statut */}
              <div className="grid grid-cols-2 gap-3">
                {/* Data Înregistrare */}
                <div
                  onClick={!isEditMode && formDataInregistrare ? () => { copyToClipboard(formDataInregistrare); addToast('Data copiată.', 'success'); } : undefined}
                  className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60 space-y-1.5 ${!isEditMode && formDataInregistrare ? 'cursor-pointer hover:border-sidesi-400 dark:hover:border-sidesi-500 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all' : ''}`}
                  title={!isEditMode && formDataInregistrare ? 'Apasă pentru a copia' : undefined}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data Înregistrare</div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (formDataInregistrare) { copyToClipboard(formDataInregistrare); addToast('Data copiată.', 'success'); }
                      }}
                      className="p-0.5 text-slate-500 hover:text-sidesi-500 dark:text-slate-400 dark:hover:text-sidesi-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Copiază"
                      disabled={!formDataInregistrare}
                    >
                      <ClipboardCopy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="date"
                    value={formDataInregistrare}
                    onChange={(e) => setFormDataInregistrare(e.target.value)}
                    className={`w-full bg-transparent border-0 border-b border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-sidesi-500 px-0 py-1 ${!isEditMode ? 'pointer-events-none' : ''}`}
                    readOnly={!isEditMode}
                  />
                </div>

                {/* Statut — dropdown & Z Raport */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Statut</div>
                    <label className={`flex items-center gap-1.5 select-none ${isEditMode ? 'cursor-pointer' : ''}`}>
                      <input
                        type="checkbox"
                        checked={formZRaport}
                        onChange={(e) => isEditMode && setFormZRaport(e.target.checked)}
                        disabled={!isEditMode}
                        className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-sidesi-500 focus:ring-sidesi-400 cursor-pointer disabled:cursor-default"
                      />
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Z Raport</span>
                    </label>
                  </div>
                  <select
                    value={formStatus}
                    onChange={(e) => handleFormStatusChange(e.target.value as any)}
                    className="w-full bg-transparent dark:bg-transparent border-0 border-b border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-sidesi-500 px-0 py-1 cursor-pointer"
                    disabled={!isEditMode}
                  >
                    <option value="neconfigurat" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Neconfigurat</option>
                    <option value="aplicatie_instalata" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Aplicație instalată</option>
                    <option value="in_certificare" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">În certificare</option>
                    <option value="certificat" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Certificat</option>
                    <option value="eroare_certificare" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Eroare la certificare</option>
                    <option value="pus_in_exploatare" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Pus în exploatare</option>
                  </select>
                </div>
              </div>

              {/* Row 6b: Raion selector */}
              <div className="p-3 rounded-xl bg-sidesi-50/40 dark:bg-sidesi-950/20 border border-sidesi-200/60 dark:border-sidesi-800/40 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-sidesi-500" />
                  <div className="text-[10px] font-bold text-sidesi-600 dark:text-sidesi-400 uppercase tracking-wider">Raion</div>
                </div>
                {isEditMode ? (
                  <select
                    value={formRaionId}
                    onChange={e => setFormRaionId(e.target.value)}
                    className="w-full glass-input text-sm"
                  >
                    <option value="">— Nealocat —</option>
                    {raionStats.raioane.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm py-1">
                    {formRaionId ? (
                      (() => {
                        const r = raionStats.raioane.find(x => x.id === formRaionId);
                        return r ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-white text-xs" style={{ backgroundColor: r.color }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                            {r.name} <span className="opacity-70 font-medium">({r.code})</span>
                          </span>
                        ) : <span className="text-slate-400 text-xs italic">Raion necunoscut</span>;
                      })()
                    ) : (
                      <span className="text-slate-400 dark:text-slate-600 italic text-xs">Nealocat</span>
                    )}
                  </div>
                )}
              </div>

              {/* Row 7: Comentarii / Note (full width, violet theme) */}

              <div
                onClick={!isEditMode && formComentarii ? () => { copyToClipboard(formComentarii); addToast('Comentariu copiat.', 'success'); } : undefined}
                className={`p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-800/40 space-y-1.5 ${!isEditMode && formComentarii ? 'cursor-pointer hover:border-purple-400 dark:hover:border-purple-600 hover:bg-purple-100/40 dark:hover:bg-purple-900/30 transition-all' : ''}`}
                title={!isEditMode && formComentarii ? 'Apasă pentru a copia' : undefined}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-purple-500" />
                    <div className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                      Comentarii / Note
                    </div>
                  </div>
                  {formComentarii && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(formComentarii);
                        addToast('Comentariu copiat.', 'success');
                      }}
                      className="p-0.5 text-purple-500 hover:text-purple-600 dark:text-purple-400 transition-colors"
                      title="Copiază comentariul"
                    >
                      <ClipboardCopy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {isEditMode ? (
                  <textarea
                    value={formComentarii}
                    onChange={(e) => setFormComentarii(e.target.value)}
                    placeholder="Scrie comentarii sau note pentru această cartelă..."
                    rows={2}
                    className="w-full bg-transparent border-0 border-b border-purple-300 dark:border-purple-800/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-purple-500 px-0 py-1 resize-y leading-snug placeholder-purple-400/50 dark:placeholder-purple-400/30"
                  />
                ) : (
                  <div
                    className={`text-sm px-0 py-1 min-h-[28px] ${formComentarii ? 'whitespace-pre-wrap text-purple-950 dark:text-purple-200 font-medium' : 'text-slate-400 dark:text-slate-600 italic text-xs'}`}
                  >
                    {formComentarii || 'Fără comentarii'}
                  </div>
                )}
              </div>

              {/* Row 8: PDF File (full width) */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60">
                <Upload className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Fișier PDF</div>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] truncate block">
                    {formPdfFile ? formPdfFile.name : editingItem?.pdf_file ? 'Fișier existent pe server' : 'Niciun fișier selectat'}
                  </span>
                </div>
                {isEditMode && canManage && (
                  <>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setFormPdfFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="modal-pdf-file"
                    />
                    <label
                      htmlFor="modal-pdf-file"
                      className="glass-button-secondary py-1.5 px-3 text-[11px] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5 text-slate-400" />
                      <span>Alege PDF</span>
                    </label>
                  </>
                )}
                {editingItem?.pdf_file && (
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(editingItem)}
                    className="glass-button-secondary py-1.5 px-3 text-[11px] flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>Descarcă</span>
                  </button>
                )}
              </div>
            </form>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between flex-shrink-0 bg-slate-50/50 dark:bg-slate-900/30">
              <span className="text-[10px] text-slate-400">
                {editingItem ? `Data înregistrării: ${formDataInregistrare || '—'}` : 'Câmpurile marcate cu * sunt obligatorii'}
              </span>
              <div className="flex gap-2.5">
                {editingItem && isEditMode ? (
                  // Edit mode: Anulează (back to view) + Salvează
                  <>
                    <button
                      type="button"
                      onClick={() => setIsEditMode(false)}
                      className="glass-button-secondary py-2.5 px-5 text-xs font-semibold"
                    >
                      Anulează
                    </button>
                    <button
                      type="submit"
                      onClick={handleSaveForm}
                      className="glass-button-primary py-2.5 px-6 text-xs font-semibold"
                    >
                      Salvează
                    </button>
                  </>
                ) : editingItem && !isEditMode ? (
                  // View mode: Editează + Închide
                  <>
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="glass-button-secondary py-2.5 px-5 text-xs font-semibold"
                    >
                      Închide
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setIsEditMode(true)}
                        className="glass-button-primary py-2.5 px-6 text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Editează
                      </button>
                    )}
                  </>
                ) : (
                  // New item mode: Anulează + Creează
                  <>
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="glass-button-secondary py-2.5 px-5 text-xs font-semibold"
                    >
                      Anulează
                    </button>
                    <button
                      type="submit"
                      onClick={handleSaveForm}
                      className="glass-button-primary py-2.5 px-6 text-xs font-semibold"
                    >
                      Creează
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import PDF Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 dark:bg-slate-950/80 backdrop-blur-sm" onClick={() => !isImporting && setIsImportOpen(false)} />
          <div className="relative w-full max-w-xl glass-panel rounded-2xl z-10 overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800/60 max-h-[90vh] flex flex-col">
            
            <div className="p-5 border-b border-slate-200 dark:border-slate-850 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-5.5 h-5.5 text-sidesi-400" />
                Importare Cartele Înregistrare PDF
              </h2>
              <button
                onClick={() => !isImporting && setIsImportOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                disabled={isImporting}
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-grow">
              {/* Live Progress Bar — shown during batch import */}
              {isImporting && batchProgress.total > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold">Se procesează loturi...</span>
                    <span className="font-mono text-sidesi-400 font-bold">
                      {batchProgress.done} / {batchProgress.total} cartele
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sidesi-500 to-emerald-500 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${Math.round((batchProgress.done / batchProgress.total) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 text-center">
                    Lot {Math.ceil(batchProgress.done / 20)} din {Math.ceil(batchProgress.total / 20)} — Nu închideți fereastra
                  </p>
                </div>
              )}

              {importResult ? (
                // Import result breakdown
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 space-y-3">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Rezumat Procesare Cartele</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center">
                        <div className="text-[10px] uppercase opacity-75 font-semibold">Procesate cu succes</div>
                        <div className="text-2xl font-black mt-1">{importResult.success.length}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-center">
                        <div className="text-[10px] uppercase opacity-75 font-semibold">Eșuate / Eroare</div>
                        <div className="text-2xl font-black mt-1">{importResult.failed.length}</div>
                      </div>
                    </div>
                  </div>

                  {/* List of processed / updated items */}
                  {importResult.success.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide px-1">Importate cu succes</h5>
                      <div className="max-h-36 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-xl space-y-1.5 scrollbar-thin">
                        {importResult.success.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px] p-2 bg-slate-100 dark:bg-slate-900/30 rounded-lg">
                            <span className="font-mono text-slate-900 dark:text-white truncate max-w-[150px]" title={item.filename}>{item.filename}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-bold bg-slate-200 dark:bg-slate-850 px-1.5 py-0.5 rounded">
                                ID: {item.terminal_id}
                              </span>
                              <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded ${
                                item.action === 'created' ? 'text-emerald-400 bg-emerald-950/20' : 'text-cyan-400 bg-cyan-950/20'
                              }`}>
                                {item.action === 'created' ? 'Adăugat' : 'Actualizat'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* List of failed items */}
                  {importResult.failed.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wide px-1">Fișiere eșuate</h5>
                      <div className="max-h-36 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-xl space-y-1.5 scrollbar-thin">
                        {importResult.failed.map((item, idx) => (
                          <div key={idx} className="text-[11px] p-2 bg-rose-50 dark:bg-rose-950/15 border border-rose-200 dark:border-rose-950/30 rounded-lg space-y-1">
                            <div className="font-mono text-rose-600 dark:text-rose-300 truncate font-semibold" title={item.filename}>{item.filename}</div>
                            <div className="text-[10px] text-rose-500 dark:text-rose-400 font-sans">{item.error}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-850">
                    <button
                      onClick={() => {
                        setIsImportOpen(false);
                        setImportFiles([]);
                        setImportResult(null);
                      }}
                      className="glass-button-primary py-2 px-6 text-xs font-semibold"
                    >
                      Finalizează
                    </button>
                  </div>
                </div>
              ) : (
                // PDF Drag & Drop interface
                <div className="space-y-4">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60 rounded-xl flex items-start gap-2.5">
                    <Info className="w-5 h-5 text-sidesi-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                      Sistemul va procesa fișierele PDF încărcate, extrăgând automat datele precum ID-ul terminalului, modelul, IDNO-ul, denumirea entității, numărul de ordine, data înregistrării și oficiul (extras automat din primii 6 caractere ai terminalului).
                    </p>
                  </div>
                  {/* Raion selector for import */}
                  {raionStats.raioane.length > 0 && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-sidesi-50/40 dark:bg-sidesi-950/20 border border-sidesi-200/60 dark:border-sidesi-800/40">
                      <MapPin className="w-4 h-4 text-sidesi-400 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-[10px] font-bold text-sidesi-600 dark:text-sidesi-400 uppercase tracking-wider mb-1">Alocă în Raion (opțional)</div>
                        <select
                          value={importRaionId}
                          onChange={e => setImportRaionId(e.target.value)}
                          className="w-full glass-input text-xs"
                        >
                          <option value="">— Nealocat (implicit) —</option>
                          {raionStats.raioane.map(r => (
                            <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Drag drop zone */}

                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all select-none ${
                      isDragging
                        ? 'border-sidesi-400 bg-sidesi-500/10'
                        : 'border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/10'
                    }`}
                  >
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      id="bulk-pdf-files"
                      disabled={isImporting}
                    />
                    <label htmlFor="bulk-pdf-files" className="flex flex-col items-center gap-2.5 cursor-pointer">
                      {isImporting ? (
                        <Loader2 className="w-9 h-9 text-sidesi-400 animate-spin" />
                      ) : (
                        <Upload className="w-9 h-9 text-sidesi-400 animate-bounce" />
                      )}
                      <span className="text-slate-700 dark:text-slate-300 font-bold text-xs">
                        Faceți click sau trageți fișierele PDF aici
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Puteți selecta mai multe cartele de înregistrare PDF deodată
                      </span>
                    </label>
                  </div>

                  {/* File list queuing */}
                  {importFiles.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-400 px-1">
                        <span>Fișiere selectate:</span>
                        <span>{importFiles.length} cartele</span>
                      </div>
                      <div className="max-h-40 overflow-y-auto p-1.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-xl space-y-1 scrollbar-thin">
                        {importFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px] p-2 bg-slate-100 dark:bg-slate-900/40 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-850 transition-colors">
                            <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[320px]" title={file.name}>
                              {file.name}
                            </span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[10px] text-slate-500 dark:text-slate-500 font-mono">
                                ({(file.size / 1024).toFixed(0)} KB)
                              </span>
                              {!isImporting && (
                                <button
                                  onClick={() => handleRemoveImportFile(idx)}
                                  className="p-1 hover:bg-rose-500/10 rounded text-slate-500 hover:text-rose-400 transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-850">
                    <button
                      type="button"
                      onClick={() => setIsImportOpen(false)}
                      className="glass-button-secondary py-2.5 px-5 text-xs font-semibold"
                      disabled={isImporting}
                    >
                      Anulează
                    </button>
                    <button
                      type="button"
                      onClick={handleStartImport}
                      className="glass-button-primary py-2.5 px-6 text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-sidesi-500/10"
                      disabled={isImporting || importFiles.length === 0}
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Se importă...</span>
                        </>
                      ) : (
                        <span>Procesează fișierele</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {isExportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 dark:bg-slate-950/80 backdrop-blur-sm" onClick={() => !isExporting && setIsExportOpen(false)} />
          <div className="relative w-full max-w-lg glass-panel rounded-2xl z-10 overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800/60 max-h-[90vh] flex flex-col">

            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-850 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileDown className="w-5 h-5 text-sidesi-400" />
                Export Excel
              </h2>
              <button
                onClick={() => !isExporting && setIsExportOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5 overflow-y-auto">

              {/* Filters Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-sidesi-400" /> Filtrare Date
                </h3>

                {/* Office filter (multi-select via checkboxes) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Oficii</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setExportOficii(officeList)}
                        className="text-[9px] text-sidesi-500 hover:text-sidesi-400 font-bold uppercase"
                      >Toate</button>
                      <button
                        type="button"
                        onClick={() => setExportOficii([])}
                        className="text-[9px] text-slate-400 hover:text-slate-500 font-bold uppercase"
                      >Niciunul</button>
                    </div>
                  </div>
                  <div className="max-h-32 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60 rounded-xl grid grid-cols-2 gap-1.5 scrollbar-thin">
                    {officeList.map(office => (
                      <label key={office} className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={exportOficii.includes(office)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setExportOficii(prev => [...prev, office]);
                            } else {
                              setExportOficii(prev => prev.filter(o => o !== office));
                            }
                          }}
                          className="rounded border-slate-300 dark:border-slate-700 accent-sidesi-500 text-white w-3.5 h-3.5"
                        />
                        <span className="font-mono uppercase">{office}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Status filter (multi-select via checkboxes) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Statut</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'neconfigurat', label: 'Neconfigurat', color: 'text-rose-400' },
                      { value: 'aplicatie_instalata', label: 'Aplicație instalată', color: 'text-orange-400' },
                      { value: 'in_certificare', label: 'În certificare', color: 'text-amber-400' },
                      { value: 'certificat', label: 'Certificat', color: 'text-blue-400' },
                      { value: 'eroare_certificare', label: 'Eroare la certificare', color: 'text-pink-400' },
                      { value: 'pus_in_exploatare', label: 'Pus în exploatare', color: 'text-emerald-400' },
                    ].map(status => {
                      const isChecked = exportStatuses.includes(status.value);
                      return (
                        <label
                          key={status.value}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-xs ${
                            isChecked
                              ? 'bg-sidesi-500/10 border-sidesi-500/30 text-slate-900 dark:text-white'
                              : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800/60 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setExportStatuses(prev => [...prev, status.value]);
                              } else {
                                setExportStatuses(prev => prev.filter(s => s !== status.value));
                              }
                            }}
                            className="w-3.5 h-3.5 rounded accent-sidesi-500"
                          />
                          <span className={`font-medium ${status.color}`}>{status.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  {exportStatuses.length > 0 && (
                    <button
                      onClick={() => setExportStatuses([])}
                      className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      Curăță filtrele de statut
                    </button>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-200 dark:border-slate-800" />

              {/* Columns Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-sidesi-400" /> Coloane de Exportat
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setExportColumns(Object.keys(EXPORT_COLUMN_OPTIONS))}
                      className="text-[10px] text-sidesi-400 hover:text-sidesi-300 font-semibold transition-colors"
                    >
                      Selectează tot
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button
                      onClick={() => setExportColumns([])}
                      className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold transition-colors"
                    >
                      Deselectează tot
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(EXPORT_COLUMN_OPTIONS).map(([key, label]) => {
                    const isChecked = exportColumns.includes(key);
                    return (
                      <label
                        key={key}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-xs ${
                          isChecked
                            ? 'bg-sidesi-500/10 border-sidesi-500/30 text-slate-900 dark:text-white'
                            : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800/60 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setExportColumns(prev => [...prev, key]);
                            } else {
                              setExportColumns(prev => prev.filter(c => c !== key));
                            }
                          }}
                          className="w-3.5 h-3.5 rounded accent-sidesi-500"
                        />
                        <span className="font-medium">{label}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-600">
                  {exportColumns.length} coloan(e) selectate din {Object.keys(EXPORT_COLUMN_OPTIONS).length}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-200 dark:border-slate-850 flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {exportOficii.length > 0 || exportStatuses.length > 0
                  ? 'Export filtrat conform selecției'
                  : 'Export complet (toate datele)'}
              </span>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsExportOpen(false)}
                  className="glass-button-secondary py-2.5 px-5 text-xs font-semibold"
                  disabled={isExporting}
                >
                  Anulează
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="glass-button-primary py-2.5 px-6 text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-sidesi-500/10"
                  disabled={isExporting || exportColumns.length === 0}
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Se exportă...</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-3.5 h-3.5" />
                      <span>Generează Excel</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import IP Modal */}
      {isIpImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 dark:bg-slate-950/80 backdrop-blur-sm" onClick={() => !isIpImporting && setIsIpImportOpen(false)} />
          <div className="relative w-full max-w-2xl glass-panel rounded-2xl z-10 overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800/60 max-h-[90vh] flex flex-col">

            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-850 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Network className="w-5 h-5 text-sidesi-400" />
                Import Adrese IP din Excel
              </h2>
              <button
                onClick={() => !isIpImporting && setIsIpImportOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {!ipImportResult ? (
                <>
                  {/* Info box */}
                  <div className="bg-sidesi-500/10 border border-sidesi-500/20 rounded-xl p-3 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-sidesi-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                      <p><strong>Format fișier:</strong> Excel (.xlsx) cu header pe rândul 1.</p>
                      <p><strong>Coloana A:</strong> Nr. fabricație / ID Terminal</p>
                      <p><strong>Coloana D:</strong> Adresă IP (ex: <code className="font-mono">192.168.207.82</code> sau <code className="font-mono">98.2</code>)</p>
                      <p>IP-urile fără prefix <code className="font-mono">192.168.</code> vor fi completate automat.</p>
                      <p>Celulele goale din coloana D = fără IP (se ignoră).</p>
                    </div>
                  </div>

                  {/* Drag & drop */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsIpDragging(true); }}
                    onDragLeave={() => setIsIpDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsIpDragging(false);
                      const file = e.dataTransfer.files[0];
                      if (file && file.name.match(/\.(xlsx|xls)$/i)) {
                        setIpImportFile(file);
                      }
                    }}
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                      isIpDragging
                        ? 'border-sidesi-500 bg-sidesi-500/5'
                        : 'border-slate-300 dark:border-slate-700 hover:border-sidesi-400'
                    }`}
                    onClick={() => document.getElementById('ip-import-input')?.click()}
                  >
                    <input
                      id="ip-import-input"
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setIpImportFile(file);
                      }}
                    />
                    {ipImportFile ? (
                      <div className="space-y-1">
                        <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{ipImportFile.name}</p>
                        <p className="text-xs text-slate-400">{(ipImportFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Trage fișierul aici sau click pentru a selecta</p>
                        <p className="text-xs text-slate-400">Formate acceptate: .xlsx, .xls</p>
                      </div>
                    )}
                  </div>

                  {/* Force overwrite checkbox */}
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ipForceOverwrite}
                      onChange={(e) => setIpForceOverwrite(e.target.checked)}
                      className="w-4 h-4 rounded accent-sidesi-500"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      Suprascrie IP-urile existente cu cele din Excel (dacă sunt diferite)
                    </span>
                  </label>
                </>
              ) : (
                <>
                  {/* Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="glass-panel p-3 rounded-xl border border-emerald-500/20 text-center">
                      <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                      <div className="text-2xl font-black text-emerald-500">{ipImportResult.summary.updated}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Adăugate/Modificate</div>
                    </div>
                    <div className="glass-panel p-3 rounded-xl border border-blue-500/20 text-center">
                      <div className="text-2xl font-black text-blue-400 mb-1">{ipImportResult.summary.same_ip}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">IP Identice</div>
                    </div>
                    <div className="glass-panel p-3 rounded-xl border border-amber-500/20 text-center">
                      <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                      <div className="text-2xl font-black text-amber-500">{ipImportResult.summary.already_has_ip}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">IP Existent (Diferit)</div>
                    </div>
                    <div className="glass-panel p-3 rounded-xl border border-rose-500/20 text-center">
                      <XCircle className="w-5 h-5 text-rose-400 mx-auto mb-1" />
                      <div className="text-2xl font-black text-rose-500">{ipImportResult.summary.not_found}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Negăsite în DB</div>
                    </div>
                    <div className="glass-panel p-3 rounded-xl border border-orange-500/20 text-center">
                      <div className="text-2xl font-black text-orange-400 mb-1">{ipImportResult.summary.duplicates}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Duplicate în Excel</div>
                    </div>
                    <div className="glass-panel p-3 rounded-xl border border-slate-300 dark:border-slate-700 text-center">
                      <div className="text-2xl font-black text-slate-400 mb-1">{ipImportResult.summary.without_ip}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Fără IP în Excel</div>
                    </div>
                  </div>

                  {/* Already has IP (conflicts) */}
                  {ipImportResult.already_has_ip?.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> IP Existent — Necesită Confirmare ({ipImportResult.already_has_ip.length})
                      </h3>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {ipImportResult.already_has_ip.map((item: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{item.terminal_id}</span>
                            <span className="text-slate-400">
                              <span className="font-mono text-rose-400">{item.old_ip}</span>
                              <span className="mx-1.5">→</span>
                              <span className="font-mono text-emerald-400">{item.new_ip}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                      {!ipForceOverwrite && (
                        <button
                          onClick={() => {
                            setIpForceOverwrite(true);
                            setIpImportResult(null);
                          }}
                          className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                        >
                          Bifează „Suprascrie" și reîncarcă pentru a aplica noile IP-uri
                        </button>
                      )}
                    </div>
                  )}

                  {/* Overwritten (if force was used) */}
                  {ipImportResult.overwritten?.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5" /> IP-uri Suprascrise ({ipImportResult.overwritten.length})
                      </h3>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {ipImportResult.overwritten.map((item: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{item.terminal_id}</span>
                            <span className="text-slate-400">
                              <span className="font-mono text-rose-400 line-through">{item.old_ip}</span>
                              <span className="mx-1.5">→</span>
                              <span className="font-mono text-emerald-400">{item.new_ip}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Not found */}
                  {ipImportResult.not_found?.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" /> ID-uri Negăsite în Baza de Date ({ipImportResult.not_found.length})
                      </h3>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {ipImportResult.not_found.map((item: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs bg-rose-500/5 border border-rose-500/20 rounded-lg px-3 py-2">
                            <span className="font-mono font-bold text-rose-400">{item.terminal_id}</span>
                            <span className="text-slate-400">(rând {item.row})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Duplicates */}
                  {ipImportResult.duplicates?.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Duplicate în Excel ({ipImportResult.duplicates.length})
                      </h3>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {ipImportResult.duplicates.map((item: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs bg-orange-500/5 border border-orange-500/20 rounded-lg px-3 py-2">
                            <span className="font-mono font-bold text-orange-400">{item.terminal_id}</span>
                            <span className="text-slate-400">pe rândurile: {item.rows.join(', ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-200 dark:border-slate-850 flex justify-end gap-2.5 flex-shrink-0">
              {!ipImportResult ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsIpImportOpen(false)}
                    className="glass-button-secondary py-2.5 px-5 text-xs font-semibold"
                    disabled={isIpImporting}
                  >
                    Anulează
                  </button>
                  <button
                    type="button"
                    onClick={handleImportIPs}
                    className="glass-button-primary py-2.5 px-6 text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-sidesi-500/10"
                    disabled={isIpImporting || !ipImportFile}
                  >
                    {isIpImporting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Se procesează...</span>
                      </>
                    ) : (
                      <>
                        <Network className="w-3.5 h-3.5" />
                        <span>Importă IP-urile</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsIpImportOpen(false)}
                  className="glass-button-primary py-2.5 px-6 text-xs font-semibold"
                >
                  Închide
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import MEV Keys Modal */}
      {isMevImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 dark:bg-slate-950/80 backdrop-blur-sm" onClick={() => !isMevImporting && setIsMevImportOpen(false)} />
          <div className="relative w-full max-w-2xl glass-panel rounded-2xl z-10 overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800/60 max-h-[90vh] flex flex-col">

            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-850 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-sidesi-400" />
                Import Chei MEV din Excel
              </h2>
              <button
                onClick={() => !isMevImporting && setIsMevImportOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {!mevImportResult ? (
                <>
                  {/* Info box */}
                  <div className="bg-sidesi-500/10 border border-sidesi-500/20 rounded-xl p-3 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-sidesi-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                      <p className="font-bold text-slate-800 dark:text-slate-200">Format fișier Excel:</p>
                      <p>• <strong>Coloana C</strong> = Număr MEV (ex: S01702011108) — date de la rândul 5</p>
                      <p>• <strong>Coloana L</strong> = Cheie MEV — date de la rândul 5</p>
                      <p className="pt-1 text-amber-500">⚠ Cheile existente NU vor fi modificate. Doar cartelele fără cheie vor primi cheia nouă.</p>
                    </div>
                  </div>

                  {/* Drag & Drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsMevDragging(true); }}
                    onDragLeave={() => setIsMevDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsMevDragging(false);
                      const file = e.dataTransfer.files[0];
                      if (file && file.name.match(/\.(xlsx|xls)$/i)) {
                        setMevImportFile(file);
                      }
                    }}
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                      isMevDragging
                        ? 'border-sidesi-400 bg-sidesi-500/5'
                        : 'border-slate-300 dark:border-slate-700 hover:border-sidesi-400/50'
                    }`}
                    onClick={() => document.getElementById('mev-import-input')?.click()}
                  >
                    <input
                      type="file"
                      id="mev-import-input"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setMevImportFile(file);
                      }}
                    />
                    {mevImportFile ? (
                      <div className="space-y-1">
                        <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{mevImportFile.name}</p>
                        <p className="text-xs text-slate-400">{(mevImportFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Trage fișierul Excel aici</p>
                        <p className="text-xs text-slate-500">sau click pentru a selecta (.xlsx)</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Summary KPIs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="glass-panel p-3 rounded-xl border border-emerald-500/20 text-center">
                      <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                      <div className="text-2xl font-black text-emerald-500">{mevImportResult.summary.updated}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Chei Adăugate</div>
                    </div>
                    <div className="glass-panel p-3 rounded-xl border border-amber-500/20 text-center">
                      <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                      <div className="text-2xl font-black text-amber-500">{mevImportResult.summary.skipped_has_key}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Chei Existente (Skip)</div>
                    </div>
                    <div className="glass-panel p-3 rounded-xl border border-rose-500/20 text-center">
                      <XCircle className="w-5 h-5 text-rose-400 mx-auto mb-1" />
                      <div className="text-2xl font-black text-rose-500">{mevImportResult.summary.not_found}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Negăsite în DB</div>
                    </div>
                    <div className="glass-panel p-3 rounded-xl border border-orange-500/20 text-center">
                      <div className="text-2xl font-black text-orange-400 mb-1">{mevImportResult.summary.duplicates}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Duplicate în Excel</div>
                    </div>
                  </div>

                  {/* Updated (chei adăugate) */}
                  {mevImportResult.updated?.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5" /> Chei Adăugate ({mevImportResult.updated.length})
                      </h3>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {mevImportResult.updated.map((item: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{item.mev_number}</span>
                            <span className="text-[9px] text-slate-400">→ {item.terminal_id}</span>
                            <span className="font-mono text-emerald-400 text-[10px]">{item.mev_key}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Skipped (already has key) */}
                  {mevImportResult.skipped_has_key?.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Chei Existente — Skipped ({mevImportResult.skipped_has_key.length})
                      </h3>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {mevImportResult.skipped_has_key.map((item: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                            <span className="font-mono font-bold text-amber-400">{item.mev_number}</span>
                            <span className="text-[9px] text-slate-400">→ {item.terminal_id}</span>
                            <span className="text-slate-400">(rând {item.row}) — are deja cheie</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Not found */}
                  {mevImportResult.not_found?.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" /> ID-uri Negăsite în Baza de Date ({mevImportResult.not_found.length})
                      </h3>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {mevImportResult.not_found.map((item: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs bg-rose-500/5 border border-rose-500/20 rounded-lg px-3 py-2">
                            <span className="font-mono font-bold text-rose-400">{item.mev_number}</span>
                            <span className="text-slate-400">(rând {item.row})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Duplicates */}
                  {mevImportResult.duplicates?.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Duplicate în Excel ({mevImportResult.duplicates.length})
                      </h3>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {mevImportResult.duplicates.map((item: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs bg-orange-500/5 border border-orange-500/20 rounded-lg px-3 py-2">
                            <span className="font-mono font-bold text-orange-400">{item.mev_number}</span>
                            <span className="text-slate-400">pe rândurile: {item.rows.join(', ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-200 dark:border-slate-850 flex justify-end gap-2.5 flex-shrink-0">
              {!mevImportResult ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsMevImportOpen(false)}
                    className="glass-button-secondary py-2.5 px-5 text-xs font-semibold"
                    disabled={isMevImporting}
                  >
                    Anulează
                  </button>
                  <button
                    type="button"
                    onClick={handleImportMevKeys}
                    className="glass-button-primary py-2.5 px-6 text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-sidesi-500/10"
                    disabled={isMevImporting || !mevImportFile}
                  >
                    {isMevImporting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Se procesează...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Importă Cheile MEV</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsMevImportOpen(false)}
                  className="glass-button-primary py-2.5 px-6 text-xs font-semibold"
                >
                  Închide
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          isOpen={!!deleteTarget}
          title="Ștergere Echipament de Casă Virtual"
          message="Sunteți sigur că doriți să ștergeți acest echipament? Această acțiune va șterge definitiv datele și fișierul PDF de pe server și este ireversibilă."
          confirmLabel="Șterge definitiv"
          cancelLabel="Anulează"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          type="danger"
        />
      )}

    </div>
  );
};

export default VirtualECC;
