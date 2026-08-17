'use client';

import React from 'react';
import { ShieldCheck, Zap, LayoutGrid, Printer, ArrowDown } from 'lucide-react';

const heroStats = [
  { icon: ShieldCheck, label: '100% Private', sub: 'On-device processing' },
  { icon: Zap, label: '80% Ink Saved', sub: 'Auto-whitening' },
  { icon: LayoutGrid, label: 'Smart N-Up', sub: '1-up to 10-up grids' },
  { icon: Printer, label: 'Print Ready', sub: 'Paper-saving output' },
];

export const LandingHero: React.FC = () => (
  <section
    aria-label="PW Optimizer — convert lecture slides to print-ready PDFs"
    className="relative overflow-hidden rounded-2xl lg:rounded-3xl border border-slate-800/70 bg-gradient-to-b from-indigo-950/40 via-slate-900/60 to-slate-900/40 px-5 py-8 sm:px-8 sm:py-12 lg:px-10 lg:py-14 text-center animate-slide-up"
  >
    {/* Ambient glows */}
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl"
    />
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-32 -right-16 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl"
    />

    <div className="relative flex flex-col items-center gap-4 sm:gap-5">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-[11px] font-bold tracking-wide text-indigo-300">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
        Mobile-First · Works Offline · No Account
      </span>

      <h1 className="max-w-3xl text-balance text-2xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-[2.75rem]">
        Turn dark lecture slides into{' '}
        <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
          crisp print-ready PDFs
        </span>
      </h1>

      <p className="max-w-xl text-pretty text-xs leading-relaxed text-slate-400 sm:text-sm lg:text-[15px]">
        Auto-whitening, banner removal and smart N-up layouts — all processed
        locally on your device. Nothing is ever uploaded to a server.
      </p>

      <div className="grid w-full max-w-2xl grid-cols-2 gap-2.5 sm:grid-cols-4">
        {heroStats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center gap-1 rounded-xl border border-slate-800/80 bg-slate-950/50 px-2 py-3"
          >
            <stat.icon className="h-4 w-4 text-indigo-400" />
            <span className="text-[11px] font-bold text-slate-200">{stat.label}</span>
            <span className="text-[10px] text-slate-500">{stat.sub}</span>
          </div>
        ))}
      </div>

      <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
        <ArrowDown className="h-3 w-3 text-slate-600" />
        Drop your class notes below to begin
      </div>
    </div>
  </section>
);