'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Download, CheckCircle2, RotateCcw, SlidersHorizontal, AlertCircle, Share2 } from 'lucide-react';
import type { EnhanceWorkflow } from '@/lib/enhance/useEnhanceWorkflow';

export const EnhanceExportView: React.FC<{ workflow: EnhanceWorkflow }> = ({ workflow }) => {
  const { state, handleExport, handleDownload, handleBackToWorkbench, handleReset } = workflow;
  const [sizeMb, setSizeMb] = useState<number | null>(null);

  useEffect(() => {
    if (state.pdfBlob) {
      setSizeMb(state.pdfBlob.size / (1024 * 1024));
    }
  }, [state.pdfBlob]);

  const busy = state.exportBusy;
  const ready = !busy && state.pdfBlob !== null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-surface-2/70 bg-surface/70 p-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-faint text-success border border-success/30 animate-[scale-in_0.4s_ease-out]">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </span>
        <h2 className="text-base font-bold text-ink">Print-Ready PDF</h2>
        <p className="text-xs leading-relaxed text-ink-muted">
          {state.results.length} page{state.results.length === 1 ? '' : 's'} enhanced
          {sizeMb !== null ? ` · ${sizeMb < 0.01 ? '<0.01' : sizeMb.toFixed(2)} MB` : ''} · ready to download
        </p>

        <button
          type="button"
          onClick={handleExport}
          disabled={busy}
          className="flex h-12 w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#243BFF] via-[#5B35FF] to-[#A12CFF] text-sm font-bold text-white shadow-md shadow-[#5B35FF]/25 transition-transform duration-150 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {busy ? 'Building PDF…' : ready ? 'Download Again' : 'Build Print-Ready PDF'}
        </button>

        {ready && (
          <>
            <button
              type="button"
              onClick={handleDownload}
              className="flex h-12 w-full max-w-sm items-center justify-center gap-2 rounded-xl border border-elevated bg-surface text-sm font-bold text-ink transition-transform duration-150 active:scale-[0.98]"
            >
              <Download className="h-4 w-4 text-accent-soft" />
              Save {state.fileName}
            </button>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={async () => {
                  if (!state.pdfBlob) return;
                  try {
                    const file = new File([state.pdfBlob], state.fileName, { type: 'application/pdf' });
                    if (navigator.canShare?.({ files: [file] })) {
                      await navigator.share({ files: [file], title: state.fileName });
                    } else {
                      await navigator.share({ title: state.fileName });
                    }
                  } catch {
                    /* user cancelled */
                  }
                }}
                className="flex h-11 w-full max-w-sm items-center justify-center gap-2 rounded-xl border border-elevated/70 bg-surface/70 text-xs font-bold text-ink transition-transform duration-150 active:scale-[0.98]"
              >
                <Share2 className="h-4 w-4 text-accent-soft" />
                Share PDF
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleBackToWorkbench}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-elevated/70 bg-surface/70 text-xs font-bold text-ink transition-transform duration-150 active:scale-[0.98]"
        >
          <SlidersHorizontal className="h-4 w-4 text-accent-soft" />
          Adjust Enhancement Settings
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-elevated/70 bg-surface/70 text-xs font-bold text-ink transition-transform duration-150 active:scale-[0.98]"
        >
          <RotateCcw className="h-4 w-4 text-accent-soft" />
          Start Over with New PDFs
        </button>
      </div>

      {state.error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-800/70 bg-red-950/60 px-4 py-3 text-xs text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <span>{state.error}</span>
        </div>
      )}
    </div>
  );
};