import React, { useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, LayoutDashboard, Key, Shield,
  Terminal, Settings, ChevronLeft, ChevronRight,
  LogOut, CalendarDays, Package, X, Menu, Cpu, MapPin,
} from 'lucide-react';
import { useAuthStore } from '@/context/authStore';
import { useMobileMenuContext } from '@/context/mobileMenuContext';

export const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const { user, logout, hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOpen, close, toggle } = useMobileMenuContext();

  // Close drawer on route change
  useEffect(() => { close(); }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/',          label: 'Dashboard',            icon: <LayoutDashboard className="w-5 h-5" />, allowed: true },
    { path: '/vault',     label: 'Password Vault',        icon: <Key className="w-5 h-5" />,            allowed: hasPermission('vault:view') },
    { path: '/personal',  label: 'Personal Vault',        icon: <Shield className="w-5 h-5" />,         allowed: true },
    { path: '/duty-days', label: 'Zile de Serviciu',      icon: <CalendarDays className="w-5 h-5" />,   allowed: true },
    { path: '/inventory', label: 'Inventar',              icon: <Package className="w-5 h-5" />,        allowed: hasPermission('inventory:view') },
    { path: '/virtual-ecc', label: 'Aparate Virtuale',    icon: <Cpu className="w-5 h-5" />,            allowed: hasPermission('virtual_ecc:view') },
    { path: '/posta-contacts', label: 'Contacte Poșta',   icon: <MapPin className="w-5 h-5" />,         allowed: true },
    { path: '/audit',     label: 'Loguri de Audit',       icon: <Terminal className="w-5 h-5" />,       allowed: hasPermission('audit:view') },
    { path: '/settings',  label: 'Setări Sistem',         icon: <Settings className="w-5 h-5" />,       allowed: hasPermission('users:manage') || hasPermission('roles:manage') || user?.role_detail?.name === 'Super Admin' },
  ];

  const allowedItems = menuItems.filter(i => i.allowed);

  // ── Shared NavLink list ─────────────────────────────────────────────────────
  const NavItems = ({ collapsed = false, onClickItem }: { collapsed?: boolean; onClickItem?: () => void }) => (
    <nav className="p-3 space-y-1 mt-2">
      {allowedItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          onClick={onClickItem}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 relative group ${
              isActive
                ? 'bg-sidesi-500 text-white font-medium shadow-md shadow-sidesi-500/10'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`
          }
        >
          <div className="flex-shrink-0">{item.icon}</div>
          {!collapsed && <span className="text-sm">{item.label}</span>}
          {collapsed && (
            <div className="absolute left-16 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200 pointer-events-none shadow-xl z-50">
              {item.label}
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  );

  // ── Desktop Sidebar ─────────────────────────────────────────────────────────
  const DesktopSidebar = (
    <motion.aside
      animate={{ width: isCollapsed ? 80 : 256 }}
      transition={{ type: 'spring', damping: 25, stiffness: 220 }}
      className="hidden md:flex h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col justify-between relative z-20 flex-shrink-0 select-none"
    >
      <div className="overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 h-16">
          <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sidesi-600 to-cyan-400 flex items-center justify-center flex-shrink-0 shadow-lg shadow-sidesi-500/20">
              <Lock className="w-4 h-4 text-white" />
            </div>
            {!isCollapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-bold text-slate-900 dark:text-white text-md tracking-tight">
                SIDESI <span className="text-cyan-400 font-semibold text-xs">PORTAL</span>
              </motion.span>
            )}
          </div>
        </div>
        <NavItems collapsed={isCollapsed} />
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/40">
        {!isCollapsed && user ? (
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-slate-950/50 mb-3 border border-slate-200 dark:border-slate-800">
            <div className="overflow-hidden min-w-0 pr-2">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate capitalize">{user.username}</p>
              <p className="text-[10px] font-semibold text-sidesi-400 truncate">{user.role_detail?.name}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors flex-shrink-0" title="Deconectare">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button onClick={handleLogout} className="w-full flex items-center justify-center p-3 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors mb-2" title="Deconectare">
            <LogOut className="w-5 h-5" />
          </button>
        )}

        {/* Subtle author credit */}
        {!isCollapsed && (
          <p className="text-center text-[9px] mb-2 select-none tracking-wide text-amber-500/60 dark:text-amber-500/40">
            ✦ creat de <span className="font-bold text-amber-400 dark:text-amber-500">Serghei Stefan</span>
          </p>
        )}

        <button
          onClick={() => setIsCollapsed(c => !c)}
          className="w-full flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 py-1 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/30 rounded-lg transition-colors text-xs"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

    </motion.aside>
  );

  // ── Mobile Slide-in Drawer ──────────────────────────────────────────────────
  const MobileDrawer = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-slate-900/70 dark:bg-slate-950/70 backdrop-blur-sm md:hidden"
            onClick={close}
          />
          <motion.div
            key="drawer"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed top-0 left-0 bottom-0 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-50 flex flex-col md:hidden shadow-2xl"
          >
            {/* Drawer header */}
            <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 h-16 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sidesi-600 to-cyan-400 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-slate-900 dark:text-white text-md">SIDESI <span className="text-cyan-400 font-semibold text-xs">PORTAL</span></span>
              </div>
              <button onClick={close} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto">
              <NavItems onClickItem={close} />
            </div>

            {user && (
              <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/40 flex-shrink-0">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                  <div className="overflow-hidden min-w-0 pr-2">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate capitalize">{user.username}</p>
                    <p className="text-[10px] font-semibold text-sidesi-400 truncate">{user.role_detail?.name}</p>
                  </div>
                  <button onClick={handleLogout} className="text-slate-400 hover:text-rose-400 p-2 rounded-lg hover:bg-rose-500/10 transition-colors flex-shrink-0">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // ── Mobile Bottom Tab Bar ───────────────────────────────────────────────────
  const bottomItems = allowedItems.slice(0, 4);
  const BottomTabBar = (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800/80" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-stretch h-16">
        {bottomItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 flex-1 text-[10px] font-semibold transition-all duration-150 ${
                isActive ? 'text-sidesi-400' : 'text-slate-500 dark:text-slate-500 active:text-slate-700 dark:active:text-slate-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`p-1.5 rounded-xl transition-all duration-150 ${isActive ? 'bg-sidesi-500/15 scale-110' : ''}`}>
                  {item.icon}
                </div>
                <span className="leading-none truncate max-w-[56px] text-center">{item.label.split(' ')[0]}</span>
              </>
            )}
          </NavLink>
        ))}
        {/* More button — opens the drawer */}
        <button
          onClick={toggle}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 text-[10px] font-semibold text-slate-500 dark:text-slate-500 active:text-slate-700 dark:active:text-slate-300"
        >
          <div className="p-1.5 rounded-xl">
            <Menu className="w-5 h-5" />
          </div>
          <span className="leading-none">Meniu</span>
        </button>
      </div>
    </nav>
  );

  return (
    <>
      {DesktopSidebar}
      {MobileDrawer}
      {BottomTabBar}
    </>
  );
};

export default Sidebar;
