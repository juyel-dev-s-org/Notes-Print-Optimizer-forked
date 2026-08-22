'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Download, MessageSquareHeart, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FileNameField } from '@/components/ui/FileNameField';
import type { ProtectWorkflow } from '@/lib/protect/useProtectWorkflow';

/** Success screen: custom filename + download + next actions. */
export const ProtectResultView: React.FC<{ workflow: ProtectWorkflow }> = ({ workflow }) => {
  const { state, handleDownload, handleBackToOptions, handleReset } = workflow;
  const [baseName, setBaseName] = useState(state.source?.baseName ?? 'Protected');
  const sizeMb = state.resultBlob ? (state.resultBlob.size / (1024 * 1024)).toFixed(2) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-success/30 bg-surface/70 p-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-success/30 bg-success-faint text-success animate-[scale-in_0.4s_ease-out]">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </span>
        <h2 className="text-base font-bold text-ink">PDF Protected 🔒</h2>
        <p className="text-xs leading-relaxed text-ink-muted">
          AES-256 applied · ready to download{sizeMb ? ` · ${sizeMb} MB` : ''}
        </p>

        <div className="mt-2 w-full max-w-sm">
          <FileNameField baseName={baseName} onChange={setBaseName} suffix="-PrintReady.pdf" />
        </div>

        <Button size="lg" fullWidth className="max-w-sm" onClick={() => handleDownload(baseName)}>
          {!state.isBusy && <Download className="h-4 w-4" aria-hidden="true" />}
          Download Protected PDF
        </Button>
      </div>

      <p className="text-center text-[11px] leading-relaxed text-ink-muted">
        Encrypted with the{' '}
        <a
          href="https://www.iso.org/standard/75839.html"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-primary-soft underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        >
          PDF Standard Security Handler
        </a>{' '}
        (ISO 32000-2) · processed entirely on this device.
      </p>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleBackToOptions}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-elevated/70 bg-surface/70 text-xs font-bold text-ink transition-transform duration-150 active:scale-[0.98]"
        >
          <SlidersHorizontal className="h-4 w-4 text-accent-soft" aria-hidden="true" />
          Adjust Security Options
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-elevated/70 bg-surface/70 text-xs font-bold text-ink transition-transform duration-150 active:scale-[0.98]"
        >
          <RotateCcw className="h-4 w-4 text-accent-soft" aria-hidden="true" />
          Protect Another File
        </button>
        <a
          href="mailto:myself.juyel.dev@gmail.com?subject=Protect%20PDF%20feedback"
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-elevated/70 bg-surface/70 text-xs font-bold text-ink transition-transform duration-150 active:scale-[0.98]"
        >
          <MessageSquareHeart className="h-4 w-4 text-accent-soft" aria-hidden="true" />
          Give Feedback
        </a>
      </div>

      {state.error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-800/70 bg-red-950/60 px-4 py-3 text-xs text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      )}
    </div>
  );
};
