'use client';

import React, { useRef } from 'react';
import { AlertCircle, Ban, ImagePlus, Loader2, RotateCcw } from 'lucide-react';
import { FileSequencePanel } from '@/components/FileSequencePanel';
import { Button } from '@/components/ui/Button';
import type { ImagePageMode } from '@/lib/img2pdf/imagePdfReducer';
import type { ImagePdfWorkflow } from '@/lib/img2pdf/useImagePdfWorkflow';

const PAGE_MODES: Array<{ id: ImagePageMode; label: string; hint: string }> = [
  { id: 'fit', label: 'Fit to image', hint: 'Each page hugs its picture' },
  { id: 'a4', label: 'A4', hint: 'Uniform sheets, auto orientation' },
];

/** Arrange stage — image sequence + page setup + build CTA with progress. */
export const ImagePdfArrangeView: React.FC<{ workflow: ImagePdfWorkflow }> = ({ workflow }) => {
  const {
    state,
    maxFiles,
    handleUpload,
    handleBuild,
    handleCancelBuild,
    handleMoveFile,
    handleRemoveFile,
    handleReorderFiles,
    handleSmartArrange,
    handleSetPageMode,
    handleReset,
  } = workflow;
  const addRef = useRef<HTMLInputElement>(null);
  const busy = state.isBusy;
  const totalMB = state.files.reduce((sum, f) => sum + Number.parseFloat(f.sizeMB || '0'), 0);
  const canAddMore = state.files.length < maxFiles;
  const pct = state.progress ? Math.round((state.progress.current / Math.max(1, state.progress.total)) * 100) : 0;

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
            <ImagePlus className="h-4 w-4 text-primary-soft" aria-hidden="true" />
            Image Sequence ({state.files.length})
          </h3>
          <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
            {totalMB > 0 ? `${totalMB.toFixed(2)} MB total · ` : ''}pages follow this top-to-bottom order.
          </p>
        </div>

        <FileSequencePanel
          items={state.files}
          isProcessing={busy}
          onMoveItem={handleMoveFile}
          onRemoveItem={handleRemoveFile}
          onReorderItem={handleReorderFiles}
          onSmartArrange={handleSmartArrange}
          maxHeightClass="max-h-[300px]"
        />

        <input
          ref={addRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          multiple
          className="hidden"
          onChange={onAddMore}
          aria-hidden="true"
          tabIndex={-1}
        />
        {canAddMore ? (
          <button
            type="button"
            onClick={() => addRef.current?.click()}
            disabled={busy}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-elevated bg-surface/60 text-xs font-bold text-ink-muted transition-colors hover:border-primary/50 hover:text-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-soft disabled:opacity-50"
          >
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            Add More Images ({state.files.length}/{maxFiles})
          </button>
        ) : (
          <p className="text-center text-[11px] font-semibold text-warning-strong">Maximum of {maxFiles} images per PDF.</p>
        )}
      </section>

      {/* Page setup */}
      <section className="flex flex-col gap-3 rounded-2xl border border-surface-2 bg-surface/80 p-4" aria-busy={busy}>
        <h3 className="text-sm font-bold tracking-wide text-ink">Page Setup</h3>
        <div role="radiogroup" aria-label="Page size mode" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PAGE_MODES.map((m) => {
            const active = state.pageMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={busy}
                onClick={() => handleSetPageMode(m.id)}
                className={`flex flex-col gap-0.5 rounded-xl border px-3 py-3 text-left transition-colors ${
                  active ? 'border-primary/50 bg-primary-faint/50' : 'border-elevated bg-surface hover:bg-surface-2/50'
                }`}
              >
                <span className="text-sm font-bold text-ink">{m.label}</span>
                <span className="text-xs text-ink-muted">{m.hint}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Sticky CTA */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-surface-2 bg-bg/95 px-4 pt-3 backdrop-blur-md" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex flex-col gap-2">
          {busy ? (
            <>
              <div className="flex flex-col gap-2.5 rounded-xl border border-primary/30 bg-primary-faint/30 px-4 py-5 animate-enter">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary-soft" aria-hidden="true" />
                  <p className="truncate text-sm font-bold text-ink">{state.progress?.label}</p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
                  <div className="h-full rounded-full transition-all duration-200" style={{ width: `${Math.max(4, pct)}%`, background: 'var(--gradient-brand)' }} />
                </div>
                <p className="text-center text-xs tabular-nums text-ink-muted">
                  Image {state.progress?.current ?? 0} of {state.progress?.total ?? 0} · keep this tab open
                </p>
              </div>
              <Button variant="danger" size="md" fullWidth onClick={handleCancelBuild}>
                <Ban className="h-4 w-4" aria-hidden="true" />
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="lg" fullWidth onClick={handleBuild} disabled={state.files.length === 0}>
                {!busy && <ImagePlus className="h-4 w-4" aria-hidden="true" />}
                Create PDF ({state.files.length} image{state.files.length === 1 ? '' : 's'})
              </Button>
              <Button variant="ghost" size="md" fullWidth onClick={handleReset}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Start Over
              </Button>
            </>
          )}
        </div>
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
