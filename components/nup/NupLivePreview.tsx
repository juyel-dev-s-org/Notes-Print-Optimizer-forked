'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react';
import { getPdfjsLib } from '@/lib/optimizer/pdfjsLoader';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { fitInto, nupPaperSize, planSheet, type NupOptions } from '@/lib/nup/nupLayout';

export interface NupLivePreviewProps {
  /** Merged source PDF bytes (a copy is handed to pdf.js internally). */
  mergedBytes: Uint8Array | null;
  /** Layout options — the composed sheet redraws instantly on any change. */
  opts: NupOptions;
  totalPages: number;
}

/** How many source pages we pre-render for instant previews. */
const CACHE_PAGES = 20;

type Phase = 'loading' | 'ready' | 'error';

/**
 * Instant real-page preview.
 *
 * When the layout step opens, the first CACHE_PAGES source pages are
 * rasterized once in the background (pdf.js, lazy). Every option change —
 * format, paper, orientation, margins, borders, numbers — then redraws the
 * composed sheet synchronously from that cache (<1 frame): no buttons,
 * no waiting, no blank boxes. Sheets are navigable as long as their pages
 * exist in the cache; the full document is only assembled on Generate.
 */
export const NupLivePreview: React.FC<NupLivePreviewProps> = ({ mergedBytes, opts, totalPages }) => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [cachedCount, setCachedCount] = useState(0);
  const [sheetIdx, setSheetIdx] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const bytesKeyRef = useRef<Uint8Array | null>(null);
  const pageCanvasesRef = useRef<HTMLCanvasElement[]>([]);
  const cancelledRef = useRef(false);

  // Background cache build — runs once per document.
  useEffect(() => {
    cancelledRef.current = false;
    let localCancelled = false;

    if (!mergedBytes) {
      setPhase('error');
      return;
    }

    (async () => {
      try {
        setPhase('loading');
        const pdfjsLib = await getPdfjsLib();
        if (localCancelled) return;

        // Swap the parsed doc when the underlying bytes changed.
        if (!docRef.current || bytesKeyRef.current !== mergedBytes) {
          if (docRef.current) {
            try {
              await docRef.current.destroy();
            } catch {
              /* noop */
            }
          }
          docRef.current = await pdfjsLib.getDocument({ data: mergedBytes.slice() }).promise;
          bytesKeyRef.current = mergedBytes;
          pageCanvasesRef.current.forEach((c) => { c.width = 0; c.height = 0; });
          pageCanvasesRef.current = [];
        }
        const doc = docRef.current;
        const want = Math.min(CACHE_PAGES, Math.min(totalPages, doc.numPages));

        // Render sequentially, yielding between pages to keep input smooth.
        for (let i = 0; i < want; i++) {
          if (localCancelled || cancelledRef.current) return;
          if (pageCanvasesRef.current[i]) continue; // already cached
          const page = await doc.getPage(i + 1);
          if (localCancelled || cancelledRef.current) return;
          const vp1 = page.getViewport({ scale: 1 });
          // Longest side ~720px → crisp enough at 2x DPR for any grid size.
          const scale = Math.min(1.25, 720 / Math.max(vp1.width, vp1.height));
          const viewport = page.getViewport({ scale });
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.ceil(viewport.width));
          c.height = Math.max(1, Math.ceil(viewport.height));
          const ctx = c.getContext('2d');
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (localCancelled || cancelledRef.current) {
            c.width = 0; c.height = 0;
            return;
          }
          pageCanvasesRef.current[i] = c;
          setCachedCount(pageCanvasesRef.current.filter(Boolean).length);
          if (i % 3 === 2) await new Promise((r) => setTimeout(r, 0));
        }
        if (!localCancelled && !cancelledRef.current) setPhase('ready');
      } catch {
        if (!localCancelled && !cancelledRef.current) setPhase('error');
      }
    })();

    return () => {
      localCancelled = true;
      cancelledRef.current = true;
    };
  }, [mergedBytes, totalPages]);

  // Destroy the pdf.js doc when leaving the step/tool.
  useEffect(
    () => () => {
      if (docRef.current) {
        try {
          void docRef.current.destroy();
        } catch {
          /* noop */
        }
      }
      docRef.current = null;
      bytesKeyRef.current = null;
      pageCanvasesRef.current.forEach((c) => { c.width = 0; c.height = 0; });
      pageCanvasesRef.current = [];
    },
    [],
  );

  const viewableSheets = useMemo(() => {
    const plan = planSheet(opts);
    const covered = Math.min(totalPages, cachedCount);
    return covered > 0 ? Math.ceil(covered / plan.perSheet) : 0;
  }, [opts, totalPages, cachedCount]);

  // Synchronous compose from cache — runs on every option/sheet change.
  useEffect(() => {
    if (phase !== 'ready') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const plan = planSheet(opts);
    const { w: paperW, h: paperH } = nupPaperSize(opts.paper, opts.orientation);

    // Display factor: sheet fits its box (~320px wide) with 2x headroom.
    const k = Math.min(660 / paperW, 920 / paperH);
    canvas.width = Math.round(paperW * k);
    canvas.height = Math.round(paperH * k);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const startIdx = sheetIdx * plan.perSheet;
    for (let slot = 0; slot < plan.perSheet; slot++) {
      const srcIdx = startIdx + slot;
      if (srcIdx >= totalPages) break;
      const src = pageCanvasesRef.current[srcIdx];
      // Preview canvas is top-left origin, but cellRect is PDF bottom-left.
      // Use top-based y for canvas: marginTop + row*(cellH+gap)
      const col = slot % plan.cols;
      const row = Math.floor(slot / plan.cols);
      const canvasCellY = plan.marginTop + row * (plan.cellH + plan.gapY);
      const canvasCell = { x: plan.marginLeft + col * (plan.cellW + plan.gapX), y: canvasCellY, w: plan.cellW, h: plan.cellH };
      if (opts.borders) {
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 1;
        ctx.strokeRect(canvasCell.x * k, canvasCell.y * k, canvasCell.w * k, canvasCell.h * k);
      }
      if (!src) continue; // beyond cache → border-only ghost cell
      const effW = src.width;
      const effH = src.height;
      const fit = fitInto(effW / 72, effH / 72, canvasCell);
      ctx.drawImage(src, fit.x * k, fit.y * k, fit.w * k, fit.h * k);
      if (opts.numbers) {
        ctx.fillStyle = '#6b7280';
        ctx.font = `${Math.max(8, Math.round(9 * k))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(String(srcIdx + 1), (canvasCell.x + canvasCell.w / 2) * k, (canvasCell.y + canvasCell.h - 3) * k);
      }
    }
  }, [phase, opts, sheetIdx, totalPages]);

  // Clamp sheet index when the format shrinks coverage.
  useEffect(() => {
    setSheetIdx((i) => (viewableSheets ? Math.min(i, viewableSheets - 1) : 0));
  }, [viewableSheets]);

  if (!mergedBytes || phase === 'error') {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-elevated/70 bg-surface-2/40 p-6 text-center">
        <TriangleAlert className="h-5 w-5 text-warning" aria-hidden="true" />
        <p className="text-xs font-semibold text-ink-muted">Live preview unavailable here — Generate always works.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative w-full">
        {/* Shimmer skeleton while the first pages render */}
        <div
          aria-hidden={phase === 'ready'}
          className={`flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl border border-elevated/50 bg-surface-2/50 ${phase === 'ready' ? 'hidden' : 'block'}`}
        >
          <div className="h-full w-full max-w-[300px] animate-pulse rounded-lg bg-elevated/70 p-3">
            <div className="h-full w-full rounded-md bg-surface-2/80" />
          </div>
          <p className="pb-2 text-[11px] font-semibold tabular-nums text-ink-faint">
            Preparing preview… {Math.round((cachedCount / Math.max(1, Math.min(CACHE_PAGES, totalPages))) * 100)}%
          </p>
        </div>

        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Real N-up preview, sheet ${sheetIdx + 1}`}
          className={`mx-auto block h-auto w-full max-w-[320px] rounded-xl border border-elevated/50 bg-white shadow-inner ${phase === 'ready' ? 'block' : 'hidden'}`}
        />
      </div>

      {/* Sheet navigation — bounded by cached coverage */}
      {phase === 'ready' && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setSheetIdx((i) => Math.max(0, i - 1))}
            disabled={sheetIdx === 0}
            aria-label="Previous sheet"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-elevated bg-surface text-ink-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="min-w-[92px] text-center text-xs font-bold tabular-nums text-ink-muted">
            Sheet {sheetIdx + 1} / {viewableSheets}
          </span>
          <button
            type="button"
            onClick={() => setSheetIdx((i) => Math.min(viewableSheets - 1, i + 1))}
            disabled={sheetIdx >= viewableSheets - 1}
            aria-label="Next sheet"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-elevated bg-surface text-ink-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
      {phase === 'ready' && totalPages > cachedCount && (
        <p className="text-center text-[11px] leading-snug text-ink-faint">
          Preview covers the first {Math.min(CACHE_PAGES, totalPages)} pages · Generate builds all {totalPages}.
        </p>
      )}
    </div>
  );
};
