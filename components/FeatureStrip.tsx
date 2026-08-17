'use client';

import React from 'react';
import { Zap, Lock, LayoutGrid, Printer } from 'lucide-react';

const features = [
  { icon: Zap, title: 'Instant Optimization', desc: 'Fast on-device processing' },
  { icon: Lock, title: 'Private On-Device', desc: 'Files never leave your device' },
  { icon: LayoutGrid, title: 'Smart Layout', desc: 'Auto series detection & N-up grids' },
  { icon: Printer, title: 'Print Ready', desc: 'Ink- and paper-saving output' },
];

export const FeatureStrip: React.FC = () => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
    {features.map((f) => (
      <div
        key={f.title}
        className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-5 text-center transition-colors duration-150 hover:border-slate-700 hover:bg-slate-900/70"
      >
        <f.icon className="h-5 w-5 text-indigo-400" />
        <span className="text-xs font-semibold text-slate-200">{f.title}</span>
        <span className="text-[10px] leading-relaxed text-slate-500">{f.desc}</span>
      </div>
    ))}
  </div>
);