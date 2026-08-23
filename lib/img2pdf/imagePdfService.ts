/**
 * ImagePdfService — packs pictures into a single PDF via pdf-lib.
 *
 * JPEG and PNG embed natively. Anything else (WebP etc.) falls back to a
 * canvas re-encode as high-quality JPEG first — pdf-lib has no WebP codec.
 * A4 mode contain-fits each image centred with auto orientation; Fit mode
 * sizes the page to the image at 144 DPI (pt = px / 2).
 */

import { PDFDocument } from 'pdf-lib';
import type { ImageItem, ImagePageMode } from './imagePdfReducer';

const A4_PORTRAIT: [number, number] = [595.28, 841.89];
const MARGIN_PT = 24;
const FIT_DPI_SCALE = 1 / 2; // 144 DPI

export function isLikelyImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

function kindOf(file: File): ImageItem['kind'] {
  const t = file.type.toLowerCase();
  if (t === 'image/jpeg' || /\.jpe?g$/i.test(file.name)) return 'jpeg';
  if (t === 'image/png' || /\.png$/i.test(file.name)) return 'png';
  return 'convert';
}

export { kindOf };

/** Blob -> bytes with a FileReader fallback for environments without blob.arrayBuffer(). */
async function blobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer());
  }
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result as ArrayBuffer));
    fr.onerror = () => reject(new Error('Failed to read image data.'));
    fr.readAsArrayBuffer(blob);
  });
}

/** Canvas fallback for codecs pdf-lib cannot embed directly (WebP …). */
async function toJpegBytes(blob: Blob): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('This image format is not supported on this device.');
  }
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This image format is not supported on this device.');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const jpegBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b && b.size > 0 ? resolve(b) : reject(new Error('Failed to encode image.'))),
      'image/jpeg',
      0.92,
    );
  });
  return new Uint8Array(await jpegBlob.arrayBuffer());
}

export class ImagePdfService {
  /** Builds the PDF; progress fires per embedded image (1-based). */
  static async build(
    items: ImageItem[],
    pageMode: ImagePageMode,
    onProgress?: (done: number, total: number, label: string) => void,
    signal?: AbortSignal,
  ): Promise<{ bytes: Uint8Array; pages: number }> {
    const out = await PDFDocument.create();

    for (let i = 0; i < items.length; i++) {
      if (signal?.aborted) throw new Error('Processing cancelled.');
      const item = items[i];
      onProgress?.(i + 1, items.length, `Embedding ${item.name}…`);

      let bytes = await blobBytes(item.blob);
      let embed = item.kind === 'png' ? () => out.embedPng(bytes) : () => out.embedJpg(bytes);
      if (item.kind === 'convert') {
        // Re-encode through canvas, then treat as JPEG.
        bytes = await toJpegBytes(item.blob);
        embed = () => out.embedJpg(bytes);
      }

      let img;
      try {
        img = await embed();
      } catch {
        // Type sniffing can lie (e.g. .jpg that is really PNG) — try the twin codec once.
        img = item.kind === 'png' ? await out.embedJpg(bytes) : await out.embedPng(bytes);
      }

      if (pageMode === 'a4') {
        const landscape = img.width > img.height;
        const [pw, ph] = landscape ? [A4_PORTRAIT[1], A4_PORTRAIT[0]] : A4_PORTRAIT;
        const page = out.addPage([pw, ph]);
        const scale = Math.min((pw - MARGIN_PT * 2) / img.width, (ph - MARGIN_PT * 2) / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
      } else {
        const page = out.addPage([img.width * FIT_DPI_SCALE, img.height * FIT_DPI_SCALE]);
        page.drawImage(img, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
      }
    }

    if (out.getPageCount() === 0) throw new Error('No images to convert.');
    return { bytes: await out.save(), pages: out.getPageCount() };
  }
}
