'use client';

import React from 'react';
import { ShieldCheck, Zap, LayoutGrid, Printer, ArrowDown } from 'lucide-react';

const heroStats = [
  { icon: ShieldCheck, label: '100% Private', sub: 'On-device' },
  { icon: Zap, label: '80% Ink Saved', sub: 'Whitening' },
  { icon: LayoutGrid, label: 'Smart N-Up', sub: '1→10 per sheet' },
  { icon: Printer, label: 'Print-Ready', sub: 'Merge & layout' },
];

/**
 * Best-practice hero — Print Optimizer is now multi-tool (merge / whiten / enhance).
 * Aurora Dark gradient (#243BFF → #5B35FF → #A12CFF) stays as brand, but copy is
 * generic. No dark-slides-only messaging. CTA points to ToolsBox (not Upload).
 */
export const LandingHero: React.FC = () => (
  <section
    aria-label="Print Optimizer — every PDF, print-perfect"
    className="relative overflow-hidden rounded-2xl border border-surface-2/70 bg-gradient-to-b from-primary-faint/70 via-surface/60 to-surface/40 px-5 py-7 sm:py-9 text-center animate-slide-up"
  >
    <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#243BFF]/20 blur-3xl" />
    <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-16 h-72 w-72 rounded-full bg-[#A12CFF]/12 blur-3xl" />

    <div className="relative flex flex-col items-center gap-3.5">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-bold tracking-wide text-accent-soft">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
        </span>
        All-in-One PDF Tools • 100% Offline • No Upload
      </span>

      <h1 className="max-w-3xl text-balance text-[26px] font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
        Every PDF,{' '}
        <span className="bg-gradient-to-r from-[#5B8CFF] via-[#8B6BFF] to-[#C14DFF] bg-clip-text text-transparent">
          Print-Perfect
        </span>
      </h1>

      <p className="max-w-xl text-pretty text-xs leading-relaxed text-ink-muted sm:text-sm">
        Merge documents, whiten dark notes, enhance light scans & build smart N-up layouts — everything runs
        <span className="font-semibold text-ink"> on your device</span>. Instant, private, no uploads.
      </p>

      <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-primary-strong px-5 py-2.5 text-xs font-bold tracking-wide text-white shadow-lg shadow-primary-deep/25 ring-1 ring-primary/30">
        <ArrowDown className="h-3.5 w-3.5 shrink-0 animate-bounce" aria-hidden="true" />
        Choose a tool below to begin
      </div>

      {/* Hint chips — hidden on landing mobile to keep ToolsBox directly visible, subtle on sm+ */}
      <div className="hidden w-full max-w-2xl grid-cols-4 gap-2 sm:grid">
        {heroStats.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-1 rounded-xl border border-surface-2/50 bg-surface/30 px-2 py-2.5 backdrop-blur-sm">
            <stat.icon className="h-3.5 w-3.5 text-[#8B6BFF]" />
            <span className="text-[10px] font-semibold tracking-wide text-ink">{stat.label}</span>
            <span className="hidden text-[9px] leading-none text-ink-faint sm:block">{stat.sub}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);