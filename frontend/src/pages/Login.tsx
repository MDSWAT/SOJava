import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Lock, KeyRound } from 'lucide-react';
import { useAuthStore } from '@/context/authStore';
import { useToastStore } from '@/context/toastStore';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const { login, isLoading, error } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      addToast('Vă rugăm să completați toate câmpurile.', 'warning');
      return;
    }

    const success = await login(username, password);
    if (success) {
      addToast('Autentificare reușită! Bine ați venit.', 'success');
      navigate('/');
    } else {
      addToast('Autentificarea a eșuat. Verificați credențialele.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 bg-grid-pattern flex flex-col justify-center items-center p-4 select-none relative overflow-hidden">
      {/* Decorative premium radial glows */}
      <div className="absolute top-[20%] left-[15%] w-72 h-72 bg-sidesi-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-[20%] right-[15%] w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />

      {/* Main card */}
      <div className="w-full max-w-md glass-panel p-8 rounded-2xl shadow-2xl relative z-10 space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-sidesi-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-sidesi-500/25">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-sans mt-3">
            Corporatia SIDESI
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sistem Centralizat de Securitate și Gestiune a Credențialelor
          </p>
        </div>

        {/* DRF error warnings */}
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 text-xs font-semibold rounded-xl flex items-start gap-2.5 animate-fade-in">
            <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Nume Utilizator (Username)</label>
            <input
              type="text"
              placeholder="ex: stefan sau ad_user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full glass-input"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Parolă (Password)</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full glass-input"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full glass-button-primary py-2.5 font-bold flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Autentificare Securizată</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
export default Login;
