'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Square, Circle, Trash2, Check, RotateCcw } from 'lucide-react';
import type { WhiteBoxRegion } from '@/lib/kernels/whiteBox';
import { Button } from '@/components/ui/Button';

/**
 * WhiteBoxEditor — canvas-based manual region editor.
 *
 * FIXES #1 and #3: Single source of truth is the canvas backing store
 * (natural page pixels). Pointer → page via canvas.width/rect.width,
 * no stale naturalWidth, no object-contain letterbox, no overlay div
 * scaling. One canvas draws base image + auto dashed + manual solid
 * + handles in a single draw loop.
 *
 * SCALABILITY: Isolated, no image duplication (ImageData refs only),
 * regions are tiny JSON. Future zoom/pan just changes the helper.
 */

type Mode = 'rect' | 'ellipse';

interface Props {
  page: import('@/lib/optimizer/types').ProcessedPage;
  mergedPdfBytes: Uint8Array | null;
  autoRegions: WhiteBoxRegion[];
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
  mergedPdfBytes: _mergedPdfBytes,
  autoRegions,
  manualRegions,
  onApply,
  onClose,
}) => {
  const pageIndex = page.pageIndex;
  const [mode, setMode] = useState<Mode>('rect');
  const [naturalWidth, setNaturalWidth] = useState(page.width ?? 800);
  const [naturalHeight, setNaturalHeight] = useState(page.height ?? 1100);
  const [isLoading, setIsLoading] = useState(true);
  const [drafts, setDrafts] = useState<Draft[]>(() => {
    // Manual regions may be normalized (0..1) — denormalize for canvas pixel display
    const W = page.width ?? 800, H = page.height ?? 1100;
    return manualRegions.map((r) => {
      const isNorm = r.x >=0 && r.x <=1 && r.y >=0 && r.y <=1 && r.width <=1 && r.height <=1 && r.width < 1;
      const px = isNorm ? { x: Math.round(r.x*W), y: Math.round(r.y*H), width: Math.round(r.width*W), height: Math.round(r.height*H) } : r;
      return { ...px, _id: uid(), shape: r.shape ?? 'rect' };
    });
  });
  // Sync drafts when page changes — denormalize if stored as ratio
  useEffect(() => {
    const W = naturalWidth, H = naturalHeight;
    setDrafts(manualRegions.map((r) => {
      const isNorm = r.x >=0 && r.x <=1 && r.y >=0 && r.y <=1 && r.width <=1 && r.height <=1 && r.width < 1;
      const px = isNorm ? { x: Math.round(r.x*W), y: Math.round(r.y*H), width: Math.round(r.width*W), height: Math.round(r.height*H) } : r;
      return { ...px, _id: uid(), shape: r.shape ?? 'rect' };
    }));
  }, [page.pageIndex, manualRegions, naturalWidth, naturalHeight]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragHandleRef = useRef<string | null>(null);
  const moveOffsetRef = useRef<{ dx: number; dy: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const optDataRef = useRef<ImageData | null>(null);
  // origDataRef removed — editor only needs optimized (whitened) image for display;
  // original is composited at export/thumbnail time, saving ~10 MB/page.

  /* Lock body scroll */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* Load ImageData at processed scale (same as export) — only optimized needed for canvas */
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const { PdfExporter } = await import('@/lib/optimizer/pdfExporter');
        const opt = await PdfExporter.loadOptimizedImageData(page);
        if (cancelled) return;
        optDataRef.current = opt;
        setNaturalWidth(opt.width);
        setNaturalHeight(opt.height);
        setIsLoading(false);
      } catch {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page]);

  /* Draw loop — single canvas truth */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const opt = optDataRef.current;
    if (!canvas || !opt) return;
    // Backing store = natural page pixels
    if (canvas.width !== naturalWidth || canvas.height !== naturalHeight) {
      canvas.width = naturalWidth;
      canvas.height = naturalHeight;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Base whitened image
    ctx.putImageData(opt, 0, 0);
    // Auto regions (dashed accent)
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = 'rgba(124, 92, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(124, 92, 255, 0.1)';
    for (const r of autoRegions) {
      if (r.shape === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      } else {
        ctx.fillRect(r.x, r.y, r.width, r.height);
        ctx.strokeRect(r.x, r.y, r.width, r.height);
      }
    }
    ctx.restore();
    // Manual drafts
    for (const d of drafts) {
      const isSelected = d._id === selectedId;
      const isTemp = d._id === '__temp__';
      ctx.save();
      ctx.strokeStyle = isSelected ? 'rgba(37, 99, 235, 1)' : 'rgba(37, 99, 235, 0.9)';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.fillStyle = isSelected ? 'rgba(37, 99, 235, 0.18)' : 'rgba(37, 99, 235, 0.12)';
      if (isTemp) ctx.globalAlpha = 0.6;
      if (d.shape === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(d.x + d.width / 2, d.y + d.height / 2, d.width / 2, d.height / 2, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      } else {
        ctx.fillRect(d.x, d.y, d.width, d.height);
        ctx.strokeRect(d.x, d.y, d.width, d.height);
      }
      // Handles for selected — 8 handles (4 corners + 4 edges) + move
        if (isSelected && !isTemp) {
          ctx.fillStyle = 'rgba(37, 99, 235, 1)';
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 1.5;
          const hs = 7;
          const hx = [d.x, d.x + d.width / 2, d.x + d.width];
          const hy = [d.y, d.y + d.height / 2, d.y + d.height];
          // Corners
          const corners: [number, number][] = [
            [d.x, d.y], [d.x + d.width, d.y], [d.x, d.y + d.height], [d.x + d.width, d.y + d.height],
          ];
          for (const [cx, cy] of corners) {
            ctx.beginPath();
            ctx.arc(cx, cy, hs / 2, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
          }
          // Edges (midpoints) — small squares
          const edges: [number, number][] = [
            [hx[1], hy[0]], [hx[1], hy[2]], [hx[0], hy[1]], [hx[2], hy[1]],
          ];
          for (const [ex, ey] of edges) {
            ctx.fillRect(ex - hs / 2, ey - hs / 2, hs, hs);
            ctx.strokeRect(ex - hs / 2, ey - hs / 2, hs, hs);
          }
          // Center move dot
          ctx.beginPath();
          ctx.arc(d.x + d.width / 2, d.y + d.height / 2, 3, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fill(); ctx.strokeStyle = 'rgba(37,99,235,1)'; ctx.stroke();
        }
      ctx.restore();
    }
  }, [naturalWidth, naturalHeight, autoRegions, drafts, selectedId]);

  useEffect(() => { draw(); }, [draw]);
  // Redraw after image load (optDataRef updated, but draw depends on naturalWidth etc.)
  useEffect(() => { if (!isLoading) draw(); }, [isLoading, draw]);

  /* Pointer → page coords via canvas backing vs CSS rect */
  const clientToPage = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: Math.max(0, Math.min(naturalWidth, (clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(naturalHeight, (clientY - rect.top) * scaleY)),
    };
  }, [naturalWidth, naturalHeight]);

  const canvasPointToRegionHit = useCallback((x: number, y: number): string | null => {
    // Topmost draft hit test (reverse order)
    for (let i = drafts.length - 1; i >= 0; i--) {
      const d = drafts[i];
      if (d._id === '__temp__') continue;
      if (d.shape === 'ellipse') {
        const cx = d.x + d.width / 2, cy = d.y + d.height / 2;
        const rx = d.width / 2, ry = d.height / 2;
        if (rx <= 0 || ry <= 0) continue;
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) return d._id;
      } else {
        if (x >= d.x && x <= d.x + d.width && y >= d.y && y <= d.y + d.height) return d._id;
      }
    }
    return null;
  }, [drafts]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || isLoading) return;
    const rect = canvas.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
    const pt = clientToPage(e.clientX, e.clientY);
    // Check handle hit first — 8 handles (corners + edges) + move
    if (selectedId) {
      const sel = drafts.find((d) => d._id === selectedId);
      if (sel) {
        const isTouch = e.pointerType === 'touch';
        const base = isTouch ? 18 : 12;
        const handleRadius = base * (naturalWidth / rect.width);
        const hx = [sel.x, sel.x + sel.width / 2, sel.x + sel.width];
        const hy = [sel.y, sel.y + sel.height / 2, sel.y + sel.height];
        const handles: Record<string, [number, number]> = {
          nw: [hx[0], hy[0]], n: [hx[1], hy[0]], ne: [hx[2], hy[0]],
          w: [hx[0], hy[1]], e: [hx[2], hy[1]],
          sw: [hx[0], hy[2]], s: [hx[1], hy[2]], se: [hx[2], hy[2]],
        };
        for (const [h, [hx_, hy_]] of Object.entries(handles)) {
          if (Math.hypot(pt.x - hx_, pt.y - hy_) < handleRadius) {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            dragHandleRef.current = h;
            return;
          }
        }
        // Inside selected region → move whole box
        const inside = pt.x >= sel.x && pt.x <= sel.x + sel.width && pt.y >= sel.y && pt.y <= sel.y + sel.height;
        if (inside) {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          moveOffsetRef.current = { dx: pt.x - sel.x, dy: pt.y - sel.y };
          dragHandleRef.current = 'move';
          return;
        }
      }
    }
    // Check region hit for selection
    const hitId = canvasPointToRegionHit(pt.x, pt.y);
    if (hitId) {
      setSelectedId(hitId);
      return;
    }
    // Start new rect — use ref to avoid stale closure between down/move
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drawStartRef.current = pt;
    setIsDrawing(true);
    setSelectedId(null);
  }, [isLoading, clientToPage, selectedId, drafts, naturalWidth, canvasPointToRegionHit]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const dragHandle = dragHandleRef.current;
    if (dragHandle && selectedId) {
      const pt = clientToPage(e.clientX, e.clientY);
      if (dragHandle === 'move' && moveOffsetRef.current) {
        const { dx, dy } = moveOffsetRef.current;
        setDrafts((prev) => prev.map((d) => {
          if (d._id !== selectedId) return d;
          let nx = pt.x - dx;
          let ny = pt.y - dy;
          // Clamp inside canvas
          nx = Math.max(0, Math.min(naturalWidth - d.width, nx));
          ny = Math.max(0, Math.min(naturalHeight - d.height, ny));
          return { ...d, x: nx, y: ny };
        }));
        return;
      }
      setDrafts((prev) => prev.map((d) => {
        if (d._id !== selectedId) return d;
        let { x, y, width, height } = d;
        if (dragHandle.includes('n')) { const ny = pt.y; height = height + (y - ny); y = ny; }
        if (dragHandle.includes('s')) height = pt.y - y;
        if (dragHandle.includes('w')) { const nx = pt.x; width = width + (x - nx); x = nx; }
        if (dragHandle.includes('e')) width = pt.x - x;
        if (width < 0) { x = x + width; width = -width; }
        if (height < 0) { y = y + height; height = -height; }
        // Clamp
        x = Math.max(0, Math.min(naturalWidth - width, x));
        y = Math.max(0, Math.min(naturalHeight - height, y));
        width = Math.min(width, naturalWidth - x);
        height = Math.min(height, naturalHeight - y);
        return { ...d, x, y, width, height };
      }));
      return;
    }
    const drawStart = drawStartRef.current;
    if (!isDrawing || !drawStart) return;
    const pt = clientToPage(e.clientX, e.clientY);
    const x = Math.min(drawStart.x, pt.x);
    const y = Math.min(drawStart.y, pt.y);
    const width = Math.abs(pt.x - drawStart.x);
    const height = Math.abs(pt.y - drawStart.y);
    setDrafts((prev) => {
      const hasTemp = prev.some((d) => d._id === '__temp__');
      const temp: Draft = { _id: '__temp__', x, y, width, height, shape: mode };
      if (hasTemp) return prev.map((d) => d._id === '__temp__' ? temp : d);
      return [...prev, temp];
    });
  }, [isDrawing, selectedId, mode, clientToPage, naturalWidth, naturalHeight]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragHandleRef.current) { dragHandleRef.current = null; moveOffsetRef.current = null; return; }
    if (!isDrawing) return;
    setIsDrawing(false);
    drawStartRef.current = null;
    setDrafts((prev) => {
      const temp = prev.find((d) => d._id === '__temp__');
      if (!temp) return prev;
      const filtered = prev.filter((d) => d._id !== '__temp__');
      if (temp.width < 12 || temp.height < 12) return filtered;
      // Auto-select new box
      const nid = uid();
      setTimeout(() => setSelectedId(nid), 0);
      return [...filtered, { ...temp, _id: nid }];
    });
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  }, [isDrawing]);

  const handleApply = useCallback(() => {
    // Store as NORMALIZED ratio (grid system) — survives crop/scale/DPR changes
    const clean: WhiteBoxRegion[] = drafts
      .filter((d) => d._id !== '__temp__' && d.width >= 12 && d.height >= 12)
      .map(({ _id, x, y, width, height, shape }) => ({
        x: x / naturalWidth,
        y: y / naturalHeight,
        width: width / naturalWidth,
        height: height / naturalHeight,
        shape,
      }));
    onApply(clean);
  }, [drafts, onApply, naturalWidth, naturalHeight]);

  const handleReset = useCallback(() => {
    setDrafts([]); setSelectedId(null);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;
    setDrafts((prev) => prev.filter((d) => d._id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  // Keyboard nudge for selected region — production polish
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId || isDrawing) return;
      const step = e.shiftKey ? 10 : 2;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else if (e.key === 'Delete' || e.key === 'Backspace') { handleDeleteSelected(); return; }
      else return;
      e.preventDefault();
      setDrafts((prev) => prev.map((d) => {
        if (d._id !== selectedId) return d;
        const nx = Math.max(0, Math.min(naturalWidth - d.width, d.x + dx));
        const ny = Math.max(0, Math.min(naturalHeight - d.height, d.y + dy));
        return { ...d, x: nx, y: ny };
      }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, isDrawing, naturalWidth, naturalHeight, handleDeleteSelected]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-2 bg-surface px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-primary/20 px-2.5 py-1 text-xs font-bold text-primary-soft border border-primary/30">
            Page {pageIndex + 1} · Edit regions
          </span>
          <span className="hidden sm:inline text-xs text-ink-muted">Draw around black boxes to keep them original</span>
        </div>
        <button type="button" aria-label="Close editor" onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-ink-muted hover:bg-elevated hover:text-ink">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-surface-2 bg-surface px-3 py-2.5">
        <div className="flex items-center gap-1 rounded-xl border border-surface-2 bg-bg p-1">
          <button type="button" aria-pressed={mode === 'rect'} onClick={() => setMode('rect')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${mode === 'rect' ? 'bg-primary-strong text-white shadow' : 'text-ink-muted hover:bg-elevated'}`}>
            <Square className="h-3.5 w-3.5" /> Rect
          </button>
          <button type="button" aria-pressed={mode === 'ellipse'} onClick={() => setMode('ellipse')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${mode === 'ellipse' ? 'bg-primary-strong text-white shadow' : 'text-ink-muted hover:bg-elevated'}`}>
            <Circle className="h-3.5 w-3.5" /> Circle
          </button>
        </div>
        <span className="hidden sm:inline text-xs text-ink-muted">
          {drafts.filter((d) => d._id !== '__temp__').length} manual region(s)
          {autoRegions.length > 0 && ` · ${autoRegions.length} auto`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {selectedId && (
            <button type="button" onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 rounded-xl border border-danger/30 bg-danger-strong/10 px-3 py-2 text-xs font-bold text-danger hover:bg-danger-strong/20">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
          <button type="button" onClick={handleReset}
            className="flex items-center gap-1.5 rounded-xl border border-elevated bg-surface-2 px-3 py-2 text-xs font-bold text-ink-muted hover:bg-elevated">
            <RotateCcw className="h-3.5 w-3.5" /> Clear
          </button>
          <Button variant="primary" size="md" onClick={handleApply}>
            <Check className="h-4 w-4" /> Apply
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="relative flex flex-1 items-center justify-center overflow-auto bg-bg p-3 sm:p-6">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-20 text-ink-muted">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <span className="text-xs font-medium">Loading page…</span>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="max-h-[64vh] sm:max-h-[70vh] max-w-[90vw] sm:max-w-[60vw] select-none shadow-xl touch-none"
            style={{ width: 'auto', height: 'auto', maxWidth: '90vw', maxHeight: '64vh' }}
          />
        )}
      </div>

      <div className="border-t border-amber-900/20 bg-[#451A03]/95 backdrop-blur-sm px-3 py-2.5 text-center">
        <p className="text-xs font-bold leading-tight text-[#FACC15]">পেজের উপর টেনে বক্স আঁকুন • বক্সে ট্যাপ করে সিলেক্ট করুন</p>
        <p className="mt-0.5 text-[11px] font-medium leading-tight text-amber-200/85">কোনা/ধার ধরে টেনে সাইজ • ভেতরে ধরে সরান • তীর চিহ্নে নিখুঁত করুন</p>
      </div>
    </div>
  );
};
