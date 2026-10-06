import { useEffect } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  isLoading = false,
  onConfirm,
  onClose,
}: Readonly<ConfirmModalProps>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) {
    return null;
  }

  let iconNode = <AlertTriangle className="w-5 h-5 text-amber-400" />;
  let confirmBtnClass = 'bg-indigo-600 hover:bg-indigo-500 text-white';

  if (variant === 'danger') {
    iconNode = <Trash2 className="w-5 h-5 text-rose-400" />;
    confirmBtnClass = 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20';
  }

  if (variant === 'warning') {
    iconNode = <AlertTriangle className="w-5 h-5 text-amber-400" />;
    confirmBtnClass = 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md p-6 rounded-2xl border border-slate-800 bg-[#0E1017] shadow-2xl space-y-4 font-sans"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
            {iconNode}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-semibold text-white tracking-tight">{title}</h3>
          <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
        </div>

        <div className="pt-2 flex items-center justify-end gap-3 font-mono text-xs">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg border border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-300 transition-colors disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 inline-flex items-center justify-center gap-1.5',
              confirmBtnClass,
            )}
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
