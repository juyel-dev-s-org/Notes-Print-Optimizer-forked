'use client';

import React from 'react';
import { Cpu, Zap, CheckCircle2 } from 'lucide-react';
import { processingEngineRegistry, EngineVersion } from '@/lib/optimizer/engine';

interface EngineSelectorProps {
  selectedVersion: EngineVersion;
  onSelectVersion: (version: EngineVersion) => void;
  disabled?: boolean;
}

export const EngineSelector: React.FC<EngineSelectorProps> = ({
  selectedVersion,
  onSelectVersion,
  disabled = false,
}) => {
  const engines = processingEngineRegistry.listEngines();

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-3 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-indigo-400" />
          <h4 className="text-xs font-bold text-slate-200">
            Modular Processing Engine
          </h4>
        </div>
        <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
          Pluggable Architecture
        </span>
      </div>

      <div className={`grid grid-cols-1 ${engines.length > 1 ? 'sm:grid-cols-2' : ''} gap-2 mt-1`}>
        {engines.map((eng) => {
          const isSelected = selectedVersion.toLowerCase() === eng.version.toLowerCase();
          return (
            <button
              key={eng.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectVersion(eng.version)}
              className={`flex flex-col gap-1 rounded-lg border p-2.5 text-left transition-all ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-950/40 text-white shadow-sm ring-1 ring-indigo-500/50'
                  : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              } disabled:opacity-50`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <Zap className={`h-3.5 w-3.5 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                  {eng.name}
                </span>
                {isSelected && (
                  <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                {eng.description}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-slate-300">
                  {eng.version.toUpperCase()}
                </span>
                {eng.capabilities.supportsWebWorkers && (
                  <span className="rounded bg-emerald-950/80 px-1.5 py-0.5 text-[9px] font-mono text-emerald-300 border border-emerald-800/40">
                    Web Worker
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
