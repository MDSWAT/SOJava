import React from 'react';

interface StrengthMeterProps {
  password?: string;
}

export const StrengthMeter: React.FC<StrengthMeterProps> = ({ password = '' }) => {
  const getStrength = (pass: string) => {
    let score = 0;
    if (!pass) return { score, label: 'Nespecificată', color: 'bg-slate-350', text: 'text-slate-400' };

    // 1. Length checks
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (pass.length >= 14) score += 1;

    // 2. Character diversity checks
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1; // Mixed case
    if (/\d/.test(pass)) score += 1; // Numbers
    if (/[^A-Za-z0-9]/.test(pass)) score += 1; // Symbols

    if (score <= 2) {
      return { score: 1, label: 'Foarte Slabă', color: 'bg-rose-500', text: 'text-rose-500' };
    } else if (score === 3 || score === 4) {
      return { score: 2, label: 'Medie', color: 'bg-amber-500', text: 'text-amber-500' };
    } else if (score === 5) {
      return { score: 3, label: 'Puternică', color: 'bg-emerald-500', text: 'text-emerald-500' };
    } else {
      return { score: 4, label: 'Excelentă', color: 'bg-cyan-500', text: 'text-cyan-500' };
    }
  };

  const strength = getStrength(password);

  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-500 dark:text-slate-400 font-medium">Complexitate Parolă:</span>
        <span className={`font-semibold ${strength.text}`}>{strength.label}</span>
      </div>
      
      {/* Visual meter bars */}
      <div className="grid grid-cols-4 gap-1.5 h-1.5">
        {[...Array(4)].map((_, idx) => (
          <div
            key={idx}
            className={`h-full rounded-full transition-all duration-300 ${
              idx < strength.score
                ? strength.color
                : 'bg-slate-200 dark:bg-slate-800'
            }`}
          />
        ))}
      </div>
      
      {password && password.length < 8 && (
        <p className="text-[10px] text-rose-500 font-medium mt-1 animate-fade-in">
          * Vă recomandăm o lungime minimă de 8 caractere.
        </p>
      )}
    </div>
  );
};
export default StrengthMeter;
