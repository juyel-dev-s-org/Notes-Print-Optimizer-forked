'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Shared accessible modal shell used by the Settings & Information Center.
 * Supports Escape to close, backdrop click, focus on open and body scroll lock.
 */
export const Modal: React.FC<ModalProps> = ({ title, subtitle, onClose, children }) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative flex max-h-[85vh] w-full flex-col rounded-t-2xl border border-slate-700 bg-slate-900 shadow-2xl sm:max-w-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-white">{title}</h2>
            {subtitle && <p className="truncate text-[11px] text-slate-400">{subtitle}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300 transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </motion.div>
    </div>
  );
};
