'use client';

import React, { useRef } from 'react';
import { AlertCircle, Files, Plus, RotateCcw, ShieldCheck, Wand2 } from 'lucide-react';
import { FileSequencePanel } from '@/components/FileSequencePanel';
import { Button } from '@/components/ui/Button';
import { MAX_ENHANCE_FILES } from '@/lib/enhance/types';
import type { EnhanceWorkflow } from '@/lib/enhance/useEnhanceWorkflow';

/**
 * Arrange stage — uploaded PDFs land here instead of auto-processing.
 * Reuses the main flow's sequence panel (drag & drop, arrows, Smart
 * Arrange) and only hands off to the workbench via the explicit
 * "Enhance PDF" button.
 */
export const EnhanceArrangeView: React.FC<{ workflow: EnhanceWorkflow }> = ({ workflow }) => {
  const {
    state,
    handleUpload,
    handleStartEnhance,
    handleMoveFile,
    handleReorderFiles,
    handleRemoveFile,
    handleSmartArrange,
    handleReset,
  } = workflow;
  const addMoreRef = useRef<HTMLInputElement>(null);
  const canAddMore = state.files.length < MAX_ENHANCE_FILES;

  const onAddMore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (picked.length > 0) void handleUpload(picked);
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-2xl border border-surface-2 bg-surface/80 p-4">
        <div className="border-b border-surface-2 pb-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
            <Files className="h-4 w-4 text-primary-soft" aria-hidden="true" />
            PDF Sequence ({state.files.length})
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            Arrange files in reading order — then enhance them all at once.
          </p>
        </div>

        <FileSequencePanel
          items={state.files}
          isProcessing={state.isProcessing}
          onMoveItem={handleMoveFile}
          onRemoveItem={handleRemoveFile}
          onReorderItem={handleReorderFiles}
          onSmartArrange={handleSmartArrange}
          maxHeightClass="max-h-[340px]"
        />

        <input
          ref={addMoreRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={onAddMore}
          aria-hidden="true"
          tabIndex={-1}
        />
        {canAddMore ? (
          <button
            type="button"
            onClick={() => addMoreRef.current?.click()}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-elevated bg-surface/60 text-xs font-bold text-ink-muted transition-colors hover:border-primary/50 hover:text-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-soft"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add More PDFs ({state.files.length}/{MAX_ENHANCE_FILES})
          </button>
        ) : (
          <p className="text-center text-[11px] font-semibold text-warning-strong">
            Maximum of {MAX_ENHANCE_FILES} files per session.
          </p>
        )}
      </section>

      {/* Sticky handoff CTA — safe-area aware for gesture bar */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-surface-2 bg-bg/95 px-4 pt-3 backdrop-blur-md" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex flex-col gap-2">
          <Button size="lg" fullWidth onClick={handleStartEnhance} disabled={state.files.length === 0}>
            {!state.isProcessing && <Wand2 className="h-4 w-4" />}
            {state.isProcessing ? 'Enhancing…' : `Enhance ${state.files.length === 1 ? 'PDF' : `${state.files.length} PDFs`}`}
          </Button>
          <Button variant="ghost" size="md" fullWidth onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
            Start Over
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 pb-2 text-[11px] font-semibold text-success">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        100% Private On-Device Processing
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
