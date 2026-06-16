import React, { useState, useEffect } from 'react';
import { Copy, RefreshCw, Check } from 'lucide-react';
import StrengthMeter from './StrengthMeter';
import { useToastStore } from '@/context/toastStore';

interface PasswordGeneratorProps {
  onSelectPassword?: (password: string) => void;
  showInsertButton?: boolean;
}

export const PasswordGenerator: React.FC<PasswordGeneratorProps> = ({ 
  onSelectPassword, 
  showInsertButton = false 
}) => {
  const [length, setLength] = useState(() => {
    const saved = localStorage.getItem('pwd_gen_length');
    return saved ? parseInt(saved, 10) : 16;
  });
  const [includeUpper, setIncludeUpper] = useState(() => {
    const saved = localStorage.getItem('pwd_gen_includeUpper');
    return saved !== null ? saved === 'true' : true;
  });
  const [includeLower, setIncludeLower] = useState(() => {
    const saved = localStorage.getItem('pwd_gen_includeLower');
    return saved !== null ? saved === 'true' : true;
  });
  const [includeNumbers, setIncludeNumbers] = useState(() => {
    const saved = localStorage.getItem('pwd_gen_includeNumbers');
    return saved !== null ? saved === 'true' : true;
  });
  const [includeSymbols, setIncludeSymbols] = useState(() => {
    const saved = localStorage.getItem('pwd_gen_includeSymbols');
    return saved !== null ? saved === 'true' : true;
  });
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(() => {
    const saved = localStorage.getItem('pwd_gen_excludeAmbiguous');
    return saved !== null ? saved === 'true' : false;
  });

  useEffect(() => {
    localStorage.setItem('pwd_gen_length', length.toString());
    localStorage.setItem('pwd_gen_includeUpper', includeUpper.toString());
    localStorage.setItem('pwd_gen_includeLower', includeLower.toString());
    localStorage.setItem('pwd_gen_includeNumbers', includeNumbers.toString());
    localStorage.setItem('pwd_gen_includeSymbols', includeSymbols.toString());
    localStorage.setItem('pwd_gen_excludeAmbiguous', excludeAmbiguous.toString());
  }, [length, includeUpper, includeLower, includeNumbers, includeSymbols, excludeAmbiguous]);
  
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copied, setCopied] = useState(false);
  
  const addToast = useToastStore((state) => state.addToast);

  const generate = () => {
    let charset = '';
    let compulsoryChars = '';

    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    // Base symbols and ambiguous ones
    const symbols = '!@#$%^&*';
    const ambiguous = '{}[]()/\\\'"`~,;:.<>';

    if (includeUpper) {
      charset += uppercase;
      compulsoryChars += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    }
    if (includeLower) {
      charset += lowercase;
      compulsoryChars += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    }
    if (includeNumbers) {
      charset += numbers;
      compulsoryChars += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    if (includeSymbols) {
      const activeSymbols = symbols + (excludeAmbiguous ? '' : ambiguous);
      charset += activeSymbols;
      compulsoryChars += activeSymbols.charAt(Math.floor(Math.random() * activeSymbols.length));
    }

    if (!charset) {
      setGeneratedPassword('');
      return;
    }

    let result = compulsoryChars;
    const remainingLength = Math.max(0, length - compulsoryChars.length);

    for (let i = 0; i < remainingLength; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      result += charset.charAt(randomIndex);
    }

    // Shuffle characters to avoid predictable patterns
    const shuffled = result.split('').sort(() => 0.5 - Math.random()).join('');
    setGeneratedPassword(shuffled);
    setCopied(false);
  };

  useEffect(() => {
    generate();
  }, [length, includeUpper, includeLower, includeNumbers, includeSymbols, excludeAmbiguous]);

  const copyToClipboard = () => {
    if (!generatedPassword) return;
    navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    addToast('Parola a fost copiată în clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
      {/* Generated output box */}
      <div className="flex gap-2 items-center">
        <input
          type="text"
          readOnly
          value={generatedPassword}
          className="flex-grow glass-input text-center font-mono font-bold tracking-wide select-all text-sidesi-500 text-lg py-2.5"
        />
        <button
          type="button"
          onClick={generate}
          className="glass-button-secondary p-3 active:rotate-180 transition-all duration-300"
          title="Generează din nou"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={copyToClipboard}
          className="glass-button-primary p-3"
          title="Copiază parola"
        >
          {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
        </button>
      </div>

      <StrengthMeter password={generatedPassword} />

      {/* Generator configurations */}
      <div className="space-y-3 pt-2 border-t border-slate-200/50 dark:border-slate-800/40">
        {/* Length Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span>Lungime parolă:</span>
            <span className="text-sidesi-500 font-mono">{length} caractere</span>
          </div>
          <input
            type="range"
            min="8"
            max="32"
            value={length}
            onChange={(e) => setLength(parseInt(e.target.value))}
            className="w-full accent-sidesi-500 cursor-pointer h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none"
          />
        </div>

        {/* Checkbox settings */}
        <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-700 dark:text-slate-350">
          <label className="flex items-center gap-2 cursor-pointer hover:text-sidesi-500">
            <input
              type="checkbox"
              checked={includeUpper}
              onChange={(e) => setIncludeUpper(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 accent-sidesi-500 text-white w-4 h-4"
            />
            Litere Mari (A-Z)
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer hover:text-sidesi-500">
            <input
              type="checkbox"
              checked={includeLower}
              onChange={(e) => setIncludeLower(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 accent-sidesi-500 text-white w-4 h-4"
            />
            Litere Mici (a-z)
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer hover:text-sidesi-500">
            <input
              type="checkbox"
              checked={includeNumbers}
              onChange={(e) => setIncludeNumbers(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 accent-sidesi-500 text-white w-4 h-4"
            />
            Cifre (0-9)
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer hover:text-sidesi-500">
            <input
              type="checkbox"
              checked={includeSymbols}
              onChange={(e) => setIncludeSymbols(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 accent-sidesi-500 text-white w-4 h-4"
            />
            Simboluri (!@#$...)
          </label>
        </div>

        <div className="text-xs pt-1">
          <label className="flex items-center gap-2 cursor-pointer hover:text-sidesi-500 text-slate-500 dark:text-slate-400">
            <input
              type="checkbox"
              checked={excludeAmbiguous}
              onChange={(e) => setExcludeAmbiguous(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 accent-sidesi-500 text-white w-4 h-4"
            />
            Exclude caractere ambigue (ex. {"[], {}"})
          </label>
        </div>
      </div>

      {showInsertButton && onSelectPassword && (
        <button
          type="button"
          onClick={() => onSelectPassword(generatedPassword)}
          className="w-full glass-button-primary py-2.5 mt-2"
        >
          Aplică Parola în Formular
        </button>
      )}
    </div>
  );
};
export default PasswordGenerator;
