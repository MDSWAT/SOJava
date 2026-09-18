import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/context/authStore';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import PasswordVault from '@/pages/PasswordVault';
import PersonalVault from '@/pages/PersonalVault';
import SettingsPage from '@/pages/Settings';
import AuditLogs from '@/pages/AuditLogs';
import DutyDays from '@/pages/DutyDays';
import InventoryPage from '@/pages/Inventory';
import VirtualECC from '@/pages/VirtualECC';
import PostaContacts from '@/pages/PostaContacts';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import ToastContainer from '@/components/ui/ToastContainer';
import CommandPalette from '@/components/shared/CommandPalette';
import { MobileMenuContext, useMobileMenu } from '@/context/mobileMenuContext';


// 1. Protected Route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { checkAuth } = useAuthStore();
  const token = localStorage.getItem('sidesi_access_token');

  useEffect(() => {
    if (token) checkAuth();
  }, [token]);

  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// 2. Permission Route wrapper
const PermissionRoute: React.FC<{ children: React.ReactNode; permission: string }> = ({ children, permission }) => {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  if (!hasPermission(permission)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

// 3. Main Layout Shell
const LayoutShell: React.FC = () => {
  const location = useLocation();
  const mobileMenu = useMobileMenu();
  const showPalette = location.pathname !== '/login';

  return (
    <MobileMenuContext.Provider value={mobileMenu}>
      <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-sidesi-950 text-slate-800 dark:text-slate-200">
        <Sidebar />
        <div className="flex flex-col flex-grow min-w-0 overflow-hidden">
          <Topbar />
          {/* pb-16 = space for the mobile bottom tab bar */}
          <main className="flex-grow overflow-y-auto p-3 md:p-6 pb-20 md:pb-6">
            <Routes>
              <Route path="/"           element={<Dashboard />} />
              <Route path="/vault"      element={<PermissionRoute permission="vault:view"><PasswordVault /></PermissionRoute>} />
              <Route path="/personal"   element={<PersonalVault />} />
              <Route path="/audit"      element={<PermissionRoute permission="audit:view"><AuditLogs /></PermissionRoute>} />
              <Route path="/duty-days"  element={<DutyDays />} />
              <Route path="/inventory"  element={<PermissionRoute permission="inventory:view"><InventoryPage /></PermissionRoute>} />
              <Route path="/virtual-ecc" element={<PermissionRoute permission="virtual_ecc:view"><VirtualECC /></PermissionRoute>} />
              <Route path="/posta-contacts" element={<PostaContacts />} />
              <Route path="/settings"   element={<SettingsPage />} />
              <Route path="/users"      element={<Navigate to="/settings" replace />} />
              <Route path="*"           element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
        <ToastContainer />
        {showPalette && <CommandPalette />}
      </div>
    </MobileMenuContext.Provider>
  );
};

export const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <LayoutShell />
          </ProtectedRoute>
        }
      />
    </Routes>
  </BrowserRouter>
);

export default App;
