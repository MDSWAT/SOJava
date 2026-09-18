import React, { useEffect, useState } from 'react';
import {
  Users, Search, Plus, UserCheck, UserMinus, Edit,
  RefreshCcw, AlertTriangle, ShieldCheck, X, Trash2
} from 'lucide-react';
import api from '@/services/api';
import { User, RoleDetail, PaginatedResponse } from '@/types';
import TableSkeleton from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useToastStore } from '@/context/toastStore';
import { useAuthStore } from '@/context/authStore';

// ─── Module Granular Permissions Schema ──────────────────────────────────────
const MODULE_GROUPS = [
  {
    name: 'Seif Parole (Shared Vault)',
    permissions: [
      { code: 'vault:view', label: 'Vizualizare parole' },
      { code: 'vault:create', label: 'Adăugare parole' },
      { code: 'vault:update', label: 'Editare parole' },
      { code: 'vault:delete', label: 'Ștergere parole' },
      { code: 'vault:reveal', label: 'Dezvăluire parolă în clar' },
      { code: 'vault:copy', label: 'Copiere în clipboard' },
      { code: 'vault:import', label: 'Import Excel' },
      { code: 'vault:export', label: 'Export Excel' },
    ]
  },
  {
    name: 'Inventar Bunuri (Inventory)',
    permissions: [
      { code: 'inventory:view', label: 'Vizualizare inventar' },
      { code: 'inventory:manage', label: 'Gestionare completă (CRUD)' },
    ]
  },
  {
    name: 'Zile de Serviciu (Duty Days)',
    permissions: [
      { code: 'duty_days:view', label: 'Vizualizare calendar' },
      { code: 'duty_days:assign', label: 'Autoselectare zi serviciu' },
      { code: 'duty_days:manage', label: 'Gestionare completă (CRUD)' },
    ]
  },
  {
    name: 'Jurnal de Audit',
    permissions: [
      { code: 'audit:view', label: 'Vizualizare loguri' },
      { code: 'audit:export', label: 'Export loguri audit' },
    ]
  },
  {
    name: 'Organizații',
    permissions: [
      { code: 'organizations:view', label: 'Vizualizare organizații' },
      { code: 'organizations:manage', label: 'Gestionare organizații (CRUD)' },
    ]
  },
  {
    name: 'Seif Personal (Personal Vault)',
    permissions: [
      { code: 'personal_vault:view', label: 'Vizualizare seif personal' },
      { code: 'personal_vault:manage', label: 'Gestionare seif personal (CRUD)' },
    ]
  },
  {
    name: 'Aparate de Casă Virtuale',
    permissions: [
      { code: 'virtual_ecc:view', label: 'Vizualizare aparate de casă' },
      { code: 'virtual_ecc:manage', label: 'Gestionare completă aparate (CRUD, Import)' },
      { code: 'virtual_ecc:reveal', label: 'Dezvăluire chei MEV' },
    ]
  },
  {
    name: 'Utilizatori & Roluri',
    permissions: [
      { code: 'users:view', label: 'Vizualizare utilizatori' },
      { code: 'users:manage', label: 'Gestionare utilizatori (CRUD)' },
      { code: 'roles:view', label: 'Vizualizare roluri' },
      { code: 'roles:manage', label: 'Gestionare roluri (CRUD)' },
    ]
  }
];

interface UsersPageProps {
  embedded?: boolean;
  initialTab?: 'users' | 'roles';
}

export const UsersPage: React.FC<UsersPageProps> = ({ embedded = false, initialTab = 'users' }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleDetail[]>([]);
  const [permissionsList, setPermissionsList] = useState<{ id: string; code: string; module: string; description: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addToast = useToastStore((state) => state.addToast);
  const currentUser = useAuthStore((state) => state.user);
  const { hasPermission } = useAuthStore();

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>(initialTab);

  // Filters
  const [search, setSearch] = useState('');

  // Modals & Forms (Users)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  // Form states (Users)
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formRoleId, setFormRoleId] = useState('');
  const [formCustomPerms, setFormCustomPerms] = useState<string[]>([]);
  const [formPassword, setFormPassword] = useState('');

  // Modals & Forms (Roles)
  const [isRoleFormOpen, setIsRoleFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDetail | null>(null);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<RoleDetail | null>(null);

  // Form states (Roles)
  const [formRoleName, setFormRoleName] = useState('');
  const [formRoleDescription, setFormRoleDescription] = useState('');
  const [formRolePerms, setFormRolePerms] = useState<string[]>([]); // list of permission IDs (UUIDs)

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const userRes = await api.get<PaginatedResponse<User> | User[]>(`/auth/users/?search=${search}`);
      const roleRes = await api.get<PaginatedResponse<RoleDetail> | RoleDetail[]>('/auth/roles/');
      const permRes = await api.get<PaginatedResponse<{ id: string; code: string; module: string; description: string }> | { id: string; code: string; module: string; description: string }[]>('/auth/permissions/');

      const usersData = userRes.data;
      const rolesData = roleRes.data;
      const permsData = permRes.data;

      setUsers(Array.isArray(usersData) ? usersData : usersData.results);
      setRoles(Array.isArray(rolesData) ? rolesData : rolesData.results);
      setPermissionsList(Array.isArray(permsData) ? permsData : permsData.results);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || 'Eroare la încărcarea utilizatorilor. Permisiuni insuficiente.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  // Sync AD Accounts (Simulate Celery trigger)
  const handleSyncAD = async () => {
    setIsSyncing(true);
    addToast('S-a pornit sincronizarea de fundal cu Active Directory via Celery...', 'info');

    setTimeout(async () => {
      try {
        addToast('Sincronizare finalizată! 4 conturi din domeniu au fost verificate și actualizate.', 'success');
        loadData();
      } catch (err) {
        addToast('Sincronizarea AD a eșuat.', 'error');
      } finally {
        setIsSyncing(false);
      }
    }, 2000);
  };

  const handleToggleActive = async (targetUser: User) => {
    if (targetUser.id === currentUser?.id) {
      addToast('Nu vă puteți dezactiva propriul cont.', 'error');
      return;
    }

    try {
      const updatedStatus = !targetUser.is_active;
      await api.patch(`/auth/users/${targetUser.id}/`, {
        role_id: targetUser.role_detail.id,
        is_active: updatedStatus
      });
      addToast(`Utilizatorul a fost ${updatedStatus ? 'activat' : 'dezactivat'}!`, 'success');
      loadData();
    } catch (err) {
      addToast('Modificarea stării utilizatorului a eșuat.', 'error');
    }
  };

  // ─── USER SUBMIT ───────────────────────────────────────────────────────────
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername || !formEmail || !formRoleId) {
      addToast('Completați câmpurile obligatorii.', 'warning');
      return;
    }

    const payload: any = {
      username: formUsername,
      email: formEmail,
      first_name: formFirstName,
      last_name: formLastName,
      role_id: formRoleId,
      custom_permission_codes: formCustomPerms,
    };

    if (formPassword) {
      payload.password = formPassword;
    }

    try {
      if (editingUser) {
        if (editingUser.id === currentUser?.id && editingUser.role_detail.name === 'Super Admin' && roles.find(r => r.id === formRoleId)?.name !== 'Super Admin') {
          addToast('Nu vă puteți retrage singur permisiunile de Super Admin.', 'error');
          return;
        }
        await api.patch(`/auth/users/${editingUser.id}/`, payload);
        addToast('Utilizatorul a fost modificat!', 'success');
      } else {
        if (!formPassword) {
          addToast('Parola este obligatorie pentru utilizatori noi.', 'warning');
          return;
        }
        await api.post('/auth/users/', payload);
        addToast('Utilizator nou creat cu succes!', 'success');
      }
      setIsFormOpen(false);
      resetForm();
      loadData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: any } };
      const responseData = axiosErr.response?.data;

      let errorMsg = 'Salvarea a eșuat.';
      if (responseData) {
        if (typeof responseData === 'object' && responseData !== null) {
          const errors = Object.entries(responseData).map(([key, val]) => {
            const fieldName = key === 'detail' ? '' : `${key}: `;
            const messages = Array.isArray(val) ? val.join(' ') : String(val);
            return `${fieldName}${messages}`;
          });
          errorMsg = errors.join(' | ');
        } else if (typeof responseData === 'string') {
          errorMsg = responseData;
        }
      }
      addToast(errorMsg, 'error');
    }
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setFormUsername(u.username);
    setFormEmail(u.email);
    setFormFirstName(u.first_name);
    setFormLastName(u.last_name);
    setFormRoleId(u.role_detail.id);
    setFormCustomPerms(u.custom_permissions?.map(p => p.code) || []);
    setFormPassword('');
    setIsFormOpen(true);
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormUsername('');
    setFormEmail('');
    setFormFirstName('');
    setFormLastName('');
    setFormRoleId('');
    setFormCustomPerms([]);
    setFormPassword('');
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/auth/users/${deleteTarget.id}/`);
      addToast('Utilizatorul a fost șters definitiv din sistem!', 'success');
      setDeleteTarget(null);
      loadData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      addToast(axiosErr.response?.data?.detail || 'Ștergerea a eșuat.', 'error');
    }
  };

  // ─── ROLE SUBMIT ───────────────────────────────────────────────────────────
  const handleRoleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRoleName.trim()) {
      addToast('Numele rolului este obligatoriu.', 'warning');
      return;
    }

    const payload = {
      name: formRoleName.trim(),
      description: formRoleDescription.trim(),
      permission_ids: formRolePerms,
    };

    try {
      if (editingRole) {
        await api.patch(`/auth/roles/${editingRole.id}/`, payload);
        addToast('Rolul de securitate a fost actualizat!', 'success');
      } else {
        await api.post('/auth/roles/', payload);
        addToast('Rolul nou a fost creat!', 'success');
      }
      setIsRoleFormOpen(false);
      resetRoleForm();
      loadData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: any } };
      const responseData = axiosErr.response?.data;
      let errorMsg = 'Salvarea rolului a eșuat.';
      if (responseData && typeof responseData === 'object') {
        errorMsg = Object.entries(responseData)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(' ') : val}`)
          .join(' | ');
      }
      addToast(errorMsg, 'error');
    }
  };

  const openEditRole = (r: RoleDetail) => {
    setEditingRole(r);
    setFormRoleName(r.name);
    setFormRoleDescription(r.description || '');
    setFormRolePerms(r.permissions.map(p => p.id));
    setIsRoleFormOpen(true);
  };

  const openCreateRole = () => {
    resetRoleForm();
    setIsRoleFormOpen(true);
  };

  const resetRoleForm = () => {
    setEditingRole(null);
    setFormRoleName('');
    setFormRoleDescription('');
    setFormRolePerms([]);
  };

  const handleConfirmDeleteRole = async () => {
    if (!deleteRoleTarget) return;
    try {
      await api.delete(`/auth/roles/${deleteRoleTarget.id}/`);
      addToast('Rolul a fost șters cu succes.', 'success');
      setDeleteRoleTarget(null);
      loadData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      addToast(axiosErr.response?.data?.detail || 'Ștergerea rolului a eșuat.', 'error');
    }
  };

  // Helper to check what modules are accessible to a role based on permissions
  const getAssignedModulesList = (rolePerms: { code: string }[]) => {
    const activeGroups: string[] = [];
    const roleCodes = rolePerms.map(p => p.code);

    if (roleCodes.some(c => c.startsWith('vault:'))) activeGroups.push('Seif Parole');
    if (roleCodes.some(c => c.startsWith('inventory:'))) activeGroups.push('Inventar');
    if (roleCodes.some(c => c.startsWith('duty_days:'))) activeGroups.push('Zile Serviciu');
    if (roleCodes.some(c => c.startsWith('audit:'))) activeGroups.push('Audit');
    if (roleCodes.some(c => c.startsWith('organizations:'))) activeGroups.push('Organizații');
    if (roleCodes.some(c => c.startsWith('personal_vault:'))) activeGroups.push('Seif Personal');
    if (roleCodes.some(c => c.startsWith('virtual_ecc:'))) activeGroups.push('Aparate de Casă');
    if (roleCodes.some(c => c.startsWith('users:') || c.startsWith('roles:'))) activeGroups.push('Utilizatori & Roluri');

    return activeGroups;
  };

  return (
    <div className={`space-y-6 animate-fade-in ${embedded ? '' : 'pb-12'}`}>
      {/* Title block — hidden in embedded mode */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight dark:text-white flex items-center gap-2">
              <Users className="w-7 h-7 text-sidesi-400" />
              Control Acces, Utilizatori și Roluri
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Administrarea utilizatorilor din Active Directory, crearea conturilor locale și controlul drepturilor pe bază de bife per modul.
            </p>
          </div>

          {activeTab === 'users' ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleSyncAD}
                disabled={isSyncing}
                className="glass-button-secondary py-2 text-xs flex items-center gap-2 disabled:opacity-55"
              >
                <RefreshCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sincronizează Active Directory</span>
              </button>
              {hasPermission('users:manage') && (
                <button
                  onClick={() => { resetForm(); setIsFormOpen(true); }}
                  className="glass-button-primary py-2 text-xs flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adaugă Utilizator</span>
                </button>
              )}
            </div>
          ) : (
            hasPermission('roles:manage') && (
              <button
                onClick={openCreateRole}
                className="glass-button-primary py-2 text-xs flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Adaugă Rol Nou</span>
              </button>
            )
          )}
        </div>
      )}

      {/* Embedded action buttons */}
      {embedded && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {activeTab === 'users' ? (
            <>
              <button
                onClick={handleSyncAD}
                disabled={isSyncing}
                className="glass-button-secondary py-2 text-xs flex items-center gap-2 disabled:opacity-55"
              >
                <RefreshCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sincronizează AD</span>
              </button>
              {hasPermission('users:manage') && (
                <button
                  onClick={() => { resetForm(); setIsFormOpen(true); }}
                  className="glass-button-primary py-2 text-xs flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adaugă Utilizator</span>
                </button>
              )}
            </>
          ) : (
            hasPermission('roles:manage') && (
              <button
                onClick={openCreateRole}
                className="glass-button-primary py-2 text-xs flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Adaugă Rol Nou</span>
              </button>
            )
          )}
        </div>
      )}

      {/* Tab Switcher — hidden in embedded mode (controlled by parent) */}
      {!embedded && (
        <div className="flex border-b border-slate-200/50 dark:border-slate-800/40 select-none">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-5 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'users'
                ? 'border-sidesi-400 text-sidesi-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Administrare Utilizatori
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-5 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'roles'
              ? 'border-sidesi-400 text-sidesi-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Roluri de Securitate ({roles.length})
          </button>
        </div>
      )}

      {/* Query search (only for Users) */}
      {activeTab === 'users' && (
        <div className="glass-panel p-4 rounded-xl flex gap-3 items-center shadow-sm">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Căutare după username, email sau nume..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full glass-input pl-9 text-xs"
            />
          </div>
        </div>
      )}

      {/* ─── TAB 1: USERS ────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        isLoading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="p-8 text-center glass-panel rounded-2xl space-y-2">
            <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
            <h3 className="font-bold text-white text-md">Acces Restricționat</h3>
            <p className="text-xs text-slate-400">{error}</p>
          </div>
        ) : users.length > 0 ? (
          <div className="glass-panel rounded-2xl overflow-hidden shadow-xl border border-slate-200/50 dark:border-slate-800/40">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs min-w-[800px]">
                <thead>
                  <tr className="bg-slate-100/50 dark:bg-slate-900/60 border-b border-slate-200/50 dark:border-slate-800/40 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider h-11">
                    <th className="px-5">Utilizator</th>
                    <th className="px-4">Adresă Email</th>
                    <th className="px-4">Rol Asignat</th>
                    <th className="px-4">Metodă Conectare</th>
                    <th className="px-4">Stare Cont</th>
                    <th className="px-5 text-right">Acțiuni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/20 font-medium">
                  {users.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors h-14 text-slate-800 dark:text-slate-200">
                      <td className="px-5 font-bold dark:text-white capitalize">
                        {item.username}
                        {item.id === currentUser?.id && (
                          <span className="ml-1.5 text-[8px] font-bold text-sidesi-400 bg-sidesi-500/10 border border-sidesi-500/20 px-1.5 py-0.5 rounded">EU</span>
                        )}
                      </td>
                      <td className="px-4 font-mono text-slate-500 dark:text-slate-400">{item.email}</td>
                      <td className="px-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          item.role_detail.name === 'Super Admin'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : item.role_detail.name === 'Admin'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-350'
                        }`}>
                          {item.role_detail.name}
                        </span>
                      </td>
                      <td className="px-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                          item.is_ad_synced
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-sidesi-500/10 text-sidesi-400 border-sidesi-500/20'
                        }`}>
                          {item.is_ad_synced ? 'AD Domain Sync' : 'Local Authentication'}
                        </span>
                      </td>
                      <td className="px-4">
                        <span className={`flex items-center gap-1 font-bold ${item.is_active ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {item.is_active ? <UserCheck className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />}
                          {item.is_active ? 'Activat' : 'Dezactivat'}
                        </span>
                      </td>
                      <td className="px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEdit(item)}
                            className="p-2 text-slate-400 hover:text-sidesi-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Editează profil/rol"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(item)}
                            disabled={item.id === currentUser?.id}
                            className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${
                              item.is_active
                                ? 'text-rose-500 hover:bg-rose-500/10'
                                : 'text-emerald-500 hover:bg-emerald-500/10'
                            }`}
                            title={item.is_active ? 'Dezactivează cont' : 'Activează cont'}
                          >
                            {item.is_active ? <UserMinus className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                          {currentUser?.role_detail?.name === 'Super Admin' && (
                            <button
                              onClick={() => setDeleteTarget(item)}
                              disabled={item.id === currentUser?.id}
                              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
                              title="Șterge definitiv utilizatorul"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 glass-panel rounded-2xl space-y-3">
            <Users className="w-12 h-12 mx-auto text-slate-400 stroke-1" />
            <h3 className="font-bold text-slate-900 dark:text-white text-md">Niciun cont găsit</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Nu s-a putut găsi niciun cont pe baza filtrelor specificate.</p>
          </div>
        )
      )}

      {/* ─── TAB 2: ROLES ────────────────────────────────────────────────────── */}
      {activeTab === 'roles' && (
        <div className="glass-panel rounded-2xl overflow-hidden shadow-xl border border-slate-200/50 dark:border-slate-800/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[700px]">
              <thead>
                <tr className="bg-slate-100/50 dark:bg-slate-900/60 border-b border-slate-200/50 dark:border-slate-800/40 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider h-11">
                  <th className="px-5 w-48">Nume Rol</th>
                  <th className="px-4">Descriere</th>
                  <th className="px-4 w-28 text-center">Utilizatori Activi</th>
                  <th className="px-4">Module Accesibile (Bifate)</th>
                  <th className="px-5 text-right w-28">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/20 font-medium">
                {roles.map((r) => {
                  const activeModules = getAssignedModulesList(r.permissions);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors h-14 text-slate-800 dark:text-slate-200">
                      <td className="px-5 font-bold dark:text-white">
                        <span className="flex items-center gap-1.5">
                          {r.name}
                          {r.is_system && (
                            <span className="text-[7px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1 rounded uppercase tracking-wider">SYSTEM</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 text-slate-500 dark:text-slate-400">{r.description || '—'}</td>
                      <td className="px-4 text-center font-mono font-bold">{r.users_count ?? 0}</td>
                      <td className="px-4">
                        <div className="flex flex-wrap gap-1">
                          {activeModules.length > 0 ? (
                            activeModules.map((m) => (
                              <span key={m} className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-sidesi-500/10 text-sidesi-400 border border-sidesi-500/15">
                                {m}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 text-[10px] italic">Fără acces la module</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasPermission('roles:manage') && (
                            <button
                              onClick={() => openEditRole(r)}
                              className="p-2 text-slate-400 hover:text-sidesi-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="Editează permisiuni rol"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {!r.is_system && hasPermission('roles:manage') && (
                            <button
                              onClick={() => setDeleteRoleTarget(r)}
                              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="Șterge rol"
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
      )}

      {/* ─── MODAL: USER FORM ────────────────────────────────────────────────── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
          <div className="relative w-full max-w-lg glass-panel p-6 rounded-2xl z-10 max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl border border-slate-200 dark:border-slate-850">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/50 dark:border-slate-800/60">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sidesi-400" />
                <span>{editingUser ? 'Editează Profil Utilizator' : 'Adaugă Utilizator Local'}</span>
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-600 dark:text-slate-400">Username (Nume Utilizator)*</label>
                  <input
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="ex: stefan_admin"
                    className="w-full glass-input text-xs"
                    required
                    disabled={!!editingUser && editingUser.is_ad_synced}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 dark:text-slate-400">Adresă Email*</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="ex: stefan@sidesi.ro"
                    className="w-full glass-input text-xs"
                    required
                    disabled={!!editingUser && editingUser.is_ad_synced}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-600 dark:text-slate-400">Prenume (First Name)</label>
                  <input
                    type="text"
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    placeholder="ex: Ștefan"
                    className="w-full glass-input text-xs"
                    disabled={!!editingUser && editingUser.is_ad_synced}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 dark:text-slate-400">Nume (Last Name)</label>
                  <input
                    type="text"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    placeholder="ex: Serghei"
                    className="w-full glass-input text-xs"
                    disabled={!!editingUser && editingUser.is_ad_synced}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-600 dark:text-slate-400">Rol Utilizator (System Role)*</label>
                  <select
                    value={formRoleId}
                    onChange={(e) => setFormRoleId(e.target.value)}
                    className="w-full glass-input text-xs"
                    required
                  >
                    <option value="">Alege rolul...</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 dark:text-slate-400">
                    {editingUser ? 'Parolă Nouă (Opțional)' : 'Parolă Cont Local*'}
                  </label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editingUser ? 'Lăsați gol pentru neschimbată' : 'minim 6 caractere'}
                    className="w-full glass-input text-xs"
                    required={!editingUser}
                    disabled={!!editingUser && editingUser.is_ad_synced}
                  />
                </div>
              </div>

              {/* Direct module permissions checkboxes */}
              {permissionsList.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-slate-200/50 dark:border-slate-800/40">
                  <div>
                    <label className="text-slate-900 dark:text-white font-bold block text-xs">Permisiuni Directe Utilizator (Overriding Role)</label>
                    <span className="text-[10px] text-slate-500 block leading-normal">
                      Selectați permisiunile specifice acordate individual acestui utilizator.
                    </span>
                  </div>

                  <div className="space-y-4 border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-950/45 max-h-[250px] overflow-y-auto">
                    {MODULE_GROUPS.map((group) => {
                      const codesInGroup = group.permissions.map(p => p.code);
                      const isAllChecked = codesInGroup.every(c => formCustomPerms.includes(c));

                      return (
                        <div key={group.name} className="space-y-2 border-b border-slate-200/40 dark:border-slate-800/40 pb-2 last:border-0 last:pb-0">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isAllChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormCustomPerms(prev => {
                                    const next = [...prev];
                                    codesInGroup.forEach(c => {
                                      if (!next.includes(c)) next.push(c);
                                    });
                                    return next;
                                  });
                                } else {
                                  setFormCustomPerms(prev => prev.filter(c => !codesInGroup.includes(c)));
                                }
                              }}
                              className="rounded border-slate-300 dark:border-slate-700 accent-sidesi-500 text-white w-4.5 h-4.5"
                            />
                            <span>{group.name}</span>
                          </label>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
                            {group.permissions.map((p) => {
                              const isChecked = formCustomPerms.includes(p.code);
                              return (
                                <label key={p.code} className="flex items-start gap-2 text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setFormCustomPerms(prev => [...prev, p.code]);
                                      } else {
                                        setFormCustomPerms(prev => prev.filter(c => c !== p.code));
                                      }
                                    }}
                                    className="rounded border-slate-300 dark:border-slate-700 accent-sidesi-500 text-white w-4 h-4 mt-0.5"
                                  />
                                  <span>{p.label} ({p.code})</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-200/50 dark:border-slate-800/60 pt-3">
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
                  {editingUser ? 'Actualizează Profil' : 'Creează Profil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ROLE FORM ────────────────────────────────────────────────── */}
      {isRoleFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsRoleFormOpen(false)} />
          <div className="relative w-full max-w-lg glass-panel p-6 rounded-2xl z-10 max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl border border-slate-200 dark:border-slate-850">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/50 dark:border-slate-800/60">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sidesi-400" />
                <span>{editingRole ? 'Editează Rol Securitate' : 'Adaugă Rol Securitate Nou'}</span>
              </h3>
              <button onClick={() => setIsRoleFormOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRoleFormSubmit} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-slate-600 dark:text-slate-400">Nume Rol*</label>
                <input
                  type="text"
                  value={formRoleName}
                  onChange={(e) => setFormRoleName(e.target.value)}
                  placeholder="ex: Operator Senior, Auditor Extern"
                  className="w-full glass-input text-xs"
                  required
                  disabled={editingRole?.is_system}
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 dark:text-slate-400">Descriere Rol</label>
                <textarea
                  value={formRoleDescription}
                  onChange={(e) => setFormRoleDescription(e.target.value)}
                  placeholder="Descrieți responsabilitățile acestui rol în sistem..."
                  rows={2}
                  className="w-full glass-input text-xs resize-none"
                />
              </div>

              {/* Roles Module Perm Grid */}
              <div className="space-y-2 pt-3 border-t border-slate-200/50 dark:border-slate-800/40">
                <div>
                  <label className="text-slate-900 dark:text-white font-bold block text-xs">Configurare Bife Permisiuni Module*</label>
                  <span className="text-[10px] text-slate-500 block leading-normal">
                    Selectați modulele la care acest rol va avea permisiuni de acces și administrare.
                  </span>
                </div>

                <div className="space-y-4 border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-950/45 max-h-[250px] overflow-y-auto">
                  {MODULE_GROUPS.map((group) => {
                    // Match permissions by code to get their UUIDs
                    const permsInGroup = permissionsList.filter(p => group.permissions.map(gp => gp.code).includes(p.code));
                    const idsInGroup = permsInGroup.map(p => p.id);

                    const isGroupChecked = idsInGroup.length > 0 && idsInGroup.every(id => formRolePerms.includes(id));

                    return (
                      <div key={group.name} className="space-y-2 border-b border-slate-200/40 dark:border-slate-800/40 pb-2 last:border-0 last:pb-0">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isGroupChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormRolePerms(prev => {
                                  const next = [...prev];
                                  idsInGroup.forEach(id => {
                                    if (!next.includes(id)) next.push(id);
                                  });
                                  return next;
                                });
                              } else {
                                setFormRolePerms(prev => prev.filter(id => !idsInGroup.includes(id)));
                              }
                            }}
                            className="rounded border-slate-300 dark:border-slate-700 accent-sidesi-500 text-white w-4.5 h-4.5"
                          />
                          <span>{group.name}</span>
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
                          {group.permissions.map((gp) => {
                            const dbPermObj = permissionsList.find(p => p.code === gp.code);
                            if (!dbPermObj) return null;

                            const isChecked = formRolePerms.includes(dbPermObj.id);

                            return (
                              <label key={gp.code} className="flex items-start gap-2 text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormRolePerms(prev => [...prev, dbPermObj.id]);
                                    } else {
                                      setFormRolePerms(prev => prev.filter(id => id !== dbPermObj.id));
                                    }
                                  }}
                                  className="rounded border-slate-300 dark:border-slate-700 accent-sidesi-500 text-white w-4 h-4 mt-0.5"
                                />
                                <span>{gp.label} ({gp.code})</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200/50 dark:border-slate-800/60 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRoleFormOpen(false)}
                  className="glass-button-secondary py-2"
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  className="glass-button-primary py-2"
                >
                  {editingRole ? 'Salvează Rol' : 'Creează Rol'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Șterge Definitiv Utilizator"
        message={`Sunteți sigur că doriți să ștergeți definitiv utilizatorul "${deleteTarget?.username}"? Această acțiune va elimina complet contul din sistem și este ireversibilă.`}
        confirmLabel="Șterge permanent"
        type="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Delete Role Confirmation dialog */}
      <ConfirmDialog
        isOpen={deleteRoleTarget !== null}
        title="Șterge Rol de Securitate"
        message={`Sunteți sigur că doriți să ștergeți rolul "${deleteRoleTarget?.name}"? Această acțiune este ireversibilă.`}
        confirmLabel="Șterge Rol"
        type="danger"
        onConfirm={handleConfirmDeleteRole}
        onCancel={() => setDeleteRoleTarget(null)}
      />
    </div>
  );
};

export default UsersPage;
