'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Grid,
  Layers,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { LayoutConfig } from '@/lib/optimizer/types';
import { useDialogFocus } from '@/lib/ui/useDialogFocus';

interface FullPdfViewerPreviewProps {
  sheetPreviews: string[];
  layoutConfig: LayoutConfig;
  title?: string;
}

export const FullPdfViewerPreview: React.FC<FullPdfViewerPreviewProps> = ({
  sheetPreviews,
  layoutConfig,
  title = 'A4 Print Sheet Preview',
}) => {
  const [currentSheetIdx, setCurrentSheetIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('single');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const fullscreenCloseRef = useRef<HTMLButtonElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);

  useDialogFocus({
    open: isFullscreen,
    containerRef: fullscreenRef,
    initialFocusRef: fullscreenCloseRef,
    restoreFocusRef: expandButtonRef,
  });

  // Close the fullscreen modal on Escape.
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  if (!sheetPreviews || sheetPreviews.length === 0) {
    return null;
  }

  const isLandscape = layoutConfig.orientation === 'LANDSCAPE';
  const totalSheets = sheetPreviews.length;

  const handlePrevSheet = () => {
    setCurrentSheetIdx((prev) => (prev > 0 ? prev - 1 : totalSheets - 1));
  };

  const handleNextSheet = () => {
    setCurrentSheetIdx((prev) => (prev < totalSheets - 1 ? prev + 1 : 0));
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 25, 50));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-surface-2 bg-surface/90 p-3 sm:p-4 shadow-2xl">
      {/* Top PDF Viewer Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-2 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary-soft border border-primary/30">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-ink flex items-center gap-2">
              <span>{title}</span>
              <span className="rounded-md bg-primary-strong/30 px-2 py-0.5 text-2xs font-bold text-primary-soft border border-primary/30">
                {layoutConfig.gridFormat} Grid
              </span>
            </h3>
            <p className="text-2xs sm:text-xs text-ink-muted">
              Sheet {currentSheetIdx + 1} of {totalSheets} &bull; A4 {layoutConfig.orientation}
            </p>
          </div>
        </div>

        {/* Viewer Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* View Mode Switcher */}
          <div className="flex items-center rounded-lg bg-bg p-1 border border-surface-2">
            <button
              type="button"
              onClick={() => setViewMode('single')}
              aria-pressed={viewMode === 'single'}
              aria-label="View single sheet"
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-bold transition-all ${
                viewMode === 'single'
                  ? 'bg-primary-strong text-white shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
              title="Single Sheet Viewer"
            >
              <Layers className="h-3 w-3" />
              <span className="hidden sm:inline">Sheet</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              aria-label="Show grid overview"
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-bold transition-all ${
                viewMode === 'grid'
                  ? 'bg-primary-strong text-white shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
              title="Grid Overview"
            >
              <Grid className="h-3 w-3" />
              <span className="hidden sm:inline">Grid ({totalSheets})</span>
            </button>
          </div>

          {/* Zoom controls (Single Sheet Mode) */}
          {viewMode === 'single' && (
            <div className="hidden sm:flex items-center gap-1 rounded-lg bg-bg p-1 border border-surface-2 text-2xs">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 50}
                aria-label="Zoom out"
                className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-2 disabled:opacity-30"
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="w-10 text-center font-bold text-primary-soft">{zoomLevel}%</span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 200}
                aria-label="Zoom in"
                className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-2 disabled:opacity-30"
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              {zoomLevel !== 100 && (
                <button
                  type="button"
                  onClick={handleResetZoom}
                  aria-label="Reset zoom"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-2"
                  title="Reset Zoom"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Fullscreen Modal Toggle */}
          <button
            ref={expandButtonRef}
            type="button"
            onClick={() => setIsFullscreen(true)}
            aria-label="Expand full screen PDF viewer"
            className="flex items-center gap-1 rounded-lg border border-elevated bg-surface-2 px-2.5 py-1.5 text-[11px] font-bold text-ink hover:bg-elevated hover:text-ink transition-all"
            title="Expand Full Screen PDF Viewer"
          >
            <Maximize2 className="h-3.5 w-3.5 text-primary-soft" />
            <span className="hidden min-[400px]:inline">Expand</span>
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      {viewMode === 'single' ? (
        <div className="relative w-full overflow-hidden rounded-xl bg-bg p-3 sm:p-6 border border-surface-2/80 flex flex-col items-center justify-center min-h-[320px] sm:min-h-[460px]">
          {/* Edge-to-edge A4 Paper Stage */}
          <div
            className="transition-all duration-200 ease-out flex items-center justify-center max-w-full"
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center center' }}
          >
            {/* Realistic A4 Paper */}
            <div
              className={`relative bg-white rounded-xs shadow-[0_20px_50px_rgba(0,0,0,0.7)] border border-line overflow-hidden flex items-center justify-center p-1 sm:p-2 transition-all ${
                isLandscape
                  ? 'w-full max-w-[620px] aspect-[1.414/1]'
                  : 'w-full max-w-[440px] aspect-[1/1.414]'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sheetPreviews[currentSheetIdx]}
                alt={`A4 Print Sheet ${currentSheetIdx + 1}`}
                className="max-h-full max-w-full object-contain pointer-events-none rounded-xs select-none"
              />

              {/* Watermark/Edge Marker for paper authenticity */}
              <div className="absolute top-1 right-2 text-[8px] font-bold text-ink-muted opacity-40 select-none uppercase tracking-wider">
                A4 {layoutConfig.paperSize} &bull; PRINT READY
              </div>
            </div>
          </div>

          {/* Carousel Next/Prev Navigation Buttons overlay */}
          {totalSheets > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevSheet}
                className="absolute left-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-elevated bg-surface/90 text-ink shadow-xl hover:bg-primary-strong hover:border-primary transition-all active:scale-95"
                aria-label="Previous Sheet"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>

              <button
                type="button"
                onClick={handleNextSheet}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-elevated bg-surface/90 text-ink shadow-xl hover:bg-primary-strong hover:border-primary transition-all active:scale-95"
                aria-label="Next Sheet"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Sheet Indicators */}
          {totalSheets > 1 && (
            <div className="mt-4 flex items-center justify-center gap-1.5 flex-wrap">
{sheetPreviews.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSheetIdx(idx)}
                  aria-label={`Go to sheet ${idx + 1}`}
                  aria-current={idx === currentSheetIdx ? 'step' : undefined}
                  className="flex h-4 min-w-8 items-center justify-center px-1"
                >
                  <span
                    className={`h-2 rounded-full transition-all ${
                      idx === currentSheetIdx ? 'w-6 bg-primary' : 'w-2 bg-elevated hover:bg-ink-muted'
                    }`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Grid Overview Gallery */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[480px] overflow-y-auto p-1">
          {sheetPreviews.map((previewUrl, sIdx) => (
            <div
              key={sIdx}
              role="button"
              tabIndex={0}
              aria-pressed={sIdx === currentSheetIdx}
              aria-label={`Open sheet ${sIdx + 1}`}
              onClick={() => {
                setCurrentSheetIdx(sIdx);
                setViewMode('single');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setCurrentSheetIdx(sIdx);
                  setViewMode('single');
                }
              }}
              className={`group relative flex flex-col rounded-xl border p-2.5 transition-all cursor-pointer ${
                sIdx === currentSheetIdx
                  ? 'border-primary bg-primary-faint/40 ring-2 ring-primary/50 shadow-lg'
                  : 'border-surface-2 bg-bg/80 hover:border-elevated hover:bg-surface'
              }`}
            >
              <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-ink-muted">
                <span>Sheet {sIdx + 1} of {totalSheets}</span>
                <span className="text-2xs text-primary-soft font-semibold">{layoutConfig.gridFormat}</span>
              </div>

              {/* Realistic A4 Thumbnail */}
              <div
                className={`relative w-full overflow-hidden rounded-xs bg-white border border-line flex items-center justify-center p-1 shadow-md group-hover:shadow-xl transition-all ${
                  isLandscape ? 'aspect-[1.414/1]' : 'aspect-[1/1.414]'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={`Sheet ${sIdx + 1}`}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FULLSCREEN PDF VIEWER MODAL */}
      {isFullscreen && (
        <div
          ref={fullscreenRef}
          role="dialog"
          aria-modal="true"
          aria-label="Full screen A4 sheet viewer"
          className="fixed inset-0 z-50 flex flex-col bg-bg/90 backdrop-blur-xl animate-in fade-in duration-200"
        >
          {/* Fullscreen Header */}
          <div className="flex items-center justify-between border-b border-surface-2 bg-surface p-3 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-primary-strong px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                Full-Screen A4 Viewer
              </span>
              <span className="text-xs font-bold text-ink-muted">
                Sheet {currentSheetIdx + 1} of {totalSheets} ({layoutConfig.gridFormat} Grid)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevSheet}
                disabled={totalSheets <= 1}
                aria-label="Previous sheet"
                className="flex h-9 items-center gap-1 rounded-lg border border-elevated bg-surface-2 px-3 text-xs font-bold text-ink hover:bg-elevated disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <button
                type="button"
                onClick={handleNextSheet}
                disabled={totalSheets <= 1}
                aria-label="Next sheet"
                className="flex h-9 items-center gap-1 rounded-lg border border-elevated bg-surface-2 px-3 text-xs font-bold text-ink hover:bg-elevated disabled:opacity-30"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>

              <button
                ref={fullscreenCloseRef}
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-danger-deep px-3.5 text-xs font-bold text-white shadow-lg hover:bg-danger-strong transition-all"
              >
                <Minimize2 className="h-4 w-4" />
                <span>Close</span>
              </button>
            </div>
          </div>

          {/* Fullscreen Paper Area */}
          <div className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center bg-bg">
            <div
              className={`relative bg-white rounded-xs shadow-[0_25px_60px_rgba(0,0,0,0.8)] border border-line p-2 max-w-full max-h-full flex items-center justify-center ${
                isLandscape
                  ? 'w-[92vw] max-w-[1100px] aspect-[1.414/1]'
                  : 'w-[88vw] max-w-[800px] aspect-[1/1.414]'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sheetPreviews[currentSheetIdx]}
                alt={`Full Screen Sheet ${currentSheetIdx + 1}`}
                className="max-h-full max-w-full object-contain rounded-xs"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};