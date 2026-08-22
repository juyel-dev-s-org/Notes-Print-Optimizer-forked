'use client';

import React from 'react';
import { ArrowLeft, FileQuestion } from 'lucide-react';

interface EmptyPhaseStateProps {
  title: string;
  message: string;
  onBack: () => void;
  backLabel?: string;
}

/** Friendly empty state for phases reached without data (e.g. stepper jump). */
export const EmptyPhaseState: React.FC<EmptyPhaseStateProps> = ({
  title,
  message,
  onBack,
  backLabel = 'Go Back',
}) => (
  <div className="flex flex-col items-center gap-3 rounded-2xl border border-surface-2 bg-surface/60 p-8 text-center shadow-card">
    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-elevated bg-surface-2 text-ink-muted">
      <FileQuestion className="h-6 w-6" aria-hidden="true" />
    </div>
    <h3 className="text-sm font-bold text-ink">{title}</h3>
    <p className="max-w-sm text-xs leading-relaxed text-ink-muted">{message}</p>
    <button
      type="button"
      onClick={onBack}
      className="mt-1 inline-flex h-10 items-center gap-1.5 rounded-xl border border-elevated bg-surface-2 px-4 text-xs font-bold text-ink transition-colors hover:bg-elevated"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
      {backLabel}
    </button>
  </div>
);