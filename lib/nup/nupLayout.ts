/**
 * N-up layout engine — pure geometry math + pdf-lib composition.
 *
 * Design goals (mirrors lib/optimizer/layoutEngine.ts patterns but lighter):
 *  - Pure functions, no DOM — unit-testable.
 *  - Vector-preserving: embeds source pages as PDF XObjects (no raster).
 *  - Handles page /Rotate (scans are often rotated) by transposing w/h.
 *  - One shared embed of the source doc per build (embedPdf once per sheet
 *    chunk would re-parse; we parse once and copy pages once).
 */

export type NupFormat = '1x1' | '1x2' | '2x2' | '2x3' | '3x3' | '2x4' | '2x5' | '4x4' | '3x5';
export type NupPaper = 'A4' | 'LETTER' | 'LEGAL';
export type NupOrientation = 'PORTRAIT' | 'LANDSCAPE';

export interface NupMarginsMm {
  outer: number; // all sides (printers can't print to edge)
  inner: number; // gutter between cells
}

export const NUP_FORMATS: Array<{ format: NupFormat; label: string; sub: string }> = [
  { format: '1x1', label: '1-up', sub: 'full page' },
  { format: '1x2', label: '2-up', sub: '1×2' },
  { format: '2x2', label: '4-up', sub: '2×2' },
  { format: '2x3', label: '6-up', sub: '2×3' },
  { format: '3x3', label: '9-up', sub: '3×3' },
  { format: '2x4', label: '8-up', sub: '2×4' },
  { format: '2x5', label: '10-up', sub: '2×5' },
  { format: '4x4', label: '16-up', sub: '4×4' },
  { format: '3x5', label: '15-up', sub: '3×5' },
];

/** cols × rows in portrait sheet terms. Landscape transposes. */
export function nupGrid(format: NupFormat, orientation: NupOrientation): { cols: number; rows: number } {
  const base = (() => {
    switch (format) {
      case '1x1': return { cols: 1, rows: 1 };
      // 2-up: two side-by-side on portrait reads like a book spread
      case '1x2': return { cols: 2, rows: 1 };
      case '2x2': return { cols: 2, rows: 2 };
      case '2x3': return { cols: 2, rows: 3 };
      case '3x3': return { cols: 3, rows: 3 };
      case '2x4': return { cols: 2, rows: 4 };
      case '2x5': return { cols: 2, rows: 5 };
      case '4x4': return { cols: 4, rows: 4 };
      case '3x5': return { cols: 3, rows: 5 };
    }
  })();
  if (orientation === 'LANDSCAPE' && base.cols !== base.rows) {
    // transpose so cells stay content-shaped on wide paper (mirrors LayoutEngine)
    return { cols: base.rows, rows: base.cols };
  }
  return base;
}

/** Sheet size in PDF points (72/inch). */
export function nupPaperSize(paper: NupPaper, orientation: NupOrientation): { w: number; h: number } {
  let wIn: number, hIn: number;
  if (paper === 'A4') { wIn = 8.27; hIn = 11.69; }
  else if (paper === 'LETTER') { wIn = 8.5; hIn = 11.0; }
  else { wIn = 8.5; hIn = 14.0; }
  if (orientation === 'LANDSCAPE') [wIn, hIn] = [hIn, wIn];
  return { w: Math.round(wIn * 72), h: Math.round(hIn * 72) };
}

export interface NupCellGeometry {
  x: number;
  y: number; // bottom-left, PDF space
  w: number;
  h: number;
}

export interface NupSheetPlan {
  cols: number;
  rows: number;
  perSheet: number;
  cellW: number;
  cellH: number;
  gapX: number; // inner margin horizontal (pt)
  gapY: number; // inner margin vertical (pt)
  marginTop: number;
  marginLeft: number;
  marginRight: number;
  marginBottom: number;
}

export interface NupOptions {
  format: NupFormat;
  paper: NupPaper;
  orientation: NupOrientation;
  margins: NupMarginsMm; // mm → pt via ×2.8346
  borders: boolean;
  numbers: boolean;
}

const MM_TO_PT = 72 / 25.4;

export function planSheet(opts: NupOptions): NupSheetPlan {
  const { cols, rows } = nupGrid(opts.format, opts.orientation);
  const { w, h } = nupPaperSize(opts.paper, opts.orientation);
  const outer = opts.margins.outer * MM_TO_PT;
  const inner = opts.margins.inner * MM_TO_PT;
  const footerH = opts.numbers ? 14 : 0;
  const cellW = (w - outer * 2 - inner * (cols - 1)) / cols;
  const cellH = (h - outer * 2 - inner * (rows - 1) - footerH) / rows;
  return {
    cols,
    rows,
    perSheet: cols * rows,
    cellW,
    cellH,
    gapX: inner,
    gapY: inner,
    marginTop: outer,
    marginLeft: outer,
    marginRight: outer,
    marginBottom: outer + footerH,
  };
}

/** Cell rect for slot idx (0-based, row-major from top-left). */
export function cellRect(plan: NupSheetPlan, idx: number, sheetH: number): NupCellGeometry {
  const col = idx % plan.cols;
  const row = Math.floor(idx / plan.cols);
  const x = plan.marginLeft + col * (plan.cellW + plan.gapX);
  const topOffset = plan.marginTop + row * (plan.cellH + plan.gapY);
  const y = sheetH - topOffset - plan.cellH; // flip to PDF bottom-left space
  return { x, y, w: plan.cellW, h: plan.cellH };
}

/** Fit source box into cell box, centered (letterbox). Returns draw rect. */
export function fitInto(srcW: number, srcH: number, cell: NupCellGeometry): { x: number; y: number; w: number; h: number } {
  const scale = Math.min(cell.w / srcW, cell.h / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: cell.x + (cell.w - w) / 2, y: cell.y + (cell.h - h) / 2, w, h };
}

export function totalSheetsFor(pageCount: number, perSheet: number): number {
  return Math.max(1, Math.ceil(pageCount / perSheet));
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
