'use client';

import React, { useState } from 'react';
import { AlertCircle, Archive, MessageSquareHeart, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FileNameField } from '@/components/ui/FileNameField';
import type { ImagesWorkflow } from '@/lib/toimages/useImagesWorkflow';

/** Success screen: thumbnail strip, ZIP filename field, per-image downloads. */
export const ImagesResultView: React.FC<{ workflow: ImagesWorkflow }> = ({ workflow }) => {
  const { state, handleDownloadZip, handleDownloadSingle, handleBackToOptions, handleReset } = workflow;
  const [zipBase, setZipBase] = useState(state.source?.baseName ?? 'Images');
  const [zipping, setZipping] = useState(false);
  const totalBytes = state.results.reduce((sum, r) => sum + r.blob.size, 0);
  const visibleThumbs = state.results.slice(0, 8);
  const hiddenCount = state.results.length - visibleThumbs.length;

  const onDownloadZip = async () => {
    setZipping(true);
    try {
      await handleDownloadZip(zipBase);
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-success/30 bg-surface/70 p-6 text-center">
        <h2 className="text-base font-bold text-ink">Conversion Successful</h2>
        <p className="text-xs tabular-nums text-ink-muted">
          {state.results.length} image{state.results.length === 1 ? '' : 's'} extracted
          {' · '}
          {totalBytes > 1024 * 1024
            ? `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`
            : `${Math.max(1, Math.round(totalBytes / 1024))} KB`}{' '}
          total
        </p>

        {/* Thumbnail strip — tap any page to download it alone */}
        <div className="mt-1 w-full">
          <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Converted pages">
            {visibleThumbs.map((page) => (
              <button
                key={page.name}
                type="button"
                role="listitem"
                onClick={() => handleDownloadSingle(page)}
                title={`Download ${page.name}`}
                className="group relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-elevated/80 transition-all hover:border-primary hover:ring-2 hover:ring-primary/30"
              >
                <img src={page.thumbDataUrl} alt={`Page ${page.name}`} className="h-full w-full object-cover" loading="lazy" />
                <span className="absolute inset-x-0 bottom-0 bg-bg/75 py-0.5 text-center text-[9px] font-bold text-ink opacity-0 transition-opacity group-hover:opacity-100">
                  ⬇ save
                </span>
              </button>
            ))}
            {hiddenCount > 0 && (
              <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-elevated bg-surface/60 text-[11px] font-bold tabular-nums text-ink-muted">
                +{hiddenCount}
              </div>
            )}
          </div>
          <p className="mt-1.5 text-[10px] text-ink-faint">Tap a thumbnail to save that single image</p>
        </div>
      </div>

      <div className="rounded-2xl border border-surface-2 bg-surface/80 p-4">
        <FileNameField baseName={zipBase} onChange={setZipBase} suffix="-PrintReady.zip" label="ZIP filename" />
        <Button size="lg" fullWidth className="mt-3" loading={zipping} onClick={onDownloadZip}>
          {!zipping && <Archive className="h-4 w-4" aria-hidden="true" />}
          {zipping ? 'Packing…' : `Download All (${state.results.length})`}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleBackToOptions}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-elevated/70 bg-surface/70 text-xs font-bold text-ink transition-transform duration-150 active:scale-[0.98]"
        >
          <SlidersHorizontal className="h-4 w-4 text-accent-soft" aria-hidden="true" />
          Adjust Resolution or Format
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-elevated/70 bg-surface/70 text-xs font-bold text-ink transition-transform duration-150 active:scale-[0.98]"
        >
          <RotateCcw className="h-4 w-4 text-accent-soft" aria-hidden="true" />
          Convert One More
        </button>
        <a
          href="mailto:myself.juyel.dev@gmail.com?subject=PDF%20to%20Images%20feedback"
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-elevated/70 bg-surface/70 text-xs font-bold text-ink transition-transform duration-150 active:scale-[0.98]"
        >
          <MessageSquareHeart className="h-4 w-4 text-accent-soft" aria-hidden="true" />
          Give Feedback
        </a>
      </div>

      <p className="pb-2 text-center text-[10px] text-ink-faint">
        Individual files: <span className="font-semibold">{zipBase}-p01.{state.results[0]?.name.split('.').pop() ?? 'jpg'}</span>, -p02, …
      </p>
      {state.error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-800/70 bg-red-950/60 px-4 py-3 text-xs text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      )}
    </div>
  );
};
