'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Eye, CheckSquare, Square, Image as ImageIcon } from 'lucide-react';
import { ProcessedPage } from '@/lib/optimizer/types';
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
}

// Lazy loaded & RAM-virtualized page item card
const LazyPageCard: React.FC<{
  page: ProcessedPage;
  idx: number;
  isSelected: boolean;
  isExcluded: boolean;
  isKeptOriginal: boolean;
  onSelectPage: (index: number) => void;
  onToggleExcludePage: (index: number) => void;
  onToggleKeepOriginalPage: (index: number) => void;
}> = ({ page, idx, isSelected, isExcluded, isKeptOriginal, onSelectPage, onToggleExcludePage, onToggleKeepOriginalPage }) => {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

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

  const inkSaved = Math.max(0, Math.round(page.inkCoverageBeforePct - page.inkCoverageAfterPct));

  return (
    <div
      ref={cardRef}
      className={`group relative flex flex-col rounded-xl border transition-all overflow-hidden ${
        isExcluded
          ? 'border-surface-2 bg-surface/40 opacity-40'
          : isSelected
          ? 'border-primary bg-primary-faint/60 ring-2 ring-primary shadow-md'
          : 'border-surface-2 bg-surface hover:border-elevated hover:shadow-md'
      }`}
    >
      {/* Card Header: keep-original (left) · Page N · exclude (right) */}
      <div className="flex items-center justify-between px-1 py-2 bg-surface-2/80 border-b border-elevated/60 text-xs">
        {/* Keep-original tick (LEFT) — pinned pages print their untouched scan */}
        <button
          type="button"
          onClick={() => onToggleKeepOriginalPage(idx)}
          aria-pressed={isKeptOriginal}
          aria-label={isKeptOriginal ? `Use whitened page ${idx + 1}` : `Keep page ${idx + 1} original`}
          className={`flex h-11 w-11 items-center justify-center rounded-md transition-transform active:scale-95 ${
            isKeptOriginal
              ? 'text-accent-soft bg-accent/15 hover:bg-accent/25'
              : 'text-ink-faint hover:bg-elevated/60'
          }`}
          title={isKeptOriginal ? 'Keeping original — tap to whiten' : 'Black/white box here? Keep the original scan'}
        >
          <ImageIcon className="h-5 w-5" />
        </button>

        <span className="font-bold text-ink truncate px-0.5">Page {idx + 1}</span>

        {/* Exclude Checkbox with enlarged touch area */}
        <button
          type="button"
          onClick={() => onToggleExcludePage(idx)}
          aria-pressed={isExcluded}
          aria-label={isExcluded ? `Include page ${idx + 1}` : `Exclude page ${idx + 1}`}
          className="flex h-11 w-11 items-center justify-center rounded-md text-primary-soft hover:bg-elevated/60 active:scale-95 transition-transform"
          title={isExcluded ? 'Include page' : 'Exclude page'}
        >
          {isExcluded ? (
            <Square className="h-5 w-5 text-ink-muted" />
          ) : (
            <CheckSquare className="h-5 w-5 text-primary-soft fill-primary/20" />
          )}
        </button>
      </div>

      {/* Thumbnail Image with IntersectionObserver lazy loading */}
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
        className="relative h-32 sm:h-36 w-full cursor-pointer overflow-hidden bg-bg flex items-center justify-center p-1.5"
      >
        {isVisible ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={page.thumbnailDataUrl}
            alt={`Slide ${idx + 1}`}
            className="max-h-full max-w-full object-contain shadow-sm"
          />
        ) : (
          <div className="h-full w-full bg-surface-2/60 animate-pulse rounded-md" />
        )}

        {/* Hover / Tap overlay button */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-bg/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-ink backdrop-blur-2xs">
          <Eye className="h-4 w-4 text-primary-soft" />
          <span className="text-[11px] font-bold">Inspect</span>
        </div>
      </div>

      {/* Card Footer Badges */}
      <div className="flex items-center justify-between p-2 text-2xs bg-surface border-t border-surface-2">
        <span className="truncate rounded-sm bg-surface-2 px-1.5 py-0.5 font-medium text-ink-muted max-w-[80px]">
          {page.profile.classification.replace('_', ' ')}
        </span>
        {isKeptOriginal ? (
          <span className="font-bold text-accent-soft bg-accent/10 border border-accent/25 px-1.5 py-0.5 rounded-sm">
            Original
          </span>
        ) : (
          <span className="font-bold text-success bg-success-strong/10 border border-success-strong/20 px-1.5 py-0.5 rounded-sm">
            -{inkSaved}% Ink
          </span>
        )}
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
            onSelectPage={onSelectPage}
            onToggleExcludePage={onToggleExcludePage}
            onToggleKeepOriginalPage={onToggleKeepOriginalPage}
          />
        ))}
      </div>
    </div>
  );
};
