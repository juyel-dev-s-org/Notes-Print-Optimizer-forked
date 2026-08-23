/**
 * imagesConverter — renders every PDF page to an image blob, on-device.
 *
 * Same disciplined loop as EnhanceProcessor: fresh buffer copy per run
 * (pdf.js detaches what it is handed), pooled canvases, cooperative
 * yielding between pages and AbortSignal cancellation. Adds a small
 * thumbnail capture so the result screen never needs a second render.
 */

import { getPdfjsLib } from '@/lib/optimizer/pdfjsLoader';
import { memoryManager } from '@/lib/optimizer/memoryManager';

const THUMB_EDGE = 120;

export type ImageFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export const FORMAT_EXT: Record<ImageFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface ImageConvertOptions {
  dpi: number;
  format: ImageFormat;
  /** JPEG/WebP quality 0.5–1.0 (ignored for PNG). */
  quality: number;
  /** 1-based inclusive page window; defaults to every page. */
  fromPage?: number;
  toPage?: number;
}

export interface PageImageResult {
  index: number;
  blob: Blob;
  thumbDataUrl: string;
}

function canvasToBlob(canvas: HTMLCanvasElement, format: ImageFormat, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size === 0) {
          reject(new Error('Failed to encode page image.'));
          return;
        }
        resolve(blob);
      },
      format,
      format === 'image/png' ? undefined : quality,
    );
  });
}

/** Small always-in-memory preview for the result strip. */
function captureThumb(source: HTMLCanvasElement): string {
  const scale = Math.min(1, THUMB_EDGE / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const thumb = document.createElement('canvas');
  thumb.width = w;
  thumb.height = h;
  const ctx = thumb.getContext('2d');
  ctx?.drawImage(source, 0, 0, w, h);
  return thumb.toDataURL('image/jpeg', 0.7);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('Processing cancelled.');
}

export class ImagesConverter {
  /** Page count without rendering anything. */
  static async countPages(bytes: Uint8Array): Promise<number> {
    const pdfjsLib = await getPdfjsLib();
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
    const pages = doc.numPages;
    await doc.destroy();
    return pages;
  }

  static async convert(
    bytes: Uint8Array,
    options: ImageConvertOptions,
    onPage: (page: PageImageResult) => void,
    signal?: AbortSignal,
  ): Promise<number> {
    const pdfjsLib = await getPdfjsLib();
    const scale = options.dpi / 72;
    const task = pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) });
    const doc = await task.promise;
    const first = Math.max(1, options.fromPage ?? 1);
    const last = Math.min(doc.numPages, options.toPage ?? doc.numPages);

    try {
      for (let p = first; p <= last; p++) {
        throwIfAborted(signal);
        const page = await doc.getPage(p);
        throwIfAborted(signal);
        const viewport = page.getViewport({ scale });
        const vw = Math.max(1, Math.floor(viewport.width));
        const vh = Math.max(1, Math.floor(viewport.height));

        const canvas = memoryManager.acquireCanvas(vw, vh);
        const ctx = canvas.getContext('2d', { willReadFrequently: false })!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        throwIfAborted(signal);

        const thumbDataUrl = captureThumb(canvas);
        const blob = await canvasToBlob(canvas, options.format, options.quality);
        memoryManager.disposeCanvas(canvas);

        onPage({ index: p - 1, blob, thumbDataUrl });
        await memoryManager.yieldToUI();
      }
    } finally {
      await doc.destroy().catch(() => undefined);
    }

    return last - first + 1;
  }
}
