'use client';

import React, { useRef } from 'react';
import { ProcessingProgress } from '@/lib/optimizer/types';
import { Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { useDialogFocus } from '@/lib/ui/useDialogFocus';

interface ProcessingModalProps {
  progress: ProcessingProgress | null;
  phaseTitle?: string;
  onCancel?: () => void;
  progressiveThumbnails?: Map<number, string>;
}

export const ProcessingModal: React.FC<ProcessingModalProps> = ({ progress, phaseTitle, onCancel, progressiveThumbnails }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const isOpen = !!(progress && progress.stage !== 'COMPLETE');

  useDialogFocus({ open: isOpen, containerRef: modalRef });

  if (!progress || progress.stage === 'COMPLETE') return null;

  const thumbArray = progressiveThumbnails
    ? Array.from(progressiveThumbnails.entries()).sort(([a], [b]) => a - b)
    : [];

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="processing-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-bg/80 p-0 sm:p-4 backdrop-blur-sm pb-safe animate-fade-in"
    >
      <div className="relative flex w-full max-w-md flex-col rounded-t-3xl sm:rounded-2xl border border-surface-2 bg-surface p-6 shadow-2xl text-ink animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-strong/20 text-primary-soft border border-primary/30">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold tracking-wider uppercase text-primary-soft">
                {phaseTitle || 'Processing Workflow'}
              </span>
              <h3 id="processing-modal-title" className="text-sm font-bold text-ink truncate">
                {progress.currentAction || 'Processing Document...'}
              </h3>
            </div>
          </div>

          <div role="status" className="mt-5 flex flex-col gap-2">
            <div className="flex justify-between text-xs font-semibold text-ink-muted">
              <span>
                {progress.totalPages > 0
                  ? `Page ${progress.currentPage} of ${progress.totalPages}`
                  : 'Preparing WASM Pipeline...'}
              </span>
              <span className="text-primary-soft font-mono font-bold">{progress.percent}%</span>
            </div>

            <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2 border border-elevated/50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary via-accent-soft to-success transition-[width] duration-200 ease-out"
                style={{ width: `${Math.max(5, progress.percent)}%` }}
              />
            </div>
          </div>

          {thumbArray.length > 0 && (
            <div className="mt-4">
              <span className="text-[10px] font-bold tracking-wider uppercase text-ink-muted mb-2 block">
                Completed Pages ({thumbArray.length})
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                {thumbArray.map(([idx, url]) => (
                  <div key={idx} className="shrink-0 w-16 h-12 rounded-md overflow-hidden border border-elevated/50 bg-surface-2">
                    <img src={url} alt={`Page ${idx + 1}`} className="w-full h-full object-contain" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between text-[11px] text-ink-muted border-t border-surface-2 pt-3">
            <span className="flex items-center gap-1 text-success font-medium">
              <ShieldCheck className="h-3.5 w-3.5" /> 100% Client-Side RAM Engine
            </span>
            <div className="flex items-center gap-3">
              {progress.elapsedMs > 0 && (
                <span className="font-mono text-ink-muted">
                  {(progress.elapsedMs / 1000).toFixed(1)}s
                </span>
              )}
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-danger-faint/40 text-danger-soft hover:bg-danger-faint/60 transition-colors text-[10px] font-bold"
                >
                  <XCircle className="h-3 w-3" /> Cancel
                </button>
              )}
            </div>
          </div>
        </div>
    </div>
  );
};