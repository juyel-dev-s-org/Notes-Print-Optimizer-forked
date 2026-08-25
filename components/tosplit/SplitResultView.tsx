'use client';

import React, { useState } from 'react';
import { AlertCircle, Archive, CheckCircle2, FileText, MessageSquareHeart, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FileNameField } from '@/components/ui/FileNameField';
import type { SplitWorkflow } from '@/lib/tosplit/useSplitWorkflow';

/** Done screen — single extract gets a name field; burst gets ZIP + part rows. */
export const SplitResultView: React.FC<{ workflow: SplitWorkflow }> = ({ workflow }) => {
  const { state, handleDownloadSingle, handleDownloadZip, handleSaveOne, handleBackToOptions, handleReset } = workflow;
  const [baseName, setBaseName] = useState(state.source?.baseName ?? 'Split');
  const [zipping, setZipping] = useState(false);
  const single = state.kind === 'single';
  const totalBytes = state.outputs.reduce((sum, o) => sum + o.blob.size, 0);
  const totalSize =
    totalBytes > 1024 * 1024 ? `${(totalBytes / (1024 * 1024)).toFixed(2)} MB` : `${Math.max(1, Math.round(totalBytes / 1024))} KB`;

  const onDownloadZip = async () => {
    setZipping(true);
    try {
      await handleDownloadZip(baseName);
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-success/30 bg-surface/70 p-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-success/30 bg-success-faint text-success animate-[scale-in_0.4s_ease-out]">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </span>
        <h2 className="text-base font-bold text-ink">{single ? 'Pages Extracted' : 'PDF Split'}</h2>
        <p className="text-xs tabular-nums text-ink-muted">
          {state.outputs.length} file{state.outputs.length === 1 ? '' : 's'} · {totalSize}
          {!single && ` · ${state.outputs.reduce((s, o) => s + o.pages, 0)} pages total`}
        </p>
      </div>

      {single ? (
        <div className="rounded-2xl border border-surface-2 bg-surface/80 p-4">
          <FileNameField baseName={baseName} onChange={setBaseName} suffix="-PrintReady.pdf" label="Filename" />
          <Button size="lg" fullWidth className="mt-3" onClick={() => handleDownloadSingle(baseName)}>
            Download Extracted PDF
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2" role="list" aria-label="Split parts">
            {state.outputs.map((o) => (
              <button
                key={o.name}
                type="button"
                role="listitem"
                onClick={() => handleSaveOne(o)}
                title={`Download ${o.name}`}
                className="group flex items-center gap-3 rounded-xl border border-elevated bg-surface/70 px-3.5 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-primary-faint/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-soft"
              >
                <FileText className="h-4 w-4 shrink-0 text-primary-soft" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-xs font-bold text-ink">{o.name}</span>
                <span className="shrink-0 text-2xs tabular-nums text-ink-muted group-hover:text-primary-soft">save</span>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-surface-2 bg-surface/80 p-4">
            <FileNameField baseName={baseName} onChange={setBaseName} suffix="-PrintReady.zip" label="ZIP filename" />
            <Button size="lg" fullWidth className="mt-3" loading={zipping} onClick={onDownloadZip}>
              {!zipping && <Archive className="h-4 w-4" aria-hidden="true" />}
              {zipping ? 'Packing…' : `Download All (${state.outputs.length})`}
            </Button>
          </div>
        </>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleBackToOptions}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-elevated/70 bg-surface/70 text-xs font-bold text-ink transition-transform duration-150 active:scale-[0.98]"
        >
          <SlidersHorizontal className="h-4 w-4 text-accent-soft" aria-hidden="true" />
          Adjust Split Settings
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-elevated/70 bg-surface/70 text-xs font-bold text-ink transition-transform duration-150 active:scale-[0.98]"
        >
          <RotateCcw className="h-4 w-4 text-accent-soft" aria-hidden="true" />
          Split Another File
        </button>
        <a
          href="mailto:myself.juyel.dev@gmail.com?subject=Split%20PDF%20feedback"
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
