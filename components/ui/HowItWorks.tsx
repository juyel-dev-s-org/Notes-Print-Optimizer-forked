'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';

export interface HowItWorksStep {
  title: string;
  description: string;
}

export interface HowItWorksProps {
  steps: [HowItWorksStep, HowItWorksStep, HowItWorksStep];
  privacyNote: string;
}

/**
 * Numbered "how it works" timeline used under tool upload screens.
 * Shared so every future tool documents itself the same way.
 */
export const HowItWorks: React.FC<HowItWorksProps> = ({ steps, privacyNote }) => (
  <section aria-label="How it works" className="flex flex-col gap-4 rounded-2xl border border-surface-2 bg-surface/70 p-5">
    <h3 className="text-sm font-bold tracking-wide text-ink">How it works</h3>
    <ol className="flex flex-col">
      {steps.map((step, i) => (
        <li key={step.title} className="relative flex gap-4 pb-5 last:pb-0">
          {i < steps.length - 1 && (
            <span aria-hidden="true" className="absolute left-[17px] top-9 h-[calc(100%-2.25rem)] w-px bg-elevated" />
          )}
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary-faint/50 text-xs font-bold tabular-nums text-primary-soft">
            {String(i + 1).padStart(2, '0')}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-bold text-ink">{step.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
    <div className="flex items-start gap-2 rounded-xl border border-success/25 bg-success-faint/40 px-3.5 py-3">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
      <p className="text-[11px] font-semibold uppercase tracking-wide text-success">{privacyNote}</p>
    </div>
  </section>
);
