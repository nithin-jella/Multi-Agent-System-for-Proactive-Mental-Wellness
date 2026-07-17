import React, { createContext, useContext, useCallback, useState, useRef, useEffect, ReactNode } from 'react';

export type ToastVariant = 'info' | 'success' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number; // ms
}

interface ToastContextValue {
  push: (message: string, options?: { variant?: ToastVariant; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<string, number>>({});

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timers = timersRef.current;
    if (timers[id]) {
      window.clearTimeout(timers[id]);
      delete timers[id];
    }
  }, []);

  const push = useCallback((message: string, options?: { variant?: ToastVariant; duration?: number }) => {
    const id = Math.random().toString(36).slice(2);
    const variant: ToastVariant = options?.variant || 'info';
    const duration = options?.duration ?? 3000;
    const item: ToastItem = { id, message, variant, duration };
    setToasts(prev => [...prev, item]);
    timersRef.current[id] = window.setTimeout(() => remove(id), duration);
  }, [remove]);

  useEffect(() => () => { // cleanup on unmount
    Object.values(timersRef.current).forEach(t => window.clearTimeout(t));
    timersRef.current = {};
  }, []);

  const value: ToastContextValue = { push };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 z-90 flex flex-col items-center gap-2 w-full max-w-sm px-2">
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className={
              'relative w-full overflow-hidden rounded-md border px-4 py-2 text-sm shadow-lg backdrop-blur transition-all ' +
              (t.variant === 'success' ? 'bg-emerald-600/90 border-emerald-400 text-white' : '') +
              (t.variant === 'error' ? 'bg-red-600/90 border-red-400 text-white' : '') +
              (t.variant === 'info' ? 'bg-slate-800/95 border-white/15 text-white' : '')
            }
          >
            <div className="pr-6">{t.message}</div>
            <button
              onClick={() => remove(t.id)}
              className="absolute top-1 right-1 text-white/70 hover:text-white text-xs"
              aria-label="Tutup notifikasi"
            >×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
