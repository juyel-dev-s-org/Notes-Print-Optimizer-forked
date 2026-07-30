'use client';

import React from 'react';
import { ProcessingProgress } from '@/lib/optimizer/types';
import { Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProcessingModalProps {
  progress: ProcessingProgress | null;
  phaseTitle?: string;
  onCancel?: () => void;
  progressiveThumbnails?: Map<number, string>;
}

export const ProcessingModal: React.FC<ProcessingModalProps> = ({ progress, phaseTitle, onCancel, progressiveThumbnails }) => {
  if (!progress || progress.stage === 'COMPLETE') return null;

  const thumbArray = progressiveThumbnails
    ? Array.from(progressiveThumbnails.entries()).sort(([a], [b]) => a - b)
    : [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 p-0 sm:p-4 backdrop-blur-sm pb-safe">
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="relative flex w-full max-w-md flex-col rounded-t-3xl sm:rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-white"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold tracking-wider uppercase text-indigo-400">
                {phaseTitle || 'Processing Workflow'}
              </span>
              <h3 className="text-sm font-bold text-white truncate">
                {progress.currentAction || 'Processing Document...'}
              </h3>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span>
                {progress.totalPages > 0
                  ? `Page ${progress.currentPage} of ${progress.totalPages}`
                  : 'Preparing WASM Pipeline...'}
              </span>
              <span className="text-indigo-400 font-mono font-bold">{progress.percent}%</span>
            </div>

            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800 border border-slate-700/50">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400"
                initial={{ width: '0%' }}
                animate={{ width: `${Math.max(5, progress.percent)}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
          </div>

          {thumbArray.length > 0 && (
            <div className="mt-4">
              <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 mb-2 block">
                Completed Pages ({thumbArray.length})
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin" style={{ scrollbarWidth: 'thin' }}>
                {thumbArray.map(([idx, url]) => (
                  <div key={idx} className="shrink-0 w-16 h-12 rounded-md overflow-hidden border border-slate-700/50 bg-slate-800">
                    <img src={url} alt={`Page ${idx + 1}`} className="w-full h-full object-contain" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800 pt-3">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <ShieldCheck className="h-3.5 w-3.5" /> 100% Client-Side RAM Engine
            </span>
            <div className="flex items-center gap-3">
              {progress.elapsedMs > 0 && (
                <span className="font-mono text-slate-400">
                  {(progress.elapsedMs / 1000).toFixed(1)}s
                </span>
              )}
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-900/40 text-red-300 hover:bg-red-800/60 transition-colors text-[10px] font-bold"
                >
                  <XCircle className="h-3 w-3" /> Cancel
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
