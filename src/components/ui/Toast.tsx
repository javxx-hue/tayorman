import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

type ToastListener = (toast: ToastMessage) => void;
const listeners: Set<ToastListener> = new Set();

export const toast = {
  success: (message: string) => emitToast('success', message),
  error: (message: string) => emitToast('error', message),
  info: (message: string) => emitToast('info', message),
};

function emitToast(type: ToastType, message: string) {
  const newToast: ToastMessage = {
    id: Math.random().toString(36).substring(2, 9),
    type,
    message,
  };
  listeners.forEach((listener) => listener(newToast));
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleNewToast = (toastItem: ToastMessage) => {
      setToasts((prev) => [...prev, toastItem]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toastItem.id));
      }, 3500);
    };

    listeners.add(handleNewToast);
    return () => {
      listeners.delete(handleNewToast);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((item) => (
        <div
          key={item.id}
          className="pointer-events-auto flex items-center justify-between gap-3 p-4 rounded-2xl bg-card text-card-foreground border border-border shadow-elevated animate-in slide-in-from-bottom-5 duration-200"
        >
          <div className="flex items-center gap-2.5">
            {item.type === 'success' && (
              <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            {item.type === 'error' && (
              <AlertCircle size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            {item.type === 'info' && (
              <Info size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
            )}
            <p className="text-xs sm:text-sm font-medium">{item.message}</p>
          </div>
          <button
            onClick={() => removeToast(item.id)}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
