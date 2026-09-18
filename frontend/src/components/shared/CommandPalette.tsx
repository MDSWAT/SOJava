import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Terminal, Key, Shield, User, Settings, Clock, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/context/authStore';
import { useVaultStore } from '@/context/vaultStore';

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const { items: vaultItems, fetchItems } = useVaultStore();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Hook Keyboard trigger Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      
      // Close on Escape
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync password lists on opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
      if (hasPermission('vault:view')) {
        fetchItems();
      }
    }
  }, [isOpen]);

  // Static Navigation targets
  const getNavCommands = () => {
    const cmds = [
      { id: 'nav-dash', label: 'Mergi la Dashboard', category: 'Navigare', icon: <Clock className="w-4 h-4" />, action: () => navigate('/') },
      { id: 'nav-vault', label: 'Mergi la Password Vault (Partajat)', category: 'Navigare', icon: <Key className="w-4 h-4" />, action: () => navigate('/vault') },
      { id: 'nav-personal', label: 'Mergi la Personal Vault', category: 'Navigare', icon: <Shield className="w-4 h-4" />, action: () => navigate('/personal') }
    ];

    if (hasPermission('users:manage')) {
      cmds.push({ id: 'nav-users', label: 'Utilizatori și Roluri', category: 'Administrare', icon: <User className="w-4 h-4" />, action: () => navigate('/users') });
    }
    if (hasPermission('audit:view')) {
      cmds.push({ id: 'nav-audit', label: 'Vizualizează Loguri de Audit', category: 'Administrare', icon: <Terminal className="w-4 h-4" />, action: () => navigate('/audit') });
    }
    cmds.push({ id: 'nav-settings', label: 'Setări Platformă', category: 'Sistem', icon: <Settings className="w-4 h-4" />, action: () => navigate('/settings') });
    
    return cmds;
  };

  const navCommands = getNavCommands();

  // Filter commands and dynamic search passwords
  const filteredCommands = [
    ...navCommands.filter(c => c.label.toLowerCase().includes(query.toLowerCase())),
    ...vaultItems
      .filter(item => 
        item.title.toLowerCase().includes(query.toLowerCase()) || 
        item.organization_detail?.name?.toLowerCase().includes(query.toLowerCase()) ||
        item.login_username.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 4) // cap list
      .map(item => ({
        id: `pw-${item.id}`,
        label: `${item.organization_detail.name} — ${item.title} (${item.login_username})`,
        category: 'Parole Partajate',
        icon: <Key className="w-4 h-4 text-sidesi-400" />,
        action: () => navigate(`/vault?id=${item.id}`)
      }))
  ];

  // 2. Hook inner navigation keys (arrows and enter)
  useEffect(() => {
    if (!isOpen || filteredCommands.length === 0) return;

    const handleInnerKeys = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        filteredCommands[selectedIndex]?.action();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleInnerKeys);
    return () => window.removeEventListener('keydown', handleInnerKeys);
  }, [isOpen, filteredCommands, selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 pointer-events-auto">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-slate-900/70 dark:bg-slate-950/70 backdrop-blur-sm"
          />

          {/* Search container */}
          <motion.div
            initial={{ opacity: 0, y: -15, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-xl glass-panel bg-white/90 dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[50vh]"
          >
            {/* Search Input bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
              <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Caută acțiuni, navigări sau servere... (ex: 218 CCL)"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                className="bg-transparent border-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-0 w-full text-sm font-sans"
              />
              <kbd className="hidden sm:inline-flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-1.5 py-0.5 rounded select-none">
                ESC
              </kbd>
            </div>

            {/* Results listing */}
            <div className="flex-grow overflow-y-auto p-2 space-y-2">
              {filteredCommands.length > 0 ? (
                // Grouping results visually
                Object.entries(
                  filteredCommands.reduce((acc, curr) => {
                    if (!acc[curr.category]) acc[curr.category] = [];
                    acc[curr.category].push(curr);
                    return acc;
                  }, {} as Record<string, typeof filteredCommands>)
                ).map(([category, items]) => (
                  <div key={category} className="space-y-1">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 py-1.5">
                      {category}
                    </h4>
                    {items.map((cmd) => {
                      // Calculate global index
                      const globalIdx = filteredCommands.findIndex(x => x.id === cmd.id);
                      const isSelected = globalIdx === selectedIndex;
                      
                      return (
                        <div
                          key={cmd.id}
                          onClick={() => {
                            cmd.action();
                            setIsOpen(false);
                          }}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                            isSelected
                              ? 'bg-sidesi-500/20 border-l-4 border-l-sidesi-500 text-slate-900 dark:text-white'
                              : 'text-slate-600 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800/40 border-l-4 border-l-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={isSelected ? 'text-sidesi-400' : 'text-slate-400'}>
                              {cmd.icon}
                            </span>
                            <span className="text-sm font-medium">{cmd.label}</span>
                          </div>
                          {isSelected && (
                            <ArrowRight className="w-4 h-4 text-sidesi-400 animate-pulse-subtle" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 space-y-2">
                  <Terminal className="w-8 h-8 mx-auto stroke-1" />
                  <p className="text-sm">Nu s-a găsit niciun rezultat.</p>
                </div>
              )}
            </div>

            {/* Guide footer */}
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800/60 flex justify-between items-center text-[10px] text-slate-500 select-none">
              <span className="flex items-center gap-1">
                Navighează cu <kbd className="bg-slate-100 dark:bg-slate-800 px-1 rounded">↑</kbd> <kbd className="bg-slate-100 dark:bg-slate-800 px-1 rounded">↓</kbd>
              </span>
              <span>
                Apăsați <kbd className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Enter</kbd> pentru a selecta
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
export default CommandPalette;
