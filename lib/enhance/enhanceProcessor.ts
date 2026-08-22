/**
 * enhanceProcessor — renders PDF pages and runs the enhance pipeline.
 *
 * Sequential, main-thread, with cooperative yielding between pages so the
 * mobile UI stays responsive. Cancellable via AbortSignal. All processing is
 * local (pdf.js render + typed-array kernels + canvas JPEG encode).
 */

import { getPdfjsLib } from '@/lib/optimizer/pdfjsLoader';
import { memoryManager } from '@/lib/optimizer/memoryManager';
import { enhanceImageData } from './enhanceKernels';
import type { EnhancePageResult, EnhanceSettings } from './types';
import type { UploadedPdfItem } from '@/lib/workflow/types';

/** Render scale: 120 DPI (120/72 ≈ 1.67×) — print-safe detail without phone OOM. */
const RENDER_SCALE = 120 / 72;
const JPEG_QUALITY = 0.92;

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('Processing cancelled.');
}

function canvasToDataUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((res, rej) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size === 0) {
          rej(new Error('Failed to encode page image.'));
          return;
        }
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.onerror = () => rej(new Error('Failed to encode page image.'));
        fr.readAsDataURL(blob);
      },
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

export interface EnhanceJobProgress {
  current: number;
  total: number;
  phase: string;
}

export class EnhanceProcessor {
  /**
   * Processes every page of every uploaded file sequentially.
   * `onProgress` is invoked per page; `signal` cancels between pages.
   * Throws an Error (with a user-friendly message) on failure/cancel.
   */
  public static async process(
    items: UploadedPdfItem[],
    settings: EnhanceSettings,
    onProgress: (p: EnhanceJobProgress) => void,
    signal?: AbortSignal,
  ): Promise<EnhancePageResult[]> {
    const pdfjsLib = await getPdfjsLib();
    const results: EnhancePageResult[] = [];
    let totalPages = 0;

    const docs = [];
    for (const item of items) {
      // pdf.js transfers buffer ownership to its worker, detaching it on the
      // main thread. Slice a private copy per run so Apply & Re-Enhance can
      // safely reuse item.arrayBuffer (same guard as the main pipeline).
      const task = pdfjsLib.getDocument({ data: new Uint8Array(item.arrayBuffer.slice(0)) });
      const doc = await task.promise;
      docs.push({ item, doc });
      totalPages += doc.numPages;
    }

    if (totalPages === 0) throw new Error('No pages found in the selected PDFs.');

    let done = 0;
    try {
      for (const { item, doc } of docs) {
        for (let p = 1; p <= doc.numPages; p++) {
          throwIfAborted(signal);
          onProgress({ current: done, total: totalPages, phase: `${item.name} · page ${p}/${doc.numPages}` });

          const page = await doc.getPage(p);
          throwIfAborted(signal);
          const viewport = page.getViewport({ scale: RENDER_SCALE });
          const vw = Math.max(1, Math.floor(viewport.width));
          const vh = Math.max(1, Math.floor(viewport.height));
          const canvas = memoryManager.acquireCanvas(vw, vh);
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
          await page.render({ canvasContext: ctx, viewport }).promise;
          throwIfAborted(signal);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const enhanced = enhanceImageData(imageData, settings);
          throwIfAborted(signal);

          const originalDataUrl = await canvasToDataUrl(canvas);
          throwIfAborted(signal);
          const outCanvas = memoryManager.acquireCanvas(vw, vh);
          const outCtx = outCanvas.getContext('2d')!;
          outCtx.putImageData(enhanced, 0, 0);
          const dataUrl = await canvasToDataUrl(outCanvas);
          throwIfAborted(signal);

          memoryManager.disposeCanvas(canvas);
          memoryManager.disposeCanvas(outCanvas);

          results.push({ index: results.length, width: vw, height: vh, dataUrl, originalDataUrl });
          done++;
          await memoryManager.yieldToUI();
        }
        await doc.destroy();
      }
    } catch (err) {
      for (const { doc } of docs) { try { await doc.destroy(); } catch { /* noop */ } }
      throw err;
    }

    return results;
  }
}