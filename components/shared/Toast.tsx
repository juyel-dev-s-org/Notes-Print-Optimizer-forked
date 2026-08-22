'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

type ToastKind = 'success' | 'info' | 'error';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const KIND_STYLES: Record<ToastKind, { icon: React.ReactNode; iconClass: string }> = {
  success: {
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
    iconClass: 'text-success',
  },
  info: {
    icon: <Info className="h-4 w-4" aria-hidden="true" />,
    iconClass: 'text-primary-soft',
  },
  error: {
    icon: <TriangleAlert className="h-4 w-4" aria-hidden="true" />,
    iconClass: 'text-danger',
  },
};

const DURATION_MS = 2600;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const nextId = useRef(1);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-2), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="pointer-events-none fixed bottom-4 left-1/2 z-[70] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0 sm:items-end sm:px-0"
            role="region"
            aria-live="polite"
            aria-label="Notifications"
          >
            {toasts.map((t) => {
              const s = KIND_STYLES[t.kind];
              return (
                <div
                  key={t.id}
                  className="pointer-events-auto flex w-full items-start gap-2.5 rounded-xl border border-elevated bg-surface/95 p-3 text-xs text-ink shadow-pop backdrop-blur-md animate-toast-in"
                >
                  <span className={`mt-0.5 shrink-0 ${s.iconClass}`}>{s.icon}</span>
                  <p className="min-w-0 flex-1 leading-relaxed">{t.message}</p>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    aria-label="Dismiss notification"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};