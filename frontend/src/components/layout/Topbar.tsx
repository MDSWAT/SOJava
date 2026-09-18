import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sun, Moon, Search, Cpu, Database, Menu, DollarSign, X, ShoppingBag, Plus, Minus, Gamepad2, Wallet, MousePointerClick } from 'lucide-react';
import { useThemeStore } from '@/context/themeStore';
import { useAuthStore } from '@/context/authStore';
import Breadcrumbs from './Breadcrumbs';
import { useMobileMenuContext } from '@/context/mobileMenuContext';
import { ClickerGame, DodgeGame } from './GtaGames';

interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  description: string;
}

const SHOP_ITEMS: ShopItem[] = [
  { id: 'coffee', name: 'Cafea de la automat', emoji: '☕', price: 15, description: 'Te ține treaz la duty' },
  { id: 'pizza', name: 'Pizza Margherita', emoji: '🍕', price: 89, description: 'Para comandei de noapte' },
  { id: 'energy', name: 'Băutură Energizantă', emoji: '⚡', price: 35, description: '+50 XP la concentrare' },
  { id: 'burger', name: 'Burger Mega', emoji: '🍔', price: 65, description: 'Te satură 2 ore' },
  { id: 'donut', name: 'Gogoașă', emoji: '🍩', price: 12, description: 'Satisfacție instantă' },
  { id: 'taco', name: 'Taco Tuesday', emoji: '🌮', price: 25, description: 'Din 3 în 3 e gratis' },
  { id: 'bike', name: 'Bicicletă BMX', emoji: '🚲', price: 450, description: 'Mișto dar lentă' },
  { id: 'scooter', name: 'Trotinetă Electrică', emoji: '🛴', price: 1200, description: 'Fast & furious light' },
  { id: 'moto', name: 'Motocicletă Sport', emoji: '🏍️', price: 25000, description: 'Vroom vroom' },
  { id: 'sedan', name: 'Mașină Sedan', emoji: '🚗', price: 45000, description: 'Clasic și de încredere' },
  { id: 'sport_car', name: 'Mașină Sport', emoji: '🏎️', price: 180000, description: '0-100 în 3 secunde' },
  { id: 'suv', name: 'SUV de Lux', emoji: '🚙', price: 95000, description: 'Pentru familie și impresie' },
  { id: 'limo', name: 'Limuzină', emoji: '🚘', price: 320000, description: 'Ajungi cu stil peste tot' },
  { id: 'monster_truck', name: 'Monster Truck', emoji: '🛻', price: 220000, description: 'Strivește tot în cale' },
  { id: 'tank', name: 'Tanc de Luptă', emoji: '🪖', price: 4500000, description: 'Overkill pentru trafic' },
  { id: 'helicopter', name: 'Elicopter Privat', emoji: '🚁', price: 2500000, description: 'Eviți sensul giratoriu' },
  { id: 'jet', name: 'Jet Privat', emoji: '✈️', price: 15000000, description: 'Zbori direct la duty' },
  { id: 'rocket', name: 'Rachetă Spațială', emoji: '🚀', price: 999999999, description: 'Pentru când ai prea mulți bani' },
  { id: 'yacht', name: 'Iacht de Lux', emoji: '🛥️', price: 500000, description: 'Călătorești în stil mare' },
  { id: 'submarine', name: 'Submarin', emoji: '🛶', price: 3200000, description: 'Explorezi adâncurile' },
  { id: 'island', name: 'Insulă Privată', emoji: '🏝️', price: 10000000, description: 'Acolo unde nu te sună nimeni' },
  { id: 'mansion', name: 'Conac de Lux', emoji: '🏰', price: 8500000, description: '20 de camere goale' },
  { id: 'penthouse', name: 'Penthouse', emoji: '🏙️', price: 4200000, description: 'Vedere panoramică' },
  { id: 'diamond', name: 'Diamant Roz', emoji: '💎', price: 250000, description: 'Pentru persoana specială' },
  { id: 'gold_bar', name: 'Lingou de Aur', emoji: '🥇', price: 65000, description: 'Greutate garantată' },
  { id: 'crown', name: 'Coroană Regală', emoji: '👑', price: 750000, description: 'Te faci rege peste noapte' },
  { id: 'robot', name: 'Robot Care Lucrează', emoji: '🤖', price: 75000, description: 'Face duty-ul în locul tău' },
  { id: 'robot_dog', name: 'Câine Robot', emoji: '🐕', price: 32000, description: 'Nu latră, doar calculează' },
  { id: 'drone', name: 'Dronă de Recunoaștere', emoji: '🛸', price: 18000, description: 'Supraveghere din aer' },
  { id: 'ai_clone', name: 'Clonă AI a ta', emoji: '🧠', price: 999000, description: 'Răspunde la emailuri în locul tău' },
  { id: 'unicorn', name: 'Unicorn Magic', emoji: '🦄', price: 133700, description: 'Există, jur' },
  { id: 'dragon', name: 'Dragon de Companie', emoji: '🐉', price: 6000000, description: 'Scuipă foc la ședințe' },
  { id: 'trex', name: 'T-Rex Clonat', emoji: '🦖', price: 12000000, description: 'Jurassic Park la birou' },
  { id: 'panda', name: 'Panda Domesticit', emoji: '🐼', price: 450000, description: 'Doarme 20h/zi, ca tine' },
  { id: 'guitar', name: 'Chitară Electrică', emoji: '�', price: 4500, description: 'Rockstar wannabe' },
  { id: 'gaming_pc', name: 'PC Gaming RGB', emoji: '🖥️', price: 22000, description: '240 FPS garantat' },
  { id: 'vr', name: 'Cască VR', emoji: '🥽', price: 8500, description: 'Evadezi din realitate' },
  { id: 'watch', name: 'Ceas de Lux', emoji: '⌚', price: 55000, description: 'Timpul e bani' },
  { id: 'sunglasses', name: 'Ochelari de Soare', emoji: '🕶️', price: 800, description: 'Cool factor +100' },
  { id: 'trophy', name: 'Trofeu de Aur', emoji: '🏆', price: 15000, description: 'Pentru ego personal' },
];

const STORAGE_KEY = 'gta_balance';
const PURCHASES_KEY = 'gta_purchases';

const formatMoney = (n: number) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  return `${sign}$${abs.toLocaleString()}`;
};

type TabKey = 'balance' | 'shop' | 'clicker' | 'dodge';

const GtaBalance: React.FC = () => {
  const [balance, setBalance] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [purchases, setPurchases] = useState<ShopItem[]>([]);
  const [flash, setFlash] = useState(false);
  const [tab, setTab] = useState<TabKey>('balance');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    setBalance(saved !== null ? (parseInt(saved, 10) || 0) : 5000);
    const savedPurchases = localStorage.getItem(PURCHASES_KEY);
    if (savedPurchases) { try { setPurchases(JSON.parse(savedPurchases)); } catch { /* ignore */ } }
  }, []);

  const saveBalance = (val: number) => { setBalance(val); localStorage.setItem(STORAGE_KEY, String(val)); };

  const handleBuy = (item: ShopItem) => {
    if (balance < item.price) { setFlash(true); setTimeout(() => setFlash(false), 500); return; }
    saveBalance(balance - item.price);
    const newPurchases = [item, ...purchases].slice(0, 20);
    setPurchases(newPurchases);
    localStorage.setItem(PURCHASES_KEY, JSON.stringify(newPurchases));
  };

  const handleSaveEdit = () => {
    const val = parseInt(editValue.replace(/[^0-9-]/g, ''), 10);
    if (!isNaN(val)) saveBalance(val);
    setEditMode(false);
  };

  const handleEarn = (amount: number) => {
    setBalance((b) => { const nb = b + amount; localStorage.setItem(STORAGE_KEY, String(nb)); return nb; });
  };

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'balance', label: 'Balanță', icon: <Wallet className="w-3.5 h-3.5" /> },
    { key: 'shop', label: 'Shop', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { key: 'clicker', label: 'Clicker', icon: <MousePointerClick className="w-3.5 h-3.5" /> },
    { key: 'dodge', label: 'Dodge', icon: <Gamepad2 className="w-3.5 h-3.5" /> },
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center px-2 py-1.5 rounded-lg transition-transform hover:scale-105 ${flash ? 'animate-pulse' : ''}`}
        title="GTA Balance — click pentru shop"
      >
        <span
          className="tabular-nums select-none whitespace-nowrap"
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '12px',
            color: flash ? '#ef4444' : '#22c55e',
            WebkitTextStroke: '1.5px black',
            paintOrder: 'stroke fill',
            letterSpacing: '1px',
          }}
        >
          {formatMoney(balance)}
        </span>
      </button>

      {isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => { setIsOpen(false); setEditMode(false); }} />
          <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl z-10 overflow-hidden shadow-2xl border border-slate-700 max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-700/60 flex items-center justify-between bg-gradient-to-r from-emerald-600/20 to-amber-600/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center shadow-lg">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white tracking-tight">BALANȚĂ</h2>
                  <p className="text-[10px] text-slate-400 font-mono">{formatMoney(balance)}</p>
                </div>
              </div>
              <button onClick={() => { setIsOpen(false); setEditMode(false); }} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-700/60 bg-slate-900/40 flex-shrink-0">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold transition-colors border-b-2 ${
                    tab === t.key
                      ? 'text-emerald-400 border-emerald-400 bg-slate-800/40'
                      : 'text-slate-500 border-transparent hover:text-slate-300'
                  }`}
                >
                  {t.icon}
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>

            <div className="flex-grow overflow-y-auto p-5 space-y-4">
              {tab === 'balance' && (
                <>
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/60">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Balanta ta</span>
                      {!editMode && <button onClick={() => { setEditMode(true); setEditValue(String(balance)); }} className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors">Modifică</button>}
                    </div>
                    {editMode ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700 flex-1">
                          <span className="pl-3 text-amber-400 font-mono font-bold">$</span>
                          <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value.replace(/[^0-9-]/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); }} autoFocus className="bg-transparent text-white font-mono font-bold text-lg px-2 py-2 w-full focus:outline-none" placeholder="0" />
                        </div>
                        <button onClick={handleSaveEdit} className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition-colors">OK</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button onClick={() => saveBalance(balance + 1000)} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-emerald-400 transition-colors"><Plus className="w-4 h-4" /></button>
                        <span className="text-2xl font-black text-amber-400 font-mono tabular-nums flex-1 text-center">${balance.toLocaleString()}</span>
                        <button onClick={() => saveBalance(balance - 1000)} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-rose-400 transition-colors"><Minus className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>

                  {purchases.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cumpărături recente</span>
                        <button onClick={() => { setPurchases([]); localStorage.removeItem(PURCHASES_KEY); }} className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors">Curăță</button>
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {purchases.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 bg-slate-800/40 rounded-lg px-3 py-1.5 border border-slate-700/40">
                            <span className="text-lg">{p.emoji}</span>
                            <span className="text-[11px] font-semibold text-slate-300 flex-1 truncate">{p.name}</span>
                            <span className="text-[10px] font-mono text-rose-400">-${p.price.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {tab === 'shop' && (
                <div>
                  <div className="grid grid-cols-2 gap-2">
                    {SHOP_ITEMS.map((item) => {
                      const canAfford = balance >= item.price;
                      return (
                        <button key={item.id} onClick={() => handleBuy(item)} disabled={!canAfford} className={`relative p-3 rounded-xl border text-left transition-all ${canAfford ? 'bg-slate-800/60 border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800 cursor-pointer' : 'bg-slate-900/40 border-slate-800 opacity-50 cursor-not-allowed'}`}>
                          <div className="text-2xl mb-1">{item.emoji}</div>
                          <div className="text-[11px] font-bold text-white leading-tight">{item.name}</div>
                          <div className="text-[9px] text-slate-500 mt-0.5 leading-tight">{item.description}</div>
                          <div className={`text-[11px] font-mono font-bold mt-1.5 ${canAfford ? 'text-amber-400' : 'text-rose-400'}`}>${item.price.toLocaleString()}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {tab === 'clicker' && <ClickerGame onEarn={handleEarn} />}
              {tab === 'dodge' && <DodgeGame onEarn={handleEarn} />}
            </div>

            <div className="px-5 py-3 border-t border-slate-700/60 bg-slate-900/50 flex items-center justify-between">
              <span className="text-[9px] text-slate-600 font-mono">just for fun 🎮</span>
              <button onClick={() => { saveBalance(5000); setPurchases([]); localStorage.removeItem(PURCHASES_KEY); }} className="text-[10px] font-bold text-slate-500 hover:text-amber-400 transition-colors">Reset</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export const Topbar: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();
  const { user } = useAuthStore();
  const { toggle } = useMobileMenuContext();

  return (
    <header className="h-16 border-b border-slate-200/50 dark:border-slate-800/40 bg-white/40 dark:bg-sidesi-950/40 backdrop-blur-md flex items-center justify-between px-4 md:px-6 select-none relative z-10 flex-shrink-0">

      {/* Left: Hamburger (mobile only) + Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          onClick={toggle}
          className="md:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors flex-shrink-0"
          aria-label="Deschide meniu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Breadcrumbs />
      </div>

      {/* Right: widgets */}
      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        {/* Command Palette — large screens only */}
        <button
          onClick={() => {
            const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true });
            window.dispatchEvent(event);
          }}
          className="hidden lg:flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/60 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 rounded-xl py-1.5 px-3 text-xs transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Căutare...</span>
          <kbd className="bg-slate-200 dark:bg-slate-800 border dark:border-slate-700 px-1.5 py-0.5 rounded text-[9px] font-bold">⌘K</kbd>
        </button>

        {/* GTA Balance — just for fun */}
        <GtaBalance />

        {/* Auth badge — medium screens+ */}
        {user && (
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border ${
              user.is_ad_synced
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
                : 'border-sidesi-500/20 bg-sidesi-500/10 text-sidesi-500'
            }`}
          >
            {user.is_ad_synced ? <Cpu className="w-3.5 h-3.5" /> : <Database className="w-3.5 h-3.5" />}
            <span className="hidden md:inline uppercase tracking-wider">{user.is_ad_synced ? 'AD' : 'Local'}</span>
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 dark:text-slate-400 transition-colors"
          title={theme === 'dark' ? 'Mod Luminos' : 'Mod Întunecat'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
export default Topbar;
