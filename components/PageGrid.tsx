'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Eye, CheckSquare, Square, Image as ImageIcon, Pencil } from 'lucide-react';
import { ProcessedPage } from '@/lib/optimizer/types';
import type { WhiteBoxRegion } from '@/lib/kernels/whiteBox';
import { InfoTooltip } from '@/components/InfoTooltip';

interface PageGridProps {
  pages: ProcessedPage[];
  selectedPageIndex: number;
  onSelectPage: (index: number) => void;
  excludedPages: Set<number>;
  onToggleExcludePage: (index: number) => void;
  onToggleExcludeAll?: (exclude: boolean) => void;
  keepOriginalPages: Set<number>;
  onToggleKeepOriginalPage: (index: number) => void;
  manualWhiteBoxRegions: Record<number, WhiteBoxRegion[]>;
  onEditPage: (index: number) => void;
  mergedPdfBytes?: Uint8Array | null;
}

// Lazy loaded & RAM-virtualized page item card
const LazyPageCard: React.FC<{
  page: ProcessedPage;
  idx: number;
  isSelected: boolean;
  isExcluded: boolean;
  isKeptOriginal: boolean;
  manualCount: number;
  onSelectPage: (index: number) => void;
  onToggleExcludePage: (index: number) => void;
  onToggleKeepOriginalPage: (index: number) => void;
  onEditPage: (index: number) => void;
  mergedPdfBytes?: Uint8Array | null;
}> = ({ page, idx, isSelected, isExcluded, isKeptOriginal, manualCount, onSelectPage, onToggleExcludePage, onToggleKeepOriginalPage, onEditPage, mergedPdfBytes }) => {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [originalThumb, setOriginalThumb] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Dynamic virtualization: release image node when scrolling out of viewport
        setIsVisible(entry.isIntersecting);
      },
      { rootMargin: '150px 0px 150px 0px' }
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  // When kept as original, lazily generate original thumbnail for preview
  useEffect(() => {
    if (!isKeptOriginal || !mergedPdfBytes || !isVisible) return;
    if (originalThumb) return;
    let cancelled = false;
    (async () => {
      try {
        const { PdfExporter } = await import('@/lib/optimizer/pdfExporter');
        const orig = await PdfExporter.loadOriginalImageData(page, mergedPdfBytes, page.width);
        // Downscale to same thumbnail size as whitened (1/5)
        const tw = Math.max(1, Math.round(orig.width / 5));
        const th = Math.max(1, Math.round(orig.height / 5));
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = orig.width;
        srcCanvas.height = orig.height;
        srcCanvas.getContext('2d')!.putImageData(orig, 0, 0);
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = tw;
        thumbCanvas.height = th;
        thumbCanvas.getContext('2d')!.drawImage(srcCanvas, 0, 0, tw, th);
        const blob = await new Promise<Blob>((res) => thumbCanvas.toBlob((b) => res(b || new Blob()), 'image/jpeg', 0.6));
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setOriginalThumb(url);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [isKeptOriginal, isVisible, mergedPdfBytes, page, originalThumb]);

  useEffect(() => {
    return () => {
      if (originalThumb) URL.revokeObjectURL(originalThumb);
    };
  }, [originalThumb]);

  return (
    <div
      ref={cardRef}
      className={`group relative flex flex-col rounded-xl border transition-all overflow-hidden ${
        isExcluded
          ? 'border-surface-2 bg-surface/40 opacity-30'
          : isSelected
          ? 'border-primary/50 bg-primary-faint/40 ring-1 ring-primary/30 shadow-sm'
          : 'border-surface-2 bg-surface hover:border-elevated/80 hover:shadow-sm'
      }`}
    >
      {/* Card Header — compact premium */}
      <div className="flex items-center justify-between gap-1 px-2 py-1.5 bg-surface-2/60 border-b border-elevated/40">
        {/* Keep-original — left, subtle */}
        <button
          type="button"
          onClick={() => onToggleKeepOriginalPage(idx)}
          aria-pressed={isKeptOriginal}
          aria-label={isKeptOriginal ? `Use whitened page ${idx + 1}` : `Keep page ${idx + 1} original`}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all active:scale-95 ${
            isKeptOriginal
              ? 'text-accent-soft bg-accent/12 ring-1 ring-accent/20'
              : 'text-ink-faint/70 hover:text-ink-muted hover:bg-elevated/50'
          }`}
          title={isKeptOriginal ? 'Showing original — tap for whitened' : 'Tap to keep original scan (for sticky notes)'}
        >
          <ImageIcon className="h-4 w-4" />
        </button>

        <span className="text-[11px] font-semibold tracking-wide text-ink/80 truncate">P{idx + 1}</span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEditPage(page.pageIndex)}
            aria-label={`Edit regions for page ${page.pageIndex + 1}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted/70 hover:text-ink hover:bg-elevated/50 active:scale-95 transition-colors"
            title="Edit white-box regions"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onToggleExcludePage(idx)}
            aria-pressed={isExcluded}
            aria-label={isExcluded ? `Include page ${idx + 1}` : `Exclude page ${idx + 1}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg active:scale-95 transition-colors text-primary-soft/80 hover:bg-elevated/50"
            title={isExcluded ? 'Include page' : 'Exclude page'}
          >
            {isExcluded ? (
              <Square className="h-4 w-4 text-ink-muted/60" />
            ) : (
              <CheckSquare className="h-4 w-4 text-primary-soft fill-primary/15" />
            )}
          </button>
        </div>
      </div>

      {/* Thumbnail — premium inset */}
      <div
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        aria-label={`Inspect page ${idx + 1}`}
        onClick={() => onSelectPage(idx)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectPage(idx);
          }
        }}
        className="relative h-28 sm:h-32 w-full cursor-pointer overflow-hidden bg-bg flex items-center justify-center p-2"
      >
        {isVisible ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={isKeptOriginal && originalThumb ? originalThumb : page.thumbnailDataUrl}
            alt={`Slide ${idx + 1}`}
            className="max-h-full max-w-full object-contain rounded-sm shadow-sm"
          />
        ) : (
          <div className="h-full w-full bg-surface-2/50 animate-pulse rounded-md" />
        )}

        {/* Hover overlay — subtle */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-bg/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-ink backdrop-blur-[1px]">
          <Eye className="h-3.5 w-3.5 text-primary-soft" />
          <span className="text-[10px] font-semibold tracking-wide">View</span>
        </div>
        {isKeptOriginal && (
          <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-accent/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">Original</span>
        )}
      </div>

      {/* Card Footer — minimal */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-surface border-t border-surface-2/60 min-h-[28px]">
        <span className="text-[11px] font-medium text-ink-muted/60 truncate">P{idx + 1}</span>
        <span className="flex items-center gap-1">
          {(page.whiteBoxRegions?.length ?? 0) > 0 && (
            <span
              className="rounded-full bg-accent/8 px-1.5 py-0.5 text-[10px] font-semibold text-accent-soft border border-accent/15"
              title="Auto-kept white boxes"
            >
              {page.whiteBoxRegions!.length} auto
            </span>
          )}
          {manualCount > 0 && (
            <span
              className="rounded-full bg-primary/8 px-1.5 py-0.5 text-[10px] font-semibold text-primary-soft border border-primary/15"
              title="Manual edits"
            >
              +{manualCount}
            </span>
          )}
          {isKeptOriginal && (
            <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent-soft border border-accent/20">
              Original
            </span>
          )}
        </span>
      </div>
    </div>
  );
};

export const PageGrid: React.FC<PageGridProps> = ({
  pages,
  selectedPageIndex,
  onSelectPage,
  excludedPages,
  onToggleExcludePage,
  onToggleExcludeAll,
  keepOriginalPages,
  onToggleKeepOriginalPage,
  manualWhiteBoxRegions,
  onEditPage,
  mergedPdfBytes,
}) => {
  const activeCount = pages.length - excludedPages.size;
  const keptCount = keepOriginalPages.size;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-surface-2 bg-surface p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-2 pb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-ink">Document Page Thumbnails</h3>
            <InfoTooltip
              title="Selective Page Exclusion"
              content="Skip pages you don't need to print — like promo slides, chapter covers, or breaks."
              position="right"
            />
          </div>
          <p className="text-xs text-ink-muted">
            Tap a page to inspect before/after. Left icon keeps the untouched original; uncheck to exclude.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onToggleExcludeAll && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onToggleExcludeAll(false)}
                className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-[11px] font-bold text-ink-muted hover:bg-elevated"
              >
                Include All
              </button>
              <button
                type="button"
                onClick={() => onToggleExcludeAll(true)}
                className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-[11px] font-bold text-ink-muted hover:bg-elevated"
              >
                Exclude All
              </button>
            </div>
          )}
          <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary-soft border border-primary/30">
            {activeCount} of {pages.length} Pages
          </span>
          {keptCount > 0 && (
            <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent-soft border border-accent/30">
              {keptCount} Original
            </span>
          )}
        </div>
      </div>

      {/* Grid of Slide Cards - Mobile 2-column, Tablet 3-column, Desktop 4-5 columns */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[460px] overflow-y-auto p-1">
        {pages.map((page, idx) => (
          <LazyPageCard
            key={idx}
            page={page}
            idx={idx}
            isSelected={selectedPageIndex === idx}
            isExcluded={excludedPages.has(idx)}
            isKeptOriginal={keepOriginalPages.has(idx)}
            manualCount={manualWhiteBoxRegions[page.pageIndex]?.length ?? 0}
            onSelectPage={onSelectPage}
            onToggleExcludePage={onToggleExcludePage}
            onToggleKeepOriginalPage={onToggleKeepOriginalPage}
            onEditPage={onEditPage}
            mergedPdfBytes={mergedPdfBytes}
          />
        ))}
      </div>
    </div>
  );
};
