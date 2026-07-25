'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Eye, Check, CheckSquare, Square, RotateCw } from 'lucide-react';
import { ProcessedPage } from '@/lib/optimizer/types';
import { InfoTooltip } from '@/components/InfoTooltip';

interface PageGridProps {
  pages: ProcessedPage[];
  selectedPageIndex: number;
  onSelectPage: (index: number) => void;
  excludedPages: Set<number>;
  onToggleExcludePage: (index: number) => void;
  onToggleExcludeAll?: (exclude: boolean) => void;
}

// Lazy loaded & RAM-virtualized page item card
const LazyPageCard: React.FC<{
  page: ProcessedPage;
  idx: number;
  isSelected: boolean;
  isExcluded: boolean;
  onSelectPage: (index: number) => void;
  onToggleExcludePage: (index: number) => void;
}> = ({ page, idx, isSelected, isExcluded, onSelectPage, onToggleExcludePage }) => {
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
          ? 'border-slate-800 bg-slate-900/40 opacity-40'
          : isSelected
          ? 'border-indigo-500 bg-indigo-950/60 ring-2 ring-indigo-500 shadow-md'
          : 'border-slate-800 bg-slate-900 hover:border-slate-700 hover:shadow-md'
      }`}
    >
      {/* Card Header & Checkbox */}
      <div className="flex items-center justify-between px-2.5 py-2 bg-slate-800/80 border-b border-slate-700/60 text-xs">
        <span className="font-bold text-slate-200">Page {idx + 1}</span>

        {/* Exclude Checkbox with enlarged touch area */}
        <button
          type="button"
          onClick={() => onToggleExcludePage(idx)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-indigo-400 hover:bg-slate-700/60 active:scale-95 transition-transform"
          title={isExcluded ? 'Include page' : 'Exclude page'}
        >
          {isExcluded ? (
            <Square className="h-4 w-4 text-slate-500" />
          ) : (
            <CheckSquare className="h-4 w-4 text-indigo-400 fill-indigo-500/20" />
          )}
        </button>
      </div>

      {/* Thumbnail Image with IntersectionObserver lazy loading */}
      <div
        onClick={() => onSelectPage(idx)}
        className="relative h-32 sm:h-36 w-full cursor-pointer overflow-hidden bg-slate-950 flex items-center justify-center p-1.5"
      >
        {isVisible ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={page.thumbnailDataUrl}
            alt={`Slide ${idx + 1}`}
            className="max-h-full max-w-full object-contain shadow-sm"
          />
        ) : (
          <div className="h-full w-full bg-slate-800/60 animate-pulse rounded-md" />
        )}

        {/* Hover / Tap overlay button */}
        <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white backdrop-blur-2xs">
          <Eye className="h-4 w-4 text-indigo-400" />
          <span className="text-[11px] font-bold">Inspect</span>
        </div>
      </div>

      {/* Card Footer Badges */}
      <div className="flex items-center justify-between p-2 text-[10px] bg-slate-900 border-t border-slate-800">
        <span className="truncate rounded-sm bg-slate-800 px-1.5 py-0.5 font-medium text-slate-300 max-w-[80px]">
          {page.profile.classification.replace('_', ' ')}
        </span>
        <span className="font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-sm">
          -{inkSaved}% Ink
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
}) => {
  const activeCount = pages.length - excludedPages.size;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-white">Document Page Thumbnails</h3>
            <InfoTooltip
              title="Selective Page Exclusion"
              content="Uncheck promo slides, chapter covers, or break slides commonly found in PW PDF packages to avoid printing unnecessary pages."
              position="right"
            />
          </div>
          <p className="text-xs text-slate-400">
            Tap a page to inspect before/after in split-view comparator. Uncheck to exclude.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onToggleExcludeAll && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onToggleExcludeAll(false)}
                className="rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-300 hover:bg-slate-700"
              >
                Include All
              </button>
              <button
                type="button"
                onClick={() => onToggleExcludeAll(true)}
                className="rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-400 hover:bg-slate-700"
              >
                Exclude All
              </button>
            </div>
          )}
          <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300 border border-indigo-500/30">
            {activeCount} of {pages.length} Pages
          </span>
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
            onSelectPage={onSelectPage}
            onToggleExcludePage={onToggleExcludePage}
          />
        ))}
      </div>
    </div>
  );
};

