'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Square, Circle, Trash2, Check, RotateCcw } from 'lucide-react';
import type { WhiteBoxRegion } from '@/lib/kernels/whiteBox';
import { Button } from '@/components/ui/Button';

/**
 * WhiteBoxEditor — popup for manually marking white-box regions that the
 * auto detector missed. The page is shown at preview resolution; every
 * rect is stored in full-res page pixels by scaling pointer coords.
 *
 * SCALABILITY NOTES
 * - No image duplication: only the two ImageData blobs (orig + opt) live
 *   here. Regions are tiny JSON (x,y,w,h,shape).
 * - Replaces string-duplication: old packed PDF bytes are never copied per
 *   region — the exporter composites at export time.
 * - Isolated component: drop-in for any tool that needs region editing.
 */

type Mode = 'rect' | 'ellipse';

interface Props {
  page: import('@/lib/optimizer/types').ProcessedPage;
  mergedPdfBytes: Uint8Array | null;
  /** Auto-detected regions (read-only, for reference). */
  autoRegions: WhiteBoxRegion[];
  /** Existing manual regions (editable). */
  manualRegions: WhiteBoxRegion[];
  onApply: (regions: WhiteBoxRegion[]) => void;
  onClose: () => void;
}

type Draft = WhiteBoxRegion & { _id: string };

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

export const WhiteBoxEditor: React.FC<Props> = ({
  page,
  mergedPdfBytes,
  autoRegions,
  manualRegions,
  onApply,
  onClose,
}) => {
  const pageIndex = page.pageIndex;
  const [optUrl, setOptUrl] = useState('');
  const [origUrl, setOrigUrl] = useState('');
  const [naturalWidth, setNaturalWidth] = useState(page.width ?? 800);
  const [naturalHeight, setNaturalHeight] = useState(page.height ?? 1100);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('rect');
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    manualRegions.map((r) => ({ ...r, _id: uid(), shape: r.shape ?? 'rect' })),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [dragHandle, setDragHandle] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const createdUrlsRef = useRef<string[]>([]);

  /* Lock body scroll while editor is open (mobile). */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* Load preview images (optimized + original) at the processed page's scale.
     Mirrors BeforeAfterSlider's loading pattern but keeps both as blob URLs
     for the editor's single-image base layer. */
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const { PdfExporter } = await import('@/lib/optimizer/pdfExporter');
        const opt = await PdfExporter.loadOptimizedImageData(page);
        const orig = await PdfExporter.loadOriginalImageData(page, mergedPdfBytes ?? null, opt.width);
        if (cancelled) return;
        setNaturalWidth(opt.width);
        setNaturalHeight(opt.height);
        const toBlobUrl = async (img: ImageData) => {
          const c = document.createElement('canvas');
          c.width = img.width; c.height = img.height;
          const ctx = c.getContext('2d')!;
          ctx.putImageData(img, 0, 0);
          const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b || new Blob()), 'image/jpeg', 0.82));
          return URL.createObjectURL(blob);
        };
        const [oUrl, pUrl] = await Promise.all([toBlobUrl(orig), toBlobUrl(opt)]);
        if (cancelled) {
          URL.revokeObjectURL(oUrl);
          URL.revokeObjectURL(pUrl);
          return;
        }
        // Revoke previous page's URLs before committing new ones
        createdUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
        createdUrlsRef.current = [oUrl, pUrl];
        setOrigUrl(oUrl);
        setOptUrl(pUrl);
        setIsLoading(false);
      } catch {
        if (!cancelled) {
          setOptUrl(page.thumbnailDataUrl);
          setOrigUrl(page.thumbnailDataUrl);
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, mergedPdfBytes]);

  // Revoke blob URLs on unmount
  useEffect(() => {
    return () => {
      createdUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      createdUrlsRef.current = [];
    };
  }, []);

  /* Convert client coords -> full-res page pixels. */
  const clientToPage = useCallback((clientX: number, clientY: number) => {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    const scaleX = naturalWidth / rect.width;
    const scaleY = naturalHeight / rect.height;
    return {
      x: Math.max(0, Math.min(naturalWidth, (clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(naturalHeight, (clientY - rect.top) * scaleY)),
    };
  }, [naturalWidth, naturalHeight]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    // Handle drags are handled separately
    if (target.dataset.handle) return;
    // Ignore clicks on controls
    if ((target.closest('button') as HTMLElement | null)) return;

    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = clientToPage(e.clientX, e.clientY);
    setDrawStart(pt);
    setIsDrawing(true);
    setSelectedId(null);
  }, [clientToPage]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragHandle && selectedId) {
      // Resize selected rect via handle
      const pt = clientToPage(e.clientX, e.clientY);
      setDrafts((prev) => prev.map((d) => {
        if (d._id !== selectedId) return d;
        let { x, y, width, height } = d;
        const x1 = x + width;
        const y1 = y + height;
        if (dragHandle.includes('n')) y = pt.y;
        if (dragHandle.includes('s')) height = pt.y - y;
        if (dragHandle.includes('w')) x = pt.x;
        if (dragHandle.includes('e')) width = pt.x - x;
        // Normalize negative sizes (user dragged past origin)
        if (width < 0) { x = x + width; width = -width; }
        if (height < 0) { y = y + height; height = -height; }
        return { ...d, x, y, width, height };
      }));
      return;
    }
    if (!isDrawing || !drawStart) return;
    const pt = clientToPage(e.clientX, e.clientY);
    const x = Math.min(drawStart.x, pt.x);
    const y = Math.min(drawStart.y, pt.y);
    const width = Math.abs(pt.x - drawStart.x);
    const height = Math.abs(pt.y - drawStart.y);
    // Update or create a temporary draft
    setDrafts((prev) => {
      const hasTemp = prev.some((d) => d._id === '__temp__');
      const temp: Draft = { _id: '__temp__', x, y, width, height, shape: mode };
      if (hasTemp) return prev.map((d) => d._id === '__temp__' ? temp : d);
      return [...prev, temp];
    });
  }, [isDrawing, drawStart, dragHandle, selectedId, mode, clientToPage]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragHandle) {
      setDragHandle(null);
      return;
    }
    if (!isDrawing) return;
    setIsDrawing(false);
    setDrawStart(null);
    // Promote temp draft to real one (or discard if too small)
    setDrafts((prev) => {
      const temp = prev.find((d) => d._id === '__temp__');
      if (!temp) return prev;
      const filtered = prev.filter((d) => d._id !== '__temp__');
      if (temp.width < 12 || temp.height < 12) return filtered;
      const real: Draft = { ...temp, _id: uid() };
      return [...filtered, real];
    });
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  }, [isDrawing, dragHandle]);

  const handleHandleDown = useCallback((e: React.PointerEvent, handle: string) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragHandle(handle);
  }, []);

  const handleApply = useCallback(() => {
    const clean: WhiteBoxRegion[] = drafts
      .filter((d) => d._id !== '__temp__' && d.width >= 12 && d.height >= 12)
      .map(({ _id, ...r }) => r);
    onApply(clean);
  }, [drafts, onApply]);

  const handleReset = useCallback(() => {
    setDrafts([]);
    setSelectedId(null);
  }, []);

  const imgScale = (imgRef.current?.getBoundingClientRect().width ?? 1) / naturalWidth;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-2 bg-surface px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-primary/20 px-2.5 py-1 text-xs font-bold text-primary-soft border border-primary/30">
            Page {pageIndex + 1} · Edit regions
          </span>
          <span className="hidden sm:inline text-xs text-ink-muted">
            Draw around black boxes to keep them original
          </span>
        </div>
        <button
          type="button"
          aria-label="Close editor"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-ink-muted hover:bg-elevated hover:text-ink"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-surface-2 bg-surface px-3 py-2.5">
        <div className="flex items-center gap-1 rounded-xl border border-surface-2 bg-bg p-1">
          <button
            type="button"
            aria-pressed={mode === 'rect'}
            onClick={() => setMode('rect')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${mode === 'rect' ? 'bg-primary-strong text-white shadow' : 'text-ink-muted hover:bg-elevated'}`}
          >
            <Square className="h-3.5 w-3.5" /> Rect
          </button>
          <button
            type="button"
            aria-pressed={mode === 'ellipse'}
            onClick={() => setMode('ellipse')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${mode === 'ellipse' ? 'bg-primary-strong text-white shadow' : 'text-ink-muted hover:bg-elevated'}`}
          >
            <Circle className="h-3.5 w-3.5" /> Circle
          </button>
        </div>
        <span className="hidden sm:inline text-xs text-ink-muted">
          {drafts.filter((d) => d._id !== '__temp__').length} manual region(s)
          {autoRegions.length > 0 && ` · ${autoRegions.length} auto`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-xl border border-elevated bg-surface-2 px-3 py-2 text-xs font-bold text-ink-muted hover:bg-elevated"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Clear
          </button>
          <Button variant="primary" size="md" onClick={handleApply}>
            <Check className="h-4 w-4" /> Apply
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="relative flex flex-1 items-center justify-center overflow-auto bg-bg p-3 sm:p-6"
        onPointerDown={!isLoading ? handlePointerDown : undefined}
        onPointerMove={!isLoading ? handlePointerMove : undefined}
        onPointerUp={!isLoading ? handlePointerUp : undefined}
        style={{ touchAction: 'none' }}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-20 text-ink-muted">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <span className="text-xs font-medium">Loading page…</span>
          </div>
        ) : (
          <div className="relative inline-block max-h-full max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={optUrl}
              alt={`Page ${pageIndex + 1} preview`}
              draggable={false}
              className="max-h-[64vh] sm:max-h-[70vh] max-w-[90vw] sm:max-w-[60vw] select-none object-contain shadow-xl"
            />

          {/* Auto regions (read-only, dashed) */}
          {autoRegions.map((r, i) => (
            <div
              key={`auto-${i}`}
              className="pointer-events-none absolute border-2 border-dashed border-accent/60 bg-accent/10"
              style={{
                left: r.x * imgScale,
                top: r.y * imgScale,
                width: r.width * imgScale,
                height: r.height * imgScale,
                borderRadius: r.shape === 'ellipse' ? '50%' : 2,
              }}
              title="Auto-detected white box"
            />
          ))}

          {/* Manual regions + temp draft */}
          {drafts.map((d) => {
            const isSelected = d._id === selectedId;
            const isTemp = d._id === '__temp__';
            return (
              <div
                key={d._id}
                onPointerDown={(e) => {
                  if (isTemp) return;
                  e.stopPropagation();
                  setSelectedId(d._id);
                }}
                className={`absolute border-2 bg-primary/15 ${isSelected ? 'border-primary-strong bg-primary/25 ring-2 ring-primary/30' : 'border-primary hover:bg-primary/20'} ${isTemp ? 'opacity-60' : ''}`}
                style={{
                  left: d.x * imgScale,
                  top: d.y * imgScale,
                  width: d.width * imgScale,
                  height: d.height * imgScale,
                  borderRadius: d.shape === 'ellipse' ? '50%' : 4,
                  cursor: isTemp ? 'crosshair' : 'move',
                }}
              >
                {/* Selected: resize handles + delete */}
                {isSelected && !isTemp && (
                  <>
                    {(['nw', 'ne', 'sw', 'se'] as const).map((h) => (
                      <span
                        key={h}
                        data-handle={h}
                        onPointerDown={(e) => handleHandleDown(e, h)}
                        className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary-strong shadow"
                        style={{
                          left: h.includes('w') ? 0 : '100%',
                          top: h.includes('n') ? 0 : '100%',
                          cursor: `${h}-resize`,
                        }}
                      />
                    ))}
                    <button
                      type="button"
                      aria-label="Delete region"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDrafts((prev) => prev.filter((x) => x._id !== d._id));
                        setSelectedId(null);
                      }}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-danger-strong text-white shadow"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="border-t border-surface-2 bg-surface px-3 py-2 text-center text-xs text-ink-muted">
        Drag on the page to draw a box. Tap a box to select & resize. Circle clips to an ellipse inside the same bounds.
      </div>
    </div>
  );
};
