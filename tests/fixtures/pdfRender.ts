/**
 * Node PDF renderer for fixture tests.
 *
 * Renders PDF pages to ImageData using pdfjs-dist (legacy build, main-thread
 * software rendering) with an @napi-rs/canvas factory — no browser needed.
 * Rendering is deterministic for a fixed pdfjs version + input bytes.
 *
 * Standard fonts (Helvetica etc.): pdfjs's Node build reads font files with
 * fs.promises.readFile directly, so standardFontDataUrl is a local path into
 * node_modules/pdfjs-dist/standard_fonts/ (no HTTP server needed).
 *
 * Callers that render several pages of one document should use
 * openPdfDocument() once and renderPdfPageOpen() per page — getDocument()
 * re-parses the whole PDF on every call.
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import { join, sep as pathSep } from 'path';

const STANDARD_FONTS_DIR =
  join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts') + pathSep;

export interface OpenPdfPage {
  getViewport(opts: { scale: number }): { width: number; height: number };
  render(opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> };
  cleanup(): void;
}

export interface OpenPdfDoc {
  numPages: number;
  getPage(n: number): Promise<OpenPdfPage>;
  destroy(): Promise<void>;
}

interface RenderSurface {
  canvas: { width: number; height: number };
  context: { getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray } };
}

const FACTORY = {
  create(w: number, h: number): RenderSurface {
    const canvas = createCanvas(w, h);
    return { canvas, context: canvas.getContext('2d') as unknown as RenderSurface['context'] };
  },
  reset(c: RenderSurface, w: number, h: number) {
    c.canvas.width = w;
    c.canvas.height = h;
  },
  destroy(c: RenderSurface) {
    c.canvas.width = 0;
    c.canvas.height = 0;
    c.context = { getImageData: () => ({ data: new Uint8ClampedArray(0) }) };
  },
};

/* getDocument() transfers (detaches) data.buffer, so callers can reuse the
   same bytes across calls — copy defensively. */
function copyBytes(pdfBytes: Uint8Array): Uint8Array {
  return pdfBytes.byteOffset === 0 && pdfBytes.byteLength === pdfBytes.buffer.byteLength
    ? new Uint8Array(pdfBytes)
    : new Uint8Array(pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength));
}

export async function openPdfDocument(pdfBytes: Uint8Array): Promise<OpenPdfDoc> {
  const doc = await pdfjs.getDocument({
    data: copyBytes(pdfBytes),
    standardFontDataUrl: STANDARD_FONTS_DIR,
  }).promise;
  return doc as unknown as OpenPdfDoc;
}

export async function renderPdfPageOpen(doc: OpenPdfDoc, pageIndex: number, scale: number): Promise<ImageData> {
  const page = await doc.getPage(pageIndex + 1);
  try {
    const viewport = page.getViewport({ scale });
    const vw = Math.ceil(viewport.width);
    const vh = Math.ceil(viewport.height);
    const c = FACTORY.create(vw, vh);
    await page.render({
      canvasContext: c.context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    const raw = c.context!.getImageData(0, 0, vw, vh);
    /* @napi-rs/canvas ImageData lacks the DOM `colorSpace` field — rebuild
       a DOM-shaped ImageData (global is polyfilled in Node/vitest). */
    const imageData = new ImageData(new Uint8ClampedArray(raw.data), vw, vh);
    FACTORY.destroy(c);
    return imageData;
  } finally {
    page.cleanup();
  }
}

export async function renderPdfPage(
  pdfBytes: Uint8Array,
  pageIndex: number,
  scale: number
): Promise<ImageData> {
  const doc = await openPdfDocument(pdfBytes);
  try {
    return await renderPdfPageOpen(doc, pageIndex, scale);
  } finally {
    await doc.destroy();
  }
}