'use client';

import React from 'react';
import { ShieldCheck, Zap, LayoutGrid, Printer, ArrowDown } from 'lucide-react';

const heroStats = [
  { icon: ShieldCheck, label: '100% Private', sub: 'On-device processing' },
  { icon: Zap, label: '80% Ink Saved', sub: 'Auto-whitening' },
  { icon: LayoutGrid, label: 'Smart N-Up', sub: '1-up to 10-up grids' },
  { icon: Printer, label: 'Print Ready', sub: 'Paper-saving output' },
];

/**
 * Aurora Dark hero — brand gradient (#243BFF → #5B35FF → #A12CFF) over a deep
 * slate base, glass stat chips, ambient glows. Touch-optimized (no hover
 * dependency), reduced-motion safe (static glows).
 */
export const LandingHero: React.FC = () => (
  <section
    aria-label="Notes Print Optimizer — convert lecture slides to print-ready PDFs"
    className="relative overflow-hidden rounded-2xl border border-slate-800/70 bg-gradient-to-b from-[#0b1230]/50 via-slate-900/60 to-slate-900/40 px-5 py-8 text-center animate-slide-up"
  >
    {/* Ambient glows — 2 layers for performance (reduced composite) */}
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#243BFF]/20 blur-3xl"
    />
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-32 -right-16 h-72 w-72 rounded-full bg-[#A12CFF]/12 blur-3xl"
    />

    <div className="relative flex flex-col items-center gap-4">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#5B35FF]/40 bg-[#5B35FF]/10 px-3 py-1 text-[11px] font-bold tracking-wide text-[#a78bfa]">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
        Mobile-First · Works Offline · No Account
      </span>

      <h1 className="max-w-3xl text-balance text-2xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
        Turn dark lecture slides into{' '}
        <span className="bg-gradient-to-r from-[#5B8CFF] via-[#8B6BFF] to-[#C14DFF] bg-clip-text text-transparent">
          crisp print-ready PDFs
        </span>
      </h1>

      <p className="max-w-xl text-pretty text-xs leading-relaxed text-slate-400 sm:text-sm">
        Auto-whitening, banner removal and smart N-up layouts — all processed
        locally on your device. Nothing is ever uploaded to a server.
      </p>

      {/* Primary CTA — prominent, high-contrast, directly above upload */}
      <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-xs font-bold tracking-wide text-white shadow-lg shadow-indigo-600/25 ring-1 ring-indigo-500/30">
        <ArrowDown className="h-3.5 w-3.5 shrink-0 animate-bounce" aria-hidden="true" />
        Drop your class notes below to begin
      </div>

      {/* Feature hints — compact, low-dominance; hidden on mobile to keep upload above the fold */}
      <div className="hidden w-full max-w-2xl grid-cols-4 gap-2 sm:grid">
        {heroStats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center gap-1 rounded-xl border border-slate-800/50 bg-slate-900/30 px-2 py-2.5 backdrop-blur-sm"
          >
            <stat.icon className="h-3.5 w-3.5 text-[#8B6BFF]" />
            <span className="text-[10px] font-semibold tracking-wide text-slate-300">{stat.label}</span>
            <span className="hidden text-[9px] leading-none text-slate-500 sm:block">{stat.sub}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);