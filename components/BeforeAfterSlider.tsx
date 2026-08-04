'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Droplet, CheckCircle2 } from 'lucide-react';
import { ProcessedPage } from '@/lib/optimizer/types';
import { PdfExporter } from '@/lib/optimizer/pdfExporter';
import { memoryManager } from '@/lib/optimizer/memoryManager';

interface BeforeAfterSliderProps {
  page: ProcessedPage;
  /** Merged source PDF bytes - used to lazily re-render the original page. */
  mergedPdfBytes?: Uint8Array | null;
  onClose?: () => void;
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({ page, mergedPdfBytes }) => {
  const [sliderPos, setSliderPos] = useState(50); // 0% to 100%
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [origUrl, setOrigUrl] = useState<string>('');
  const [optUrl, setOptUrl] = useState<string>('');
  const [isLoadingImages, setIsLoadingImages] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadImages = async () => {
      setIsLoadingImages(true);
      try {
        const optimizedImageData = await PdfExporter.loadOptimizedImageData(page);
        const originalImageData = await PdfExporter.loadOriginalImageData(page, mergedPdfBytes ?? null);

        const origCanvas = document.createElement('canvas');
        origCanvas.width = originalImageData.width;
        origCanvas.height = originalImageData.height;
        const origCtx = origCanvas.getContext('2d');
        if (origCtx) origCtx.putImageData(originalImageData, 0, 0);

        const optCanvas = document.createElement('canvas');
        optCanvas.width = optimizedImageData.width;
        optCanvas.height = optimizedImageData.height;
        const optCtx = optCanvas.getContext('2d');
        if (optCtx) optCtx.putImageData(optimizedImageData, 0, 0);

        if (!isCancelled) {
          const origBlob = await new Promise<Blob>((res) => origCanvas.toBlob((b) => res(b || new Blob()), 'image/jpeg', 0.6));
          const optBlob = await new Promise<Blob>((res) => optCanvas.toBlob((b) => res(b || new Blob()), 'image/jpeg', 0.6));
          setOrigUrl(URL.createObjectURL(origBlob));
          setOptUrl(URL.createObjectURL(optBlob));
          setIsLoadingImages(false);
        }

        memoryManager.disposeCanvas(origCanvas);
        memoryManager.disposeCanvas(optCanvas);
      } catch (err) {
        console.error('Failed to load page inspection images:', err);
        if (!isCancelled) {
          setOrigUrl(page.thumbnailDataUrl);
          setOptUrl(page.thumbnailDataUrl);
          setIsLoadingImages(false);
        }
      }
    };

    loadImages();

    return () => {
      isCancelled = true;
    };
  }, [page, mergedPdfBytes]);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleMove(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    if (e.touches.length > 0) handleMove(e.touches[0].clientX);
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) handleMove(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) handleMove(e.touches[0].clientX);
  };

  const inkSaved = Math.max(0, Math.round(page.inkCoverageBeforePct - page.inkCoverageAfterPct));

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl">
      {/* Top Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-indigo-500/20 px-2.5 py-1 text-xs font-bold text-indigo-300 border border-indigo-500/30">
            Page {page.pageIndex + 1}
          </span>
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">
            {page.profile.classification.replace('_', ' ')}
          </span>
        </div>

        {/* Ink Saved Metric */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1 font-medium text-slate-400">
            <Droplet className="h-3.5 w-3.5 text-slate-500" />
            <span>Before: <strong className="text-slate-200">{page.inkCoverageBeforePct}% Ink</strong></span>
          </div>
          <span className="text-slate-600">→</span>
          <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>Optimized: <strong>{page.inkCoverageAfterPct}% Ink</strong></span>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">
              -{inkSaved}% Saved
            </span>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => { setZoom(1); setSliderPos(50); }}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            title="Reset Zoom"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Interactive Split View Container with touch-action */}
      <div
        ref={containerRef}
        className="relative h-[360px] sm:h-[480px] w-full cursor-col-resize select-none-touch overflow-hidden rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center p-3 shadow-inner"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleMouseUp}
        onTouchMove={handleTouchMove}
      >
        {/* Optimized Image (Base Layer - Right Side) */}
        {optUrl && (
          <div className="absolute inset-0 flex items-center justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={optUrl}
              alt="Optimized PW Slide"
              style={{ transform: `scale(${zoom})` }}
              className="max-h-full max-w-full object-contain transition-transform duration-100 shadow-xl"
            />
          </div>
        )}

        {/* Original Image (Clipped Layer - Left Side via clipPath) */}
        {origUrl && (
          <div
            className="absolute inset-0 flex items-center justify-center p-3"
            style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={origUrl}
              alt="Original Raw PW Slide"
              style={{ transform: `scale(${zoom})` }}
              className="max-h-full max-w-full object-contain transition-transform duration-100 shadow-xl"
            />
          </div>
        )}

        {/* Vertical Divider Handle Line */}
        <div
          className="absolute bottom-0 top-0 z-10 w-0.5 bg-indigo-500 shadow-md shadow-indigo-500/50"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600 p-2 text-white shadow-lg ring-2 ring-white/80 active:scale-110 transition-transform">
            <div className="flex items-center gap-1 text-[10px] font-bold">
              <span>◄</span>
              <span>►</span>
            </div>
          </div>
        </div>

        {/* Side Labels */}
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-slate-900/90 px-2.5 py-1 text-xs font-semibold text-slate-300 border border-slate-800 backdrop-blur-xs">
          Original Raw
        </div>
        <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-emerald-950/90 px-2.5 py-1 text-xs font-semibold text-emerald-300 border border-emerald-800/80 backdrop-blur-xs">
          Optimized Print
        </div>
      </div>

      <p className="text-center text-xs text-slate-400">
        Swipe or drag the slider left & right to compare raw dark slide vs whitening print output.
      </p>
    </div>
  );
};

