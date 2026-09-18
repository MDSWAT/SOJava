import React, { useEffect, useState } from 'react';
import { 
  Shield, Cpu, ToggleLeft, ToggleRight, Loader2,
  Settings as SettingsIcon, Users as UsersIcon, KeyRound
} from 'lucide-react';
import api from '@/services/api';
import { RoleDetail, Permission } from '@/types';
import TableSkeleton from '@/components/ui/Skeleton';
import { useToastStore } from '@/context/toastStore';
import { useAuthStore } from '@/context/authStore';
import { UsersPage } from '@/pages/Users';

type Role = RoleDetail;

type SettingsTab = 'system' | 'users' | 'roles';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('system');
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addToast = useToastStore((state) => state.addToast);
  const { user, hasPermission } = useAuthStore();

  // Active Modules Toggle States
  const [modules, setModules] = useState({
    dashboard: true,
    vault: true,
    personal: true,
    audit: true,
    settings: true,
    loader: false, // Future modules loader
  });

  const loadSettingsData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rolesRes = await api.get('/auth/roles/');
      const permRes = await api.get('/auth/permissions/');
      
      const rolesData = rolesRes.data.results || rolesRes.data;
      const permsData = permRes.data.results || permRes.data;
      
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      setPermissions(Array.isArray(permsData) ? permsData : []);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Eroare la încărcarea setărilor. Numai Super Adminul are acces.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  const handleToggleModule = (mod: keyof typeof modules) => {
    if (user?.role_detail.name !== 'Super Admin') {
      addToast('Doar Super Adminul poate activa sau dezactiva module.', 'error');
      return;
    }
    
    // Toggle state
    const updated = { ...modules, [mod]: !modules[mod] };
    setModules(updated);
    addToast(`Modulul "${mod.toUpperCase()}" a fost ${updated[mod] ? 'ACTIVAT' : 'DEZACTIVAT'} cu succes!`, 'success');
  };

  // Matrix check helper
  const isPermissionGranted = (role: Role, permCode: string) => {
    return (role.permissions || []).some((p: Permission) => p.code === permCode);
  };

  // Handle saving permissions modifications (matrix sync)
  const handleTogglePermission = async (role: Role, perm: Permission) => {
    if (user?.role_detail.name !== 'Super Admin') {
      addToast('Doar Super Adminul poate modifica permisiunile rolurilor.', 'error');
      return;
    }

    if (role.name === 'Super Admin') {
      addToast('Permisiunile rolului Super Admin sunt implicite și nu pot fi modificate.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const alreadyHas = isPermissionGranted(role, perm.code);
      let updatedPermIds: string[] = [];

      const currentPerms = role.permissions || [];
      if (alreadyHas) {
        // Remove it
        updatedPermIds = currentPerms
          .filter((p: Permission) => p.code !== perm.code)
          .map((p: Permission) => p.id);
      } else {
        // Add it
        updatedPermIds = [...currentPerms.map((p: Permission) => p.id), perm.id];
      }

      await api.put(`/auth/roles/${role.id}/`, {
        name: role.name,
        permission_ids: updatedPermIds
      });

      addToast(`Permisiune actualizată pentru rolul ${role.name}!`, 'success');
      loadSettingsData();
    } catch (err) {
      addToast('Modificarea permisiunii a eșuat.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const canManageUsers = hasPermission('users:manage');
  const canManageRoles = hasPermission('roles:manage');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight dark:text-white flex items-center gap-2">
          <SettingsIcon className="w-7 h-7 text-sidesi-400" />
          Setări Sistem
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Configurarea modulelor, sincronizarea AD/LDAP, managementul utilizatorilor și controlul granular al permisiunilor (RBAC).
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200/50 dark:border-slate-800/40 select-none">
        <button
          onClick={() => setActiveTab('system')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'system'
              ? 'border-sidesi-400 text-sidesi-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>Sistem & Module</span>
        </button>
        {canManageUsers && (
          <button
            onClick={() => setActiveTab('users')}
            className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'users'
                ? 'border-sidesi-400 text-sidesi-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UsersIcon className="w-4 h-4" />
            <span>Utilizatori</span>
          </button>
        )}
        {canManageRoles && (
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'roles'
                ? 'border-sidesi-400 text-sidesi-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Roluri & Permisiuni</span>
          </button>
        )}
      </div>

      {/* ─── TAB: SYSTEM ─────────────────────────────────────────────────────── */}
      {activeTab === 'system' && (
        error ? (
          <div className="p-8 text-center glass-panel rounded-2xl space-y-2">
            <Shield className="w-12 h-12 text-rose-500 mx-auto" />
            <h3 className="font-bold text-slate-900 dark:text-white text-md">Setări Indisponibile</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Module Loader & Status - spans 1 column */}
            <div className="space-y-4">
              <div className="glass-panel p-5 rounded-2xl space-y-4">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">Module Active SIDESI</h3>
                  <p className="text-[10px] text-slate-500">Dezactivează modulele neutilizate pentru a mări performanța sau securitatea.</p>
                </div>

                <div className="space-y-3.5 pt-2">
                  {Object.entries(modules).map(([modName, isActive]) => (
                    <div key={modName} className="flex justify-between items-center bg-slate-100 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-850">
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase truncate">
                          {modName === 'loader' ? 'FUTURE LOADER' : `${modName} MODULE`}
                        </p>
                        <p className="text-[9px] text-slate-500">
                          {modName === 'vault' && 'Password Vault, Excel Import/Export'}
                          {modName === 'personal' && 'Personal secrets and private note'}
                          {modName === 'audit' && 'System operations compliance timeline'}
                          {modName === 'loader' && 'Sistem de import dinamic microservicii'}
                          {(!['vault', 'personal', 'audit', 'loader'].includes(modName)) && 'Core system module details'}
                        </p>
                      </div>

                      <button
                        onClick={() => handleToggleModule(modName as any)}
                        className={`text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors`}
                      >
                        {isActive ? (
                          <ToggleRight className="w-9 h-9 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-9 h-9 text-slate-600" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* AD LDAP Info config */}
              <div className="glass-panel p-5 rounded-2xl space-y-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-sidesi-400" />
                  <span>Configurare AD / LDAP Connection</span>
                </h3>
                
                <div className="text-[10px] space-y-2 leading-relaxed text-slate-600 dark:text-slate-400 font-semibold">
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-200/50 dark:border-slate-800/40">
                    <span>Server LDAP:</span>
                    <span className="font-mono text-slate-900 dark:text-white">ldap://ccl-dc.sidesi.local</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-200/50 dark:border-slate-800/40">
                    <span>Port protocol:</span>
                    <span className="font-mono text-slate-900 dark:text-white">389 (SSL: 636)</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-200/50 dark:border-slate-800/40">
                    <span>Baza sAMAccount:</span>
                    <span className="font-mono text-slate-900 dark:text-white">OU=Users,DC=sidesi,DC=local</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span>Celery Auto-Sync interval:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">Zilnic (Daily @ 02:00)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Granular RBAC Check Matrix - spans 2 columns */}
            <div className="lg:col-span-2 space-y-4">
              <div className="glass-panel p-5 rounded-2xl space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">Matrice Granulară Drepturi (RBAC)</h3>
                    <p className="text-[10px] text-slate-500">Vizualizează și bifează permisiunile alocate fiecărui rol din sistem.</p>
                  </div>
                  {isSaving && (
                    <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Se salvează...</span>
                    </span>
                  )}
                </div>

                {isLoading ? (
                  <TableSkeleton />
                ) : (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-850 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs font-semibold">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 font-bold h-10 select-none">
                          <th className="px-4 py-2">Cod Permisiune</th>
                          {roles.map(role => (
                            <th key={role.id} className="px-3 py-2 text-center whitespace-nowrap">
                              {role.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-850 font-medium">
                        {permissions.map((perm) => (
                          <tr key={perm.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/10 text-slate-700 dark:text-slate-300 h-11">
                            <td className="px-4 py-1.5">
                              <p className="font-bold text-slate-800 dark:text-slate-200 font-mono text-[10px]">{perm.code}</p>
                              <p className="text-[9px] text-slate-500 font-sans leading-normal font-medium">{perm.description}</p>
                            </td>
                            {roles.map(role => {
                              const isGranted = isPermissionGranted(role, perm.code);
                              const isSuper = role.name === 'Super Admin';
                              
                              return (
                                <td key={role.id} className="px-3 py-1.5 text-center">
                                  <label className="inline-flex items-center justify-center cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={isSuper || isGranted}
                                      disabled={isSuper || isSaving || user?.role_detail.name !== 'Super Admin'}
                                      onChange={() => handleTogglePermission(role, perm)}
                                      className="rounded border-slate-300 dark:border-slate-850 text-white accent-sidesi-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                                    />
                                  </label>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      )}

      {/* ─── TAB: USERS ──────────────────────────────────────────────────────── */}
      {activeTab === 'users' && canManageUsers && (
        <UsersPage embedded initialTab="users" />
      )}

      {/* ─── TAB: ROLES ──────────────────────────────────────────────────────── */}
      {activeTab === 'roles' && canManageRoles && (
        <UsersPage embedded initialTab="roles" />
      )}
    </div>
  );
};

export default SettingsPage;
