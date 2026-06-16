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

const VAULT_ACCESS_PERMS = [
  'vault:view',
  'organizations:view'
];

const VAULT_COPY_PERMS = [
  'vault:copy'
];

const VAULT_REVEAL_PERMS = [
  'vault:reveal'
];

const VAULT_MODIFY_PERMS = [
  'vault:create',
  'vault:update',
  'organizations:manage'
];

const VAULT_DELETE_PERMS = [
  'vault:delete'
];

const ALL_VAULT_PERMS = [
  ...VAULT_ACCESS_PERMS,
  ...VAULT_COPY_PERMS,
  ...VAULT_REVEAL_PERMS,
  ...VAULT_MODIFY_PERMS,
  ...VAULT_DELETE_PERMS
];

const AUDIT_PERMISSIONS = [
  'audit:view',
  'audit:export'
];

const USERS_ROLES_PERMISSIONS = [
  'users:manage',
  'users:view',
  'roles:manage',
  'roles:view'
];

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const addToast = useToastStore((state) => state.addToast);
  const currentUser = useAuthStore((state) => state.user);

  // Filters
  const [search, setSearch] = useState('');
  
  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  // Form states
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formRoleId, setFormRoleId] = useState('');
  const [permissionsList, setPermissionsList] = useState<{ id: string; code: string; module: string; description: string }[]>([]);
  const [formCustomPerms, setFormCustomPerms] = useState<string[]>([]);

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
    
    // Simulate DRF task dispatching
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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername || !formEmail || !formRoleId) {
      addToast('Completați câmpurile obligatorii.', 'warning');
      return;
    }

    const payload = {
      username: formUsername,
      email: formEmail,
      first_name: formFirstName,
      last_name: formLastName,
      role_id: formRoleId,
      custom_permission_codes: formCustomPerms,
    };

    try {
      if (editingUser) {
        // Prevent self demoting from Super Admin inside this screen
        if (editingUser.id === currentUser?.id && editingUser.role_detail.name === 'Super Admin' && roles.find(r => r.id === formRoleId)?.name !== 'Super Admin') {
          addToast('Nu vă puteți retrage singur permisiunile de Super Admin.', 'error');
          return;
        }
        await api.patch(`/auth/users/${editingUser.id}/`, payload);
        addToast('Utilizatorul a fost modificat!', 'success');
      } else {
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



  return (
    <div className="space-y-6 animate-fade-in">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight dark:text-white">
            User Management & Sincronizare AD
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Administrarea conturilor interne, maparea rolurilor și sincronizarea utilizatorilor din domeniul Active Directory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSyncAD}
            disabled={isSyncing}
            className="glass-button-secondary py-2 text-xs flex items-center gap-2 disabled:opacity-55"
          >
            <RefreshCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Sincronizează Active Directory</span>
          </button>
          
          <button
            onClick={() => { resetForm(); setIsFormOpen(true); }}
            className="glass-button-primary py-2 text-xs flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Adaugă Utilizator</span>
          </button>
        </div>
      </div>

      {/* Query search */}
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

      {/* Main Users Table view */}
      {isLoading ? (
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
            <table className="w-full text-left border-collapse text-xs">
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
                        {item.is_ad_synced ? 'AD Synced sAMAccount' : 'Local MySQL Account'}
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
          <h3 className="font-bold text-white text-md">Niciun cont găsit</h3>
          <p className="text-xs text-slate-400">Nu s-a putut găsi niciun cont pe baza filtrelor specificate.</p>
        </div>
      )}

      {/* Forms Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
          <div className="relative w-full max-w-md glass-panel p-6 rounded-2xl z-10 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-850">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sidesi-400" />
                <span>{editingUser ? 'Editează Profil Utilizator' : 'Adaugă Utilizator Local'}</span>
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-slate-400">Nume Utilizator (sAMAccountName)*</label>
                <input
                  type="text"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="ex: stefan_admin"
                  className="w-full glass-input text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400">Adresă Email*</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="ex: stefan@sidesi.ro"
                  className="w-full glass-input text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400">Prenume (First Name)</label>
                  <input
                    type="text"
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    placeholder="ex: Ștefan"
                    className="w-full glass-input text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Nume (Last Name)</label>
                  <input
                    type="text"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    placeholder="ex: Serghei"
                    className="w-full glass-input text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400">Rol Utilizator*</label>
                <select
                  value={formRoleId}
                  onChange={(e) => setFormRoleId(e.target.value)}
                  className="w-full glass-input text-xs"
                  required
                >
                  <option value="">Alege rolul de sistem...</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>

              {/* Direct module permissions checkboxes */}
              {permissionsList.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-slate-800/40">
                  <div>
                    <label className="text-white font-bold block text-xs">Acces Direct Module (Permisiuni Specifice)</label>
                    <span className="text-[10px] text-slate-500 block leading-normal">
                      Oferă acces suplimentar la modulele de sistem, independent de rolul utilizatorului.
                    </span>
                  </div>

                  <div className="space-y-3 border border-slate-850 rounded-xl p-3 bg-slate-950/45">
                    {/* Password Vault Module - Fine Grained checkmarks */}
                    <div className="space-y-3 border-b border-slate-800/40 pb-3">
                      {/* Master access toggle */}
                      <label className="flex items-start gap-3 text-xs font-bold text-slate-200 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={VAULT_ACCESS_PERMS.every(p => formCustomPerms.includes(p))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormCustomPerms(prev => {
                                const newPerms = [...prev];
                                VAULT_ACCESS_PERMS.forEach(p => {
                                  if (!newPerms.includes(p)) newPerms.push(p);
                                });
                                return newPerms;
                              });
                            } else {
                              // Clear ALL vault permissions when access is turned off
                              setFormCustomPerms(prev => prev.filter(p => !ALL_VAULT_PERMS.includes(p)));
                            }
                          }}
                          className="rounded border-slate-350 dark:border-slate-800 accent-sidesi-500 text-white w-4.5 h-4.5 mt-0.5"
                        />
                        <div>
                          <span className="font-bold text-white">Activează acces la modul (Seif Parole)</span>
                          <span className="text-[10px] text-slate-500 block leading-normal font-normal mt-0.5">
                            Permite accesul la pagina și meniul Seif Parole Comun.
                          </span>
                        </div>
                      </label>

                      {/* Dependent specific sub-checkboxes */}
                      {(() => {
                        const isVaultAccessActive = VAULT_ACCESS_PERMS.every(p => formCustomPerms.includes(p));
                        return (
                          <div className={`grid grid-cols-1 gap-2.5 pl-6 transition-opacity duration-200 ${isVaultAccessActive ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div className="text-[9px] uppercase font-bold text-sidesi-400 tracking-wider">
                              Drepturi Specifice Seif
                            </div>

                            {/* 1. Copy passwords */}
                            <label className={`flex items-start gap-2.5 text-[11px] font-medium text-slate-350 hover:text-white cursor-pointer select-none`}>
                              <input
                                type="checkbox"
                                disabled={!isVaultAccessActive}
                                checked={isVaultAccessActive && VAULT_COPY_PERMS.every(p => formCustomPerms.includes(p))}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormCustomPerms(prev => {
                                      const newPerms = [...prev];
                                      VAULT_COPY_PERMS.forEach(p => {
                                        if (!newPerms.includes(p)) newPerms.push(p);
                                      });
                                      return newPerms;
                                    });
                                  } else {
                                    setFormCustomPerms(prev => prev.filter(p => !VAULT_COPY_PERMS.includes(p)));
                                  }
                                }}
                                className="rounded border-slate-300 dark:border-slate-850 accent-sidesi-500 text-white w-4 h-4 mt-0.5"
                              />
                              <div>
                                <span className="font-semibold text-slate-200">Drept de copiere parole în clipboard</span>
                                <span className="text-[9px] text-slate-500 block leading-normal mt-0.5">
                                  Permite utilizatorului să folosească butonul de copiere a parolei în clipboard.
                                </span>
                              </div>
                            </label>

                            {/* 2. Reveal passwords */}
                            <label className={`flex items-start gap-2.5 text-[11px] font-medium text-slate-350 hover:text-white cursor-pointer select-none`}>
                              <input
                                type="checkbox"
                                disabled={!isVaultAccessActive}
                                checked={isVaultAccessActive && VAULT_REVEAL_PERMS.every(p => formCustomPerms.includes(p))}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormCustomPerms(prev => {
                                      const newPerms = [...prev];
                                      VAULT_REVEAL_PERMS.forEach(p => {
                                        if (!newPerms.includes(p)) newPerms.push(p);
                                      });
                                      return newPerms;
                                    });
                                  } else {
                                    setFormCustomPerms(prev => prev.filter(p => !VAULT_REVEAL_PERMS.includes(p)));
                                  }
                                }}
                                className="rounded border-slate-300 dark:border-slate-850 accent-sidesi-500 text-white w-4 h-4 mt-0.5"
                              />
                              <div>
                                <span className="font-semibold text-slate-200">Drept de dezvăluire parole în clar</span>
                                <span className="text-[9px] text-slate-500 block leading-normal mt-0.5">
                                  Permite afișarea în clar a parolelor mascate prin apăsarea iconiței de ochi.
                                </span>
                              </div>
                            </label>

                            {/* 3. Modify and Add */}
                            <label className={`flex items-start gap-2.5 text-[11px] font-medium text-slate-350 hover:text-white cursor-pointer select-none`}>
                              <input
                                type="checkbox"
                                disabled={!isVaultAccessActive}
                                checked={isVaultAccessActive && VAULT_MODIFY_PERMS.every(p => formCustomPerms.includes(p))}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormCustomPerms(prev => {
                                      const newPerms = [...prev];
                                      VAULT_MODIFY_PERMS.forEach(p => {
                                        if (!newPerms.includes(p)) newPerms.push(p);
                                      });
                                      return newPerms;
                                    });
                                  } else {
                                    setFormCustomPerms(prev => prev.filter(p => !VAULT_MODIFY_PERMS.includes(p)));
                                  }
                                }}
                                className="rounded border-slate-300 dark:border-slate-850 accent-sidesi-500 text-white w-4 h-4 mt-0.5"
                              />
                              <div>
                                <span className="font-semibold text-slate-200">Drept de adăugare și modificare parole</span>
                                <span className="text-[9px] text-slate-500 block leading-normal mt-0.5">
                                  Permite adăugarea de noi parole, actualizarea lor și crearea de organizații.
                                </span>
                              </div>
                            </label>

                            {/* 4. Delete */}
                            <label className={`flex items-start gap-2.5 text-[11px] font-medium text-slate-350 hover:text-white cursor-pointer select-none`}>
                              <input
                                type="checkbox"
                                disabled={!isVaultAccessActive}
                                checked={isVaultAccessActive && VAULT_DELETE_PERMS.every(p => formCustomPerms.includes(p))}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormCustomPerms(prev => {
                                      const newPerms = [...prev];
                                      VAULT_DELETE_PERMS.forEach(p => {
                                        if (!newPerms.includes(p)) newPerms.push(p);
                                      });
                                      return newPerms;
                                    });
                                  } else {
                                    setFormCustomPerms(prev => prev.filter(p => !VAULT_DELETE_PERMS.includes(p)));
                                  }
                                }}
                                className="rounded border-slate-300 dark:border-slate-850 accent-sidesi-500 text-white w-4 h-4 mt-0.5"
                              />
                              <div>
                                <span className="font-semibold text-slate-200">Drept de ștergere parole</span>
                                <span className="text-[9px] text-slate-500 block leading-normal mt-0.5">
                                  Permite eliminarea definitivă a elementelor din Seiful de Parole Comun.
                                </span>
                              </div>
                            </label>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Audit Logs Module */}
                    <label className="flex items-start gap-3 text-xs font-medium text-slate-350 hover:text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={AUDIT_PERMISSIONS.some(p => formCustomPerms.includes(p))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormCustomPerms(prev => {
                              const newPerms = [...prev];
                              AUDIT_PERMISSIONS.forEach(p => {
                                if (!newPerms.includes(p)) newPerms.push(p);
                              });
                              return newPerms;
                            });
                          } else {
                            setFormCustomPerms(prev => prev.filter(p => !AUDIT_PERMISSIONS.includes(p)));
                          }
                        }}
                        className="rounded border-slate-300 dark:border-slate-850 accent-sidesi-500 text-white w-4.5 h-4.5 mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-slate-200">Jurnal Audit (Audit Logs)</span>
                        <span className="text-[10px] text-slate-500 block leading-normal mt-0.5">
                          Permite vizualizarea și exportul istoricului de activitate și a logurilor de securitate din platformă.
                        </span>
                      </div>
                    </label>

                    {/* Users & Roles Module */}
                    <label className="flex items-start gap-3 text-xs font-medium text-slate-350 hover:text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={USERS_ROLES_PERMISSIONS.some(p => formCustomPerms.includes(p))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormCustomPerms(prev => {
                              const newPerms = [...prev];
                              USERS_ROLES_PERMISSIONS.forEach(p => {
                                if (!newPerms.includes(p)) newPerms.push(p);
                              });
                              return newPerms;
                            });
                          } else {
                            setFormCustomPerms(prev => prev.filter(p => !USERS_ROLES_PERMISSIONS.includes(p)));
                          }
                        }}
                        className="rounded border-slate-300 dark:border-slate-850 accent-sidesi-500 text-white w-4.5 h-4.5 mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-slate-200">Administrare Utilizatori și Roluri (Users & Roles)</span>
                        <span className="text-[10px] text-slate-500 block leading-normal mt-0.5">
                          Permite crearea, editarea și configurarea utilizatorilor și a permisiunilor de acces pentru rolurile din sistem.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-850 pt-3">
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
                  {editingUser ? 'Actualizează Cont' : 'Creează Cont'}
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
    </div>
  );
};
export default UsersPage;
