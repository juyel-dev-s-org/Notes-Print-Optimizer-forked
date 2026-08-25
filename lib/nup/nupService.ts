/**
 * N-up PDF service — lazy-loaded pdf-lib operations.
 *
 * Why: the tool shell (upload screen) should not pay for pdf-lib parse.
 * Dependencies load on first actual use (Continue/Merge click or generate),
 * promise-deduplicated exactly like lib/optimizer/pdfjsLoader.ts.
 */

import type { NupOptions } from './nupLayout';
import { cellRect, fitInto, nupPaperSize, planSheet, totalSheetsFor } from './nupLayout';

type PdfLib = typeof import('pdf-lib');

let depsPromise: Promise<PdfLib> | null = null;

/** Lazily import pdf-lib once; concurrent callers share the promise. */
export function loadNupDeps(): Promise<PdfLib> {
  if (!depsPromise) {
    depsPromise = import('pdf-lib');
  }
  return depsPromise;
}

/** One uploaded file as the service sees it (bytes kept outside React state churn). */
export interface NupSourceFile {
  id: string;
  name: string;
  bytes: Uint8Array;
}

/** Merge many PDFs in order; a single file passes through untouched (no re-parse). */
export async function mergeBytes(files: NupSourceFile[]): Promise<{ bytes: Uint8Array; pages: number }> {
  if (files.length === 1) return { bytes: files[0].bytes, pages: await quickCount(files[0].bytes) };
  const { PDFDocument } = await loadNupDeps();
  const out = await PDFDocument.create();
  for (const f of files) {
    const src = await PDFDocument.load(f.bytes.slice(), { ignoreEncryption: true });
    const copied = await out.copyPages(src, src.getPageIndices());
    copied.forEach((p) => out.addPage(p));
  }
  return { bytes: await out.save({ useObjectStreams: false }), pages: out.getPageCount() };
}

async function quickCount(bytes: Uint8Array): Promise<number> {
  const { PDFDocument } = await loadNupDeps();
  const doc = await PDFDocument.load(bytes.slice(), { ignoreEncryption: true });
  return doc.getPageCount();
}

export interface BuildResult {
  blob: Blob;
  sheets: number;
  ms: number;
}

/**
 * Build the N-up document — vector-preserving, rotation-aware.
 * Perf: source parsed ONCE, every page embedded ONCE via one batch embedPages,
 * then drawn per sheet. Yields to the UI thread every few sheets.
 */
export async function buildNup(
  inputBytes: Uint8Array,
  opts: NupOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<BuildResult> {
  const t0 = performance.now();
  const { PDFDocument, rgb, StandardFonts } = await loadNupDeps();

  const plan = planSheet(opts);
  const { w: paperW, h: paperH } = nupPaperSize(opts.paper, opts.orientation);

  const srcDoc = await PDFDocument.load(inputBytes.slice(), { ignoreEncryption: true });
  const srcPages = srcDoc.getPages();

  // Effective size honors /Rotate (90/270 swap w/h).
  const effSizes = srcPages.map((p) => {
    const { width, height } = p.getSize();
    const rot = ((p.getRotation().angle % 360) + 360) % 360;
    return rot === 90 || rot === 270 ? { width: height, height: width } : { width, height };
  });

  // Rotation matrices so rotated scans land upright when embedded.
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const embeddedAll = await out.embedPages(
    srcPages,
    undefined,
    srcPages.map((p) => {
      const rot = ((p.getRotation().angle % 360) + 360) % 360;
      if (rot === 90) return [0, 0, 1, 0, 0, 1] as [number, number, number, number, number, number];
      if (rot === 270) return [0, -1, 1, 0, 0, 0] as [number, number, number, number, number, number];
      return undefined;
    }),
  );

  const sheets = totalSheetsFor(srcPages.length, plan.perSheet);
  const borderGray = rgb(0.82, 0.84, 0.88);
  const numGray = rgb(0.42, 0.47, 0.55);

  for (let si = 0; si < sheets; si++) {
    if (onProgress && (si % 4 === 0 || si === sheets - 1)) onProgress(si + 1, sheets);
    const page = out.addPage([paperW, paperH]);
    const startIdx = si * plan.perSheet;
    for (let k = 0; k < plan.perSheet; k++) {
      const srcIdx = startIdx + k;
      if (srcIdx >= srcPages.length) break;
      const cell = cellRect(plan, k, paperH);
      const emb = embeddedAll[srcIdx];
      const eff = effSizes[srcIdx];
      const fit = fitInto(eff.width, eff.height, cell);
      page.drawPage(emb, { x: fit.x, y: fit.y, width: fit.w, height: fit.h });
      if (opts.borders) {
        page.drawRectangle({
          x: cell.x, y: cell.y, width: cell.w, height: cell.h,
          borderWidth: 0.6, borderColor: borderGray,
        });
      }
      if (opts.numbers) {
        const label = String(srcIdx + 1);
        const size = Math.min(9, Math.max(6, plan.cellW * 0.03));
        const tw = font.widthOfTextAtSize(label, size);
        page.drawText(label, { x: cell.x + (cell.w - tw) / 2, y: cell.y + 3.5, size, font, color: numGray });
      }
    }
    if (onProgress && si % 4 === 3) await new Promise((r) => setTimeout(r, 0));
  }

  const bytes = await out.save({ useObjectStreams: false });
  return {
    blob: new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
    sheets,
    ms: Math.round(performance.now() - t0),
  };
}
