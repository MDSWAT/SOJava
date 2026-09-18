import React, { useState, useEffect, useCallback, useRef } from 'react';
import Moldova from '@svg-maps/moldova';
import api from '@/services/api';
import {
  MapPin, Phone, Mail, User, Search, X, Plus, Edit,
  Trash2, Building2, Users, Loader2, ClipboardCopy, List, ZoomOut, Wrench,
} from 'lucide-react';
import { useAuthStore } from '@/context/authStore';

interface ContactOficiu {
  id: string;
  raion: string;
  raion_name: string;
  tip: 'inginer' | 'oficiu';
  tip_display: string;
  ordine: number;
  oficiu: string | null;
  nume: string;
  prenume: string;
  functie: string | null;
  telefon: string | null;
  email: string | null;
  adresa: string | null;
}

interface RaionData {
  id: string;
  name: string;
  code: string;
  svg_id: string;
  contacts_count: number;
  contacts?: ContactOficiu[];
}

interface SvgLocation {
  id: string;
  name: string;
  path: string;
}

interface ContactCardProps {
  contact: ContactOficiu;
  canManage: boolean;
  isInginer?: boolean;
  onEdit: (c: ContactOficiu) => void;
  onDelete: (c: ContactOficiu) => void;
  onCopy: (text: string, label: string) => void;
}

const ContactCard: React.FC<ContactCardProps> = ({ contact: c, canManage, isInginer, onEdit, onDelete, onCopy }) => (
  <div
    className={`p-3 rounded-xl border transition-all duration-200 hover:shadow-md ${
      isInginer
        ? 'bg-amber-500/5 dark:bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50'
        : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800/60 hover:border-sidesi-400/30'
    }`}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-1">
          {isInginer
            ? <Wrench className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            : <User className="w-3.5 h-3.5 text-sidesi-400 flex-shrink-0" />
          }
          <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {c.nume} {c.prenume}
          </span>
          {isInginer && (
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 flex-shrink-0">
              Inginer
            </span>
          )}
        </div>
        {c.functie && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400 ml-5 mb-1">{c.functie}</p>
        )}
        {c.oficiu && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <Building2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate">{c.oficiu}</span>
          </div>
        )}
        <div className="mt-1.5 space-y-1">
          {c.telefon && (
            <div className="flex items-center gap-1.5 group">
              <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300">{c.telefon}</span>
              <button
                onClick={() => onCopy(c.telefon!, 'Telefon')}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-sidesi-400 transition-opacity"
              >
                <ClipboardCopy className="w-3 h-3" />
              </button>
            </div>
          )}
          {c.email && (
            <div className="flex items-center gap-1.5 group">
              <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate">{c.email}</span>
              <button
                onClick={() => onCopy(c.email!, 'Email')}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-sidesi-400 transition-opacity"
              >
                <ClipboardCopy className="w-3 h-3" />
              </button>
            </div>
          )}
          {c.adresa && (
            <div className="flex items-start gap-1.5">
              <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">{c.adresa}</span>
            </div>
          )}
        </div>
      </div>
      {canManage && (
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button
            onClick={() => onEdit(c)}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(c)}
            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  </div>
);

const PostaContacts: React.FC = () => {
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('posta_contacts:manage');

  const [raioane, setRaioane] = useState<RaionData[]>([]);
  const [selectedRaion, setSelectedRaion] = useState<RaionData | null>(null);
  const [contacts, setContacts] = useState<ContactOficiu[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [globalResults, setGlobalResults] = useState<ContactOficiu[]>([]);
  const [globalSearching, setGlobalSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Zoom
  const [zoomedId, setZoomedId] = useState<string | null>(null);
  const [zoomViewBox, setZoomViewBox] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactOficiu | null>(null);
  const [formData, setFormData] = useState({
    tip: 'oficiu' as 'inginer' | 'oficiu',
    oficiu: '', nume: '', prenume: '', functie: '', telefon: '', email: '', adresa: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContactOficiu | null>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load all raioane
  const loadRaioane = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/posta-contacts/raioane/');
      setRaioane(res.data.results || res.data);
    } catch {
      showToast('Eroare la încărcarea raioanelor.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRaioane(); }, [loadRaioane]);

  // Global search across all raioane when no raion is selected
  useEffect(() => {
    if (selectedRaion || !search) {
      setGlobalResults([]);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setGlobalSearching(true);
      try {
        const res = await api.get('/posta-contacts/contacts/', { params: { search } });
        setGlobalResults(res.data.results || res.data);
      } catch {
        setGlobalResults([]);
      } finally {
        setGlobalSearching(false);
      }
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search, selectedRaion]);

  // Escape key: close modals first, otherwise reset map zoom
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isFormOpen) { setIsFormOpen(false); return; }
      if (deleteTarget) { setDeleteTarget(null); return; }
      if (zoomedId) handleZoomOut();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFormOpen, deleteTarget, zoomedId]);

  // Load contacts
  const loadContacts = useCallback(async (raionId: string) => {
    try {
      setContactsLoading(true);
      const res = await api.get(`/posta-contacts/raioane/${raionId}/contacts/`);
      setSelectedRaion(res.data);
      setContacts(res.data.contacts || []);
    } catch {
      showToast('Eroare la încărcarea contactelor.', 'error');
    } finally {
      setContactsLoading(false);
    }
  }, []);

  // Compute bounding box zoom
  const computeZoom = (svgId: string): string | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pathEl = svg.querySelector(`#${CSS.escape(svgId)}`) as SVGPathElement | null;
    if (!pathEl) return null;
    const bbox = pathEl.getBBox();
    if (!bbox || bbox.width === 0 || bbox.height === 0) return null;
    const pad = Math.max(bbox.width, bbox.height) * 0.5;
    return `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`;
  };

  // Select raion (from map or list)
  const handleSelectRaion = (raion: RaionData) => {
    loadContacts(raion.id);
    setZoomedId(raion.svg_id);
    setTimeout(() => {
      const vb = computeZoom(raion.svg_id);
      if (vb) setZoomViewBox(vb);
    }, 60);
  };

  const handleRaionClick = (e: React.MouseEvent<SVGPathElement>) => {
    const svgId = (e.target as SVGPathElement).id;
    const raion = raioane.find(r => r.svg_id === svgId);
    if (raion) handleSelectRaion(raion);
  };

  const handleZoomOut = () => {
    setZoomedId(null);
    setZoomViewBox(null);
  };

  // Hover with mouse tracking
  const handleRaionHover = (e: React.MouseEvent<SVGPathElement>) => {
    setHoveredId((e.target as SVGPathElement).id);
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (svgRect) {
      setTooltipPos({ x: e.clientX - svgRect.left, y: e.clientY - svgRect.top });
    }
  };
  const handleRaionMove = (e: React.MouseEvent<SVGPathElement>) => {
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (svgRect) {
      setTooltipPos({ x: e.clientX - svgRect.left, y: e.clientY - svgRect.top });
    }
  };
  const handleRaionLeave = () => {
    setHoveredId(null);
    setTooltipPos(null);
  };

  const hoveredRaion = raioane.find(r => r.svg_id === hoveredId);

  // Diacritics-insensitive search (elastic-like): "hincesti" matches "Hîncești"
  const normalizeText = (s: string | null | undefined): string =>
    (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const filteredContacts = contacts.filter(c => {
    if (!search) return true;
    const s = normalizeText(search);
    return (
      normalizeText(c.nume).includes(s) || normalizeText(c.prenume).includes(s) ||
      normalizeText(c.oficiu).includes(s) || normalizeText(c.telefon).includes(s) ||
      normalizeText(c.email).includes(s) || normalizeText(c.adresa).includes(s) ||
      normalizeText(c.functie).includes(s)
    );
  });

  const filteredRaioane = raioane.filter(r => {
    if (!listSearch) return true;
    return normalizeText(r.name).includes(normalizeText(listSearch));
  });

  const currentViewBox = zoomViewBox || Moldova.viewBox;

  // Form handlers
  const openAddForm = () => {
    setEditingContact(null);
    setFormData({ tip: 'oficiu', oficiu: '', nume: '', prenume: '', functie: '', telefon: '', email: '', adresa: '' });
    setIsFormOpen(true);
  };
  const openEditForm = (contact: ContactOficiu) => {
    setEditingContact(contact);
    setFormData({
      tip: contact.tip,
      oficiu: contact.oficiu || '', nume: contact.nume, prenume: contact.prenume,
      functie: contact.functie || '', telefon: contact.telefon || '',
      email: contact.email || '', adresa: contact.adresa || '',
    });
    setIsFormOpen(true);
  };
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRaion) return;
    const payload = {
      ...formData,
      oficiu: formData.tip === 'inginer' ? null : formData.oficiu,
    };
    try {
      setSaving(true);
      if (editingContact) {
        await api.patch(`/posta-contacts/contacts/${editingContact.id}/`, payload);
        showToast('Contact actualizat cu succes.');
      } else {
        await api.post('/posta-contacts/contacts/', { ...payload, raion: selectedRaion.id });
        showToast('Contact adăugat cu succes.');
      }
      setIsFormOpen(false);
      loadContacts(selectedRaion.id);
      loadRaioane();
    } catch {
      showToast('Eroare la salvare.', 'error');
    } finally {
      setSaving(false);
    }
  };
  const handleDelete = async () => {
    if (!deleteTarget || !selectedRaion) return;
    try {
      await api.delete(`/posta-contacts/contacts/${deleteTarget.id}/`);
      showToast('Contact șters.');
      setDeleteTarget(null);
      loadContacts(selectedRaion.id);
      loadRaioane();
    } catch {
      showToast('Eroare la ștergere.', 'error');
    }
  };
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copiat.`);
  };

  const mapHeight = 'calc(100vh - 160px)';

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-sidesi-400" />
            Date de Contact Poșta
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Harta interactivă a raioanelor Republicii Moldova
          </p>
        </div>
        <div className="flex items-center gap-2">
          {zoomedId && (
            <button
              onClick={handleZoomOut}
              className="glass-button-secondary py-2 px-3 text-xs font-semibold flex items-center gap-1.5"
            >
              <ZoomOut className="w-4 h-4" />
              Reset hartă
            </button>
          )}
          {canManage && selectedRaion && (
            <button
              onClick={openAddForm}
              className="glass-button-primary py-2 px-4 text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Adaugă Contact
            </button>
          )}
        </div>
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3" style={{ minHeight: mapHeight }}>

        {/* Left: Raioane list */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-3 border border-slate-200 dark:border-slate-800/60 flex flex-col" style={{ maxHeight: mapHeight }}>
          <div className="flex items-center gap-2 mb-2 flex-shrink-0">
            <List className="w-4 h-4 text-sidesi-400" />
            <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Raioane</h3>
          </div>
          <div className="relative mb-2 flex-shrink-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            <input
              type="text"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Caută raion..."
              className="glass-input pl-7 text-[11px] py-1.5 w-full"
            />
          </div>
          <div className="flex-grow overflow-y-auto space-y-0.5 -mr-1 pr-1 scrollbar-thin">
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-4 h-4 text-sidesi-400 animate-spin" />
              </div>
            ) : (
              filteredRaioane.map((r) => {
                const isSelected = selectedRaion?.svg_id === r.svg_id;
                return (
                  <button
                    key={r.id}
                    onClick={() => handleSelectRaion(r)}
                    onMouseEnter={() => setHoveredId(r.svg_id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 flex items-center justify-between gap-1.5 ${
                      isSelected
                        ? 'bg-sidesi-500 text-white shadow-md shadow-sidesi-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:translate-x-0.5'
                    }`}
                  >
                    <span className="truncate">{r.name}</span>
                    {r.contacts_count > 0 && (
                      <span className={`text-[9px] font-bold flex-shrink-0 px-1.5 py-0.5 rounded-full ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-emerald-500/15 text-emerald-500'
                      }`}>
                        {r.contacts_count}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Center: Map — NO border/chenar, fills all space */}
        <div className="lg:col-span-6 relative" style={{ minHeight: mapHeight }}>
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-sidesi-400 animate-spin" />
            </div>
          ) : (
            <div
              ref={mapContainerRef}
              className="relative w-full h-full"
              style={{ height: mapHeight }}
            >
              {/* Hover tooltip — follows mouse */}
              {hoveredRaion && tooltipPos && (
                <div
                  className="absolute z-20 px-3 py-1.5 rounded-lg shadow-xl pointer-events-none whitespace-nowrap bg-slate-900/90 dark:bg-slate-800/90 border border-slate-700"
                  style={{
                    left: tooltipPos.x,
                    top: tooltipPos.y - 50,
                    transform: 'translateX(-50%)',
                  }}
                >
                  <span className="text-sm font-bold text-white">{hoveredRaion.name}</span>
                  {hoveredRaion.contacts_count > 0 && (
                    <span className="ml-2 text-[10px] font-bold text-cyan-400">
                      {hoveredRaion.contacts_count} contacte
                    </span>
                  )}
                </div>
              )}

              {/* Zoom indicator */}
              {zoomedId && (
                <div className="absolute top-3 right-3 z-10 glass-panel px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800/60 shadow-sm flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    {raioane.find(r => r.svg_id === zoomedId)?.name}
                  </span>
                  <kbd className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-slate-700">Esc</kbd>
                  <button
                    onClick={handleZoomOut}
                    className="p-0.5 text-slate-400 hover:text-sidesi-400 transition-colors"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* SVG Map */}
              <style>{`
                .posta-map svg { transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
                .posta-map path {
                  fill: #e2e8f0;
                  stroke: #fff;
                  stroke-width: 0.5;
                  cursor: pointer;
                  transition: fill 0.2s ease, opacity 0.4s ease;
                }
                .posta-map path:hover { fill: #06b6d4; }
                .posta-map path[aria-checked="true"] {
                  fill: #0e7490;
                  stroke: #67e8f9;
                  stroke-width: 1.5;
                  filter: drop-shadow(0 0 8px rgba(6,182,212,0.4));
                }
                .posta-map path[data-has-contacts="true"] { fill: #86efac; }
                .posta-map path[data-has-contacts="true"]:hover { fill: #22c55e; }
                .dark .posta-map path { fill: #1e293b; stroke: #334155; }
                .dark .posta-map path:hover { fill: #06b6d4; }
                .dark .posta-map path[aria-checked="true"] { fill: #0e7490; stroke: #67e8f9; }
                .dark .posta-map path[data-has-contacts="true"] { fill: #166534; }
                .dark .posta-map path[data-has-contacts="true"]:hover { fill: #22c55e; }
              `}</style>
              <div className="posta-map w-full h-full">
                <svg
                  ref={svgRef}
                  viewBox={currentViewBox}
                  xmlns="http://www.w3.org/2000/svg"
                  preserveAspectRatio="xMidYMid meet"
                  style={{ width: '100%', height: '100%', display: 'block' }}
                >
                  {Moldova.locations.map((loc: SvgLocation) => {
                    const raion = raioane.find(r => r.svg_id === loc.id);
                    const hasContacts = raion && raion.contacts_count > 0;
                    const isSelected = selectedRaion?.svg_id === loc.id;
                    return (
                      <path
                        key={loc.id}
                        id={loc.id}
                        d={loc.path}
                        data-name={loc.name}
                        data-has-contacts={hasContacts ? 'true' : 'false'}
                        aria-checked={isSelected ? 'true' : 'false'}
                        onClick={handleRaionClick}
                        onMouseOver={handleRaionHover}
                        onMouseMove={handleRaionMove}
                        onMouseOut={handleRaionLeave}
                        style={{
                          opacity: zoomedId && zoomedId !== loc.id ? 0.15 : 1,
                        }}
                      />
                    );
                  })}
                </svg>
              </div>

              {/* Legend */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-4 glass-panel px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-slate-300 dark:bg-slate-800" />
                  <span className="text-[9px] text-slate-500">Fără contacte</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-green-300 dark:bg-green-800" />
                  <span className="text-[9px] text-slate-500">Cu contacte</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-cyan-600" />
                  <span className="text-[9px] text-slate-500">Selectat</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Contacts panel */}
        <div className="lg:col-span-4 glass-panel rounded-2xl p-4 border border-slate-200 dark:border-slate-800/60 flex flex-col" style={{ maxHeight: mapHeight }}>
          {/* Always-visible search box */}
          <div className="relative mb-3 flex-shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Caută: oficiu, nume, telefon..."
              className="glass-input pl-8 text-xs py-2 w-full"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setSelectedRaion(null); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {!selectedRaion && !search ? (
            <div className="flex flex-col items-center justify-center flex-grow text-center py-10">
              <MapPin className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-3" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Selectează un raion
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Click pe hartă sau pe listă
              </p>
            </div>
          ) : !selectedRaion && search ? (
            // Global search results
            globalSearching ? (
              <div className="flex items-center justify-center flex-grow">
                <Loader2 className="w-5 h-5 text-sidesi-400 animate-spin" />
              </div>
            ) : globalResults.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Niciun rezultat pentru "{search}".</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Rezultate căutare
                    </h2>
                    <span className="text-[10px] text-slate-400">
                      {globalResults.length} {globalResults.length === 1 ? 'contact' : 'contacte'}
                    </span>
                  </div>
                </div>
                <div className="flex-grow overflow-y-auto space-y-2 -mr-2 pr-2 scrollbar-thin">
                  {globalResults.map((c) => (
                    <div key={c.id} className="space-y-1">
                      <div className="flex items-center gap-1.5 px-1">
                        <MapPin className="w-3 h-3 text-sidesi-400 flex-shrink-0" />
                        <span className="text-[10px] font-bold text-sidesi-500 dark:text-sidesi-400 uppercase tracking-wider">{c.raion_name}</span>
                      </div>
                      <ContactCard contact={c} canManage={canManage} onEdit={openEditForm} onDelete={setDeleteTarget} onCopy={copyToClipboard} isInginer={c.tip === 'inginer'} />
                    </div>
                  ))}
                </div>
              </>
            )
          ) : contactsLoading ? (
            <div className="flex items-center justify-center flex-grow">
              <Loader2 className="w-5 h-5 text-sidesi-400 animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    {selectedRaion?.name}
                  </h2>
                  <span className="text-[10px] text-slate-400">
                    {contacts.length} {contacts.length === 1 ? 'contact' : 'contacte'}
                  </span>
                </div>
              </div>

              <div className="flex-grow overflow-y-auto space-y-2 -mr-2 pr-2 scrollbar-thin">
                {filteredContacts.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">
                      {contacts.length === 0 ? 'Niciun contact pentru acest raion.' : 'Niciun rezultat.'}
                    </p>
                    {canManage && contacts.length === 0 && (
                      <button
                        onClick={openAddForm}
                        className="mt-3 text-xs font-semibold text-sidesi-400 hover:text-sidesi-300"
                      >
                        + Adaugă primul contact
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Ingineri — always on top */}
                    {filteredContacts.filter(c => c.tip === 'inginer').length > 0 && (
                      <div className="mb-1">
                        <div className="flex items-center gap-1.5 px-1 py-1 mb-1.5">
                          <Wrench className="w-3 h-3 text-amber-500" />
                          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Ingineri raionali</span>
                        </div>
                        <div className="space-y-2">
                          {filteredContacts.filter(c => c.tip === 'inginer').map((c) => (
                            <ContactCard key={c.id} contact={c} canManage={canManage} onEdit={openEditForm} onDelete={setDeleteTarget} onCopy={copyToClipboard} isInginer />
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Oficii */}
                    {filteredContacts.filter(c => c.tip === 'oficiu').length > 0 && (
                      <div>
                        {filteredContacts.some(c => c.tip === 'inginer') && (
                          <div className="flex items-center gap-1.5 px-1 py-1 mb-1.5 mt-2">
                            <Building2 className="w-3 h-3 text-sidesi-400" />
                            <span className="text-[10px] font-bold text-sidesi-400 uppercase tracking-wider">Oficii poștale</span>
                          </div>
                        )}
                        <div className="space-y-2">
                          {filteredContacts.filter(c => c.tip === 'oficiu').map((c) => (
                            <ContactCard key={c.id} contact={c} canManage={canManage} onEdit={openEditForm} onDelete={setDeleteTarget} onCopy={copyToClipboard} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isFormOpen && selectedRaion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 dark:bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
          <div className="relative w-full max-w-lg glass-panel rounded-2xl z-10 overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800/60 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800/60 flex items-center justify-between flex-shrink-0 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${editingContact ? 'bg-amber-500/15 border border-amber-500/30' : 'bg-emerald-500/15 border border-emerald-500/30'}`}>
                  <User className={`w-5 h-5 ${editingContact ? 'text-amber-500' : 'text-emerald-500'}`} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingContact ? 'Editare Contact' : 'Contact Nou'}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {selectedRaion.name} — {editingContact ? editingContact.oficiu : 'oficiu nou'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            <form onSubmit={handleSaveForm} className="flex-grow overflow-y-auto px-6 py-5 space-y-4">
              {/* Tip contact selector */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tip: 'inginer' })}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    formData.tip === 'inginer'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  Inginer raional
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tip: 'oficiu' })}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    formData.tip === 'oficiu'
                      ? 'bg-sidesi-500 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  Contact oficiu
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {formData.tip === 'oficiu' && (
                  <div className="space-y-1 col-span-2">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Oficiu Poștal <span className="text-rose-500">*</span></label>
                    <input type="text" required={formData.tip === 'oficiu'} value={formData.oficiu} onChange={(e) => setFormData({ ...formData, oficiu: e.target.value })} placeholder="OF-01 Chișinău" className="glass-input text-sm" />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Funcție</label>
                  <input type="text" value={formData.functie} onChange={(e) => setFormData({ ...formData, functie: e.target.value })} placeholder={formData.tip === 'inginer' ? 'Inginer raional' : 'Șef oficiu'} className="glass-input text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Telefon</label>
                  <input type="text" value={formData.telefon} onChange={(e) => setFormData({ ...formData, telefon: e.target.value })} placeholder="022123456" className="glass-input font-mono text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Nume <span className="text-rose-500">*</span></label>
                  <input type="text" required value={formData.nume} onChange={(e) => setFormData({ ...formData, nume: e.target.value })} placeholder="Popescu" className="glass-input text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Prenume <span className="text-rose-500">*</span></label>
                  <input type="text" required value={formData.prenume} onChange={(e) => setFormData({ ...formData, prenume: e.target.value })} placeholder="Ion" className="glass-input text-sm" />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="nume@posta.md" className="glass-input text-sm" />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Adresă</label>
                  <textarea value={formData.adresa} onChange={(e) => setFormData({ ...formData, adresa: e.target.value })} placeholder="Adresă..." rows={2} className="glass-input resize-none text-sm" />
                </div>
              </div>
            </form>
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800/60 flex justify-end gap-2.5 flex-shrink-0 bg-slate-50/50 dark:bg-slate-900/30">
              <button type="button" onClick={() => setIsFormOpen(false)} className="glass-button-secondary py-2.5 px-5 text-xs font-semibold">Anulează</button>
              <button type="submit" onClick={handleSaveForm} disabled={saving} className="glass-button-primary py-2.5 px-6 text-xs font-semibold disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingContact ? 'Salvează' : 'Creează'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 dark:bg-slate-950/80 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm glass-panel rounded-2xl z-10 overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800/60 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-rose-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Ștergere Contact</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Sigur doriți să ștergeți contactul <strong>{deleteTarget.nume} {deleteTarget.prenume}</strong> de la <strong>{deleteTarget.oficiu}</strong>?
            </p>
            <div className="flex gap-2.5 justify-center">
              <button onClick={() => setDeleteTarget(null)} className="glass-button-secondary py-2.5 px-5 text-xs font-semibold">Anulează</button>
              <button onClick={handleDelete} className="bg-rose-500 hover:bg-rose-600 text-white py-2.5 px-5 text-xs font-semibold rounded-xl transition-colors">Șterge</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 glass-panel rounded-xl border border-slate-200 dark:border-slate-800/60 px-4 py-3 shadow-xl flex items-center gap-2">
          <span className={`text-xs font-semibold ${toast.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
            {toast.msg}
          </span>
        </div>
      )}
    </div>
  );
};

export default PostaContacts;
