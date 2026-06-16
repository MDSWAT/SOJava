import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertOctagon, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmă',
  cancelLabel = 'Anulează',
  type = 'warning',
  onConfirm,
  onCancel,
}) => {
  const getColors = () => {
    switch (type) {
      case 'danger':
        return {
          btn: 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/10 hover:shadow-rose-500/20 text-white',
          icon: 'text-rose-500 bg-rose-500/10'
        };
      case 'info':
        return {
          btn: 'bg-sidesi-500 hover:bg-sidesi-600 shadow-sidesi-500/10 hover:shadow-sidesi-500/20 text-white',
          icon: 'text-sidesi-500 bg-sidesi-500/10'
        };
      case 'warning':
      default:
        return {
          btn: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/10 hover:shadow-amber-500/20 text-white',
          icon: 'text-amber-500 bg-amber-500/10'
        };
    }
  };

  const colors = getColors();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />

          {/* Modal box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-md glass-panel p-6 rounded-2xl overflow-hidden pointer-events-auto z-10"
          >
            {/* Close cross */}
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-105/50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex gap-4">
              <div className={`p-3 rounded-xl flex-shrink-0 self-start ${colors.icon}`}>
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {message}
                </p>
              </div>
            </div>

            {/* Buttons footer */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-250/50 dark:border-slate-800/40">
              <button
                type="button"
                onClick={onCancel}
                className="glass-button-secondary py-2 text-sm"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`py-2 px-5 font-semibold rounded-lg text-sm active:scale-95 transition-all duration-150 flex items-center justify-center shadow-lg ${colors.btn}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
export default ConfirmDialog;
