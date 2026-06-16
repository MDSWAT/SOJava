import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/context/authStore';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import PasswordVault from '@/pages/PasswordVault';
import PersonalVault from '@/pages/PersonalVault';
import UsersPage from '@/pages/Users';
import SettingsPage from '@/pages/Settings';
import AuditLogs from '@/pages/AuditLogs';
import DutyDays from '@/pages/DutyDays';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import ToastContainer from '@/components/ui/ToastContainer';
import CommandPalette from '@/components/shared/CommandPalette';

// 1. Protected Route Security Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { checkAuth } = useAuthStore();
  const token = localStorage.getItem('sidesi_access_token');

  useEffect(() => {
    if (token) {
      checkAuth();
    }
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// 2. Permission Route Wrapper
const PermissionRoute: React.FC<{ children: React.ReactNode; permission: string }> = ({ children, permission }) => {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  if (!hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

// 3. Main Page Layout Shell Wrapper
const LayoutShell: React.FC = () => {
  const location = useLocation();

  // Hide command palette on login page
  const showPallete = location.pathname !== '/login';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-sidesi-950 text-slate-800 dark:text-slate-200">
      <Sidebar />
      <div className="flex flex-col flex-grow min-w-0">
        <Topbar />
        <main className="flex-grow overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/vault" element={<PermissionRoute permission="vault:view"><PasswordVault /></PermissionRoute>} />
            <Route path="/personal" element={<PersonalVault />} />
            <Route path="/users" element={<PermissionRoute permission="users:manage"><UsersPage /></PermissionRoute>} />
            <Route path="/audit" element={<PermissionRoute permission="audit:view"><AuditLogs /></PermissionRoute>} />
            <Route path="/duty-days" element={<DutyDays />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      
      {/* Global Security Widgets */}
      <ToastContainer />
      {showPallete && <CommandPalette />}
    </div>
  );
};

export const App: React.FC = () => {
  return (
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
};
export default App;
