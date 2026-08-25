'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { getPdfjsLib } from '@/lib/optimizer/pdfjsLoader';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { cellRect, fitInto, nupPaperSize, planSheet, type NupOptions } from '@/lib/nup/nupLayout';

export interface HoldToPreviewProps {
  /** Merged source PDF bytes (transferred copy is made internally). */
  mergedBytes: Uint8Array | null;
  /** Current layout options — a fresh hold always renders with latest. */
  opts: NupOptions;
  pageCount: number;
}

type Phase = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Press-and-hold real preview: while held, sheet 1 of the actual N-up
 * composition is rasterized with pdf.js at screen scale — same geometry
 * (planSheet/cellRect/fitInto) as the vector export, so what you see is
 * what prints. pdf.js loads lazily on first hold and the parsed document
 * is cached for subsequent holds.
 */
export const HoldToPreview: React.FC<HoldToPreviewProps> = ({ mergedBytes, opts, pageCount }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const bytesRef = useRef<Uint8Array | null>(null);
  const tmpCanvasesRef = useRef<HTMLCanvasElement[]>([]);
  const holdingRef = useRef(false);

  // Destroy cached document on unmount or when bytes change underneath us.
  useEffect(
    () => () => {
      holdingRef.current = false;
      if (docRef.current) {
        try {
          void docRef.current.destroy();
        } catch {
          /* noop */
        }
      }
      docRef.current = null;
      bytesRef.current = null;
    },
    [],
  );

  const releaseTmpCanvases = useCallback(() => {
    for (const c of tmpCanvasesRef.current) {
      c.width = 0;
      c.height = 0;
    }
    tmpCanvasesRef.current = [];
  }, []);

  const release = useCallback(() => {
    holdingRef.current = false;
    setPhase('idle');
  }, []);

  const renderSheet = useCallback(
    async (doc: PDFDocumentProxy) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const plan = planSheet(opts);
      const { w: paperW, h: paperH } = nupPaperSize(opts.paper, opts.orientation);

      // Screen-scale factor: target ~640px wide for crispness, capped height.
      const k = Math.min(640 / paperW, 900 / paperH);
      canvas.width = Math.round(paperW * k);
      canvas.height = Math.round(paperH * k);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const slots = Math.min(plan.perSheet, pageCount);
      for (let idx = 0; idx < slots; idx++) {
        if (!holdingRef.current) return; // released mid-render → abort quietly
        const page = await doc.getPage(idx + 1);
        // pdf.js viewports already account for /Rotate — effective size free.
        const vp1 = page.getViewport({ scale: 1 });
        const cell = cellRect(plan, idx, paperH);
        const fit = fitInto(vp1.width, vp1.height, cell);
        // Render this page at exactly the on-sheet scale × global scale.
        const pageScale = (fit.w / vp1.width) * k;
        const viewport = page.getViewport({ scale: pageScale });
        let tmp = tmpCanvasesRef.current[idx];
        if (!tmp || tmp.width !== Math.ceil(viewport.width) || tmp.height !== Math.ceil(viewport.height)) {
          tmp = document.createElement('canvas');
          tmp.width = Math.max(1, Math.ceil(viewport.width));
          tmp.height = Math.max(1, Math.ceil(viewport.height));
          tmpCanvasesRef.current[idx] = tmp;
        }
        const tctx = tmp.getContext('2d');
        if (!tctx) continue;
        await page.render({ canvasContext: tctx, viewport }).promise;
        ctx.drawImage(tmp, fit.x * k, fit.y * k, fit.w * k, fit.h * k);
        if (opts.borders) {
          ctx.strokeStyle = '#d1d5db';
          ctx.lineWidth = 1;
          ctx.strokeRect(cell.x * k, cell.y * k, cell.w * k, cell.h * k);
        }
        if (opts.numbers) {
          ctx.fillStyle = '#6b7280';
          ctx.font = `${Math.max(8, Math.round(9 * k))}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(String(idx + 1), (cell.x + cell.w / 2) * k, (cell.y + cell.h - 3) * k);
        }
      }
    },
    [opts, pageCount],
  );

  const begin = useCallback(async () => {
    if (!mergedBytes || holdingRef.current) return;
    holdingRef.current = true;
    setPhase('loading');
    try {
      const pdfjsLib = await getPdfjsLib();
      if (!holdingRef.current) return; // released while lib loaded
      if (!docRef.current || bytesRef.current !== mergedBytes) {
        if (docRef.current) {
          try {
            await docRef.current.destroy();
          } catch {
            /* noop */
          }
        }
        docRef.current = await pdfjsLib.getDocument({ data: mergedBytes.slice() }).promise;
        bytesRef.current = mergedBytes;
      }
      releaseTmpCanvases();
      await renderSheet(docRef.current);
      if (holdingRef.current) setPhase('ready');
    } catch {
      if (holdingRef.current) setPhase('error');
    }
  }, [mergedBytes, renderSheet, releaseTmpCanvases]);

  const disabled = !mergedBytes;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-full">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Real N-up sheet preview"
          className={`mx-auto block h-auto w-full max-w-[320px] rounded-xl border border-elevated/50 bg-white shadow-inner transition-opacity duration-200 ${phase === 'ready' ? 'opacity-100' : 'pointer-events-none opacity-0 absolute inset-0'}`}
        />
        {phase !== 'ready' && (
          <div className="flex aspect-[3/4] max-h-[420px] w-full max-w-[320px] flex-col items-center justify-center gap-2 self-center rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-center mx-auto">
            {phase === 'loading' ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-primary-soft" aria-hidden="true" />
                <p className="text-xs font-bold text-ink-muted">Rendering real pages…</p>
              </>
            ) : phase === 'error' ? (
              <p className="text-xs font-semibold text-danger">Preview failed — try Generate.</p>
            ) : (
              <>
                <Eye className="h-6 w-6 text-primary-soft" aria-hidden="true" />
                <p className="max-w-[24ch] text-xs leading-relaxed text-ink-muted">
                  {disabled ? 'Add files first — then hold to see your real pages here.' : 'Press and hold the button below to see your actual PDF pages in this sheet.'}
                </p>
              </>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        disabled={disabled}
        onPointerDown={() => void begin()}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
            e.preventDefault();
            void begin();
          }
        }}
        onKeyUp={release}
        aria-pressed={phase === 'ready'}
        className="inline-flex h-10 select-none items-center justify-center gap-2 rounded-full border border-primary/30 bg-surface px-5 text-sm font-bold text-primary-soft shadow-sm transition active:bg-primary-faint disabled:opacity-40"
        title="Hold to render your real pages into this sheet"
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
        {phase === 'loading' ? 'Rendering…' : phase === 'ready' ? 'Keep holding…' : 'Hold to see real pages'}
      </button>
      <p className="text-center text-[11px] leading-snug text-ink-faint">Renders on demand with pdf.js — nothing extra loads until you hold.</p>
    </div>
  );
};
