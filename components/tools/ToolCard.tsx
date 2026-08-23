'use client';

import React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export interface ToolCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  chips: string[];
  cta: string;
  /** Public tool route — cards are crawlable links, not state buttons. */
  href: string;
}

/**
 * Premium tool card — mobile tools box entry.
 * 44px+ touch target, 150ms press feedback, no layout shift.
 */
export const ToolCard: React.FC<ToolCardProps> = ({
  title,
  description,
  icon: Icon,
  gradient,
  chips,
  cta,
  href,
}) => (
  <Link
    href={href}
    prefetch={false}
    aria-label={`${title} — ${description}`}
    className="group relative w-full min-h-[168px] min-[375px]:min-h-[148px] h-full rounded-2xl bg-gradient-to-br p-[1.5px] text-left transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/15 active:scale-[0.98] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-soft"
    style={{ backgroundImage: gradient }}
  >
    <span className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl transition-opacity duration-300 opacity-0 group-hover:opacity-60 group-active:opacity-100" aria-hidden="true" />
    <span className="flex h-full flex-col gap-3 rounded-[calc(1rem-1.5px)] bg-bg/85 px-4 py-4 backdrop-blur-sm transition-colors duration-200 group-hover:bg-surface/90">
      <span className="flex items-center justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br p-[1.5px] transition-transform duration-200 group-hover:scale-105 group-active:scale-100" style={{ backgroundImage: gradient }}>
          <span className="flex h-full w-full items-center justify-center rounded-[calc(0.75rem-1.5px)] bg-bg/90">
            <Icon className="h-5.5 w-5.5 text-white" style={{ width: 22, height: 22 }} aria-hidden="true" />
          </span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold tracking-wide text-ink transition-colors duration-200 group-hover:bg-white group-hover:text-slate-900">
          {cta}
          <svg viewBox="0 0 24 24" className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </span>
      <span className="flex flex-col gap-1 min-w-0">
        <span className="text-[15px] font-bold text-ink leading-tight">{title}</span>
        <span className="text-xs leading-snug text-ink-muted line-clamp-2">{description}</span>
      </span>
      <span className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <span key={chip} className="rounded-full border border-elevated/60 bg-surface/60 px-2 py-0.5 text-[10px] font-semibold text-ink">
            {chip}
          </span>
        ))}
      </span>
    </span>
  </Link>
);