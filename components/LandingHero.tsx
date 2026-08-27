'use client';

import React from 'react';
import { GraduationCap, ShieldCheck, LayoutGrid, Sparkles, ArrowDown } from 'lucide-react';

const heroStats = [
  { icon: GraduationCap, label: 'NEET • JEE', sub: 'Boards Ready' },
  { icon: Sparkles, label: 'Dark → White', sub: 'Ink Saver' },
  { icon: LayoutGrid, label: '4 per Sheet', sub: 'Smart N-Up' },
  { icon: ShieldCheck, label: '100% Offline', sub: 'Private' },
];

/**
 * Best-practice hero — Print Optimizer is now multi-tool (merge / whiten / enhance).
 * Aurora Dark gradient (#243BFF → #5B35FF → #A12CFF) stays as brand, but copy is
 * generic. No dark-slides-only messaging. CTA points to ToolsBox (not Upload).
 */
export const LandingHero: React.FC = () => {
  const scrollToTools = () => {
    const el = document.getElementById('tools');
    if (el) {
      const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
  };

  return (
    <section
      aria-label="Print Optimizer — made for students"
      className="relative overflow-hidden rounded-2xl border border-emerald-500/10 bg-gradient-to-b from-emerald-950/40 via-surface/60 to-surface/40 px-5 py-7 sm:py-9 text-center animate-slide-up"
    >
    <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
    <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-16 h-72 w-72 rounded-full bg-teal-500/8 blur-3xl" />
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent" />

    <div className="relative flex flex-col items-center gap-3.5">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/20 bg-emerald-600 px-3 py-1 text-xs font-bold tracking-wide text-white shadow-sm">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
        </span>
        Trusted by 50,000+ NEET • JEE • Boards Students
      </span>

      <h1 className="max-w-3xl text-balance text-[26px] font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
        Your Notes,{' '}
        <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
          Print-Ready in Seconds
        </span>
      </h1>

      <p className="max-w-xl text-pretty text-xs leading-relaxed text-ink-muted sm:text-sm">
        PW, Allen, Unacademy — bring dark slides, handwritten sheets & PYQs. Whiten, N-up 4 per sheet,
        <span className="font-semibold text-ink"> on your device</span> — offline, private, no upload.
      </p>

      <button
        type="button"
        onClick={scrollToTools}
        aria-label="Scroll to tools"
        className="mt-1 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-5 py-2.5 text-xs font-bold tracking-wide text-white shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-500/20 transition-all hover:shadow-xl hover:shadow-emerald-500/25 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-soft"
      >
        <ArrowDown className="h-3.5 w-3.5 shrink-0 animate-bounce" aria-hidden="true" />
        Explore tools for your notes
      </button>

      {/* Hint chips — student-focused, liquid glass */}
      <div className="hidden w-full max-w-2xl grid-cols-4 gap-2 sm:grid">
        {heroStats.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-1 rounded-xl border border-emerald-600/30 bg-emerald-50 px-2 py-2.5 backdrop-blur-sm">
            <stat.icon className="h-3.5 w-3.5 text-emerald-700" />
            <span className="text-2xs font-semibold tracking-wide text-slate-900">{stat.label}</span>
            <span className="hidden text-[9px] leading-none text-ink-muted sm:block">{stat.sub}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
  );
};