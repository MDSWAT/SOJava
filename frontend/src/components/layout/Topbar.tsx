import React from 'react';
import { Sun, Moon, Search, Cpu, Database } from 'lucide-react';
import { useThemeStore } from '@/context/themeStore';
import { useAuthStore } from '@/context/authStore';
import Breadcrumbs from './Breadcrumbs';

export const Topbar: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();
  const { user } = useAuthStore();

  return (
    <header className="h-16 border-b border-slate-200/50 dark:border-slate-800/40 bg-white/40 dark:bg-sidesi-950/40 backdrop-blur-md flex items-center justify-between px-6 select-none relative z-10">
      {/* Breadcrumb locator */}
      <Breadcrumbs />

      {/* Center/Right widgets */}
      <div className="flex items-center gap-4">
        {/* Command Palette Trigger Hint */}
        <button
          onClick={() => {
            // Trigger Ctrl+K key event programmatically to toggle command palette
            const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true });
            window.dispatchEvent(event);
          }}
          className="hidden md:flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/60 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 rounded-xl py-1.5 px-3 text-xs transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Căutare rapidă...</span>
          <kbd className="bg-slate-200 dark:bg-slate-800 border border-slate-350 dark:border-slate-700 px-1.5 py-0.5 rounded text-[9px] font-bold">
            Ctrl+K
          </kbd>
        </button>

        {/* Sync status details */}
        {user && (
          <div 
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
              user.is_ad_synced 
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500' 
                : 'border-sidesi-500/20 bg-sidesi-500/10 text-sidesi-500'
            }`}
            title={user.is_ad_synced ? 'Sincronizat prin Active Directory' : 'Cont Local'}
          >
            {user.is_ad_synced ? <Cpu className="w-3.5 h-3.5" /> : <Database className="w-3.5 h-3.5" />}
            <span className="uppercase tracking-wider">{user.is_ad_synced ? 'AD Synced' : 'Local Auth'}</span>
          </div>
        )}

        {/* Theme Dark/Light switcher */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-sidesi-500 transition-colors"
          title={theme === 'dark' ? 'Schimbă în modul Luminos' : 'Schimbă în modul Întunecat'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
export default Topbar;
