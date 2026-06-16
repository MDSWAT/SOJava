import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Lock, LayoutDashboard, Key, Shield, Users, 
  Terminal, Settings, ChevronLeft, ChevronRight, LogOut, CalendarDays 
} from 'lucide-react';
import { useAuthStore } from '@/context/authStore';

export const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, logout, hasPermission } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    {
      path: '/',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      allowed: true
    },
    {
      path: '/vault',
      label: 'Password Vault',
      icon: <Key className="w-5 h-5" />,
      allowed: hasPermission('vault:view')
    },
    {
      path: '/personal',
      label: 'Personal Vault',
      icon: <Shield className="w-5 h-5" />,
      allowed: true
    },
    {
      path: '/duty-days',
      label: 'Zile de Serviciu',
      icon: <CalendarDays className="w-5 h-5" />,
      allowed: true
    },
    {
      path: '/users',
      label: 'Utilizatori și Roluri',
      icon: <Users className="w-5 h-5" />,
      allowed: hasPermission('users:manage')
    },
    {
      path: '/audit',
      label: 'Loguri de Audit',
      icon: <Terminal className="w-5 h-5" />,
      allowed: hasPermission('audit:view')
    },
    {
      path: '/settings',
      label: 'Setări Sistem',
      icon: <Settings className="w-5 h-5" />,
      allowed: true
    }
  ];

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 80 : 256 }}
      transition={{ type: 'spring', damping: 25, stiffness: 220 }}
      className="h-screen bg-slate-900 border-r border-slate-800 flex flex-col justify-between relative z-20 flex-shrink-0 select-none"
    >
      {/* Top Brand section */}
      <div>
        <div className="p-4 flex items-center justify-between border-b border-slate-800/80 h-16">
          <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sidesi-600 to-cyan-400 flex items-center justify-center flex-shrink-0 shadow-lg shadow-sidesi-500/20">
              <Lock className="w-4 h-4 text-white" />
            </div>
            {!isCollapsed && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-bold text-white text-md tracking-tight font-sans"
              >
                SIDESI <span className="text-cyan-400 font-semibold text-xs">PORTAL</span>
              </motion.span>
            )}
          </div>
        </div>

        {/* Navigation list */}
        <nav className="p-3 space-y-1.5 mt-4">
          {menuItems.filter(item => item.allowed).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 relative group ${
                  isActive
                    ? 'bg-sidesi-500 text-white font-medium shadow-md shadow-sidesi-500/10'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`
              }
            >
              <div className="flex-shrink-0">{item.icon}</div>
              {!isCollapsed && (
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm font-sans"
                >
                  {item.label}
                </motion.span>
              )}
              {isCollapsed && (
                <div className="absolute left-16 bg-slate-950 border border-slate-850 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 group-hover:translate-x-1.5 transition-all duration-200 pointer-events-none shadow-xl">
                  {item.label}
                </div>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer Profile Details & Logout */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        {!isCollapsed && user ? (
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 mb-3 border border-slate-850">
            <div className="overflow-hidden min-w-0 pr-2">
              <p className="text-xs font-bold text-slate-100 truncate capitalize">{user.username}</p>
              <p className="text-[10px] font-semibold text-sidesi-400 truncate">{user.role_detail?.name}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors flex-shrink-0"
              title="Deconectare"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center p-3 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors mb-2"
            title="Deconectare"
          >
            <LogOut className="w-5 h-5" />
          </button>
        )}

        {/* Collapser handle arrow */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center text-slate-500 hover:text-slate-300 py-1 border border-slate-800 hover:bg-slate-800/30 rounded-lg transition-colors text-xs"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </motion.aside>
  );
};
export default Sidebar;
