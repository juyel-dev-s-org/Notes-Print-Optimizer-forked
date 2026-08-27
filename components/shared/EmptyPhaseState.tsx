'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface EmptyPhaseStateProps {
  title: string;
  message: string;
  onBack: () => void;
  backLabel?: string;
}

/** Friendly empty state for phases reached without data (e.g. stepper jump). Premium with undraw illustration. */
export const EmptyPhaseState: React.FC<EmptyPhaseStateProps> = ({
  title,
  message,
  onBack,
  backLabel = 'Go Back',
}) => (
  <div className="flex flex-col items-center gap-4 rounded-2xl border border-surface-2 bg-surface/80 p-6 sm:p-8 text-center shadow-lg">
    {/* Undraw illustration — premium */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src="/illustrations/empty-action.svg"
      alt=""
      aria-hidden="true"
      className="h-32 sm:h-40 w-auto max-w-[260px] object-contain"
      loading="lazy"
    />
    <div className="flex flex-col items-center gap-1.5">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <p className="max-w-sm text-xs leading-relaxed text-ink-muted">{message}</p>
    </div>
    <button
      type="button"
      onClick={onBack}
      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary-strong px-4 text-xs font-bold text-white shadow-md hover:bg-primary transition-colors active:scale-[0.97]"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
      {backLabel}
    </button>
  </div>
);