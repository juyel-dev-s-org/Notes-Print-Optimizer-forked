'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  FileText,
  Trash2,
  Upload,
  Download,
  RotateCcw,
  Check,
  Grid2x2Check,
  Loader2,
} from 'lucide-react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  NUP_FORMATS,
  cellRect,
  fitInto,
  fmtBytes,
  nupGrid,
  nupPaperSize,
  planSheet,
  totalSheetsFor,
  type NupFormat,
  type NupOptions,
  type NupOrientation,
  type NupPaper,
} from '@/lib/nup/nupLayout';

export interface NupToolViewProps {
  onBack: () => void;
}

type Step = 'upload' | 'layout' | 'done';

interface Uploaded {
  id: string;
  file: File;
  bytes: Uint8Array;
  pages: number;
  /** First page aspect (w/h) for the mini page-icon. */
  aspect: number;
}

interface BuildResult {
  blob: Blob;
  sheets: number;
  ms: number;
}

/** Merge many PDFs (or pass single through) — one parse per source. */
async function mergeBytes(files: Uploaded[]): Promise<{ bytes: Uint8Array; pages: number }> {
  if (files.length === 1) return { bytes: files[0].bytes, pages: files[0].pages };
  const out = await PDFDocument.create();
  for (const f of files) {
    const src = await PDFDocument.load(f.bytes.slice(), { ignoreEncryption: true });
    const copied = await out.copyPages(src, src.getPageIndices());
    copied.forEach((p) => out.addPage(p));
  }
  return { bytes: await out.save({ useObjectStreams: false }), pages: out.getPageCount() };
}

/**
 * Build the N-up document.
 * Perf notes:
 *  - Source doc parsed ONCE; every source page embedded ONCE via embedPages
 *    in a single batch (old code re-parsed bytes per sheet → O(sheets × parse)).
 *  - drawPage is vector — no raster, no canvas, no worker needed.
 *  - Rotation-aware: /Rotate 90/270 transposes the effective page size and
 *    draws with an extra rotation matrix so scans land upright.
 */
async function buildNup(inputBytes: Uint8Array, opts: NupOptions, onProgress?: (done: number, total: number) => void): Promise<BuildResult> {
  const t0 = performance.now();
  const plan = planSheet(opts);
  const { w: paperW, h: paperH } = nupPaperSize(opts.paper, opts.orientation);
  const srcDoc = await PDFDocument.load(inputBytes.slice(), { ignoreEncryption: true });
  const srcPages = srcDoc.getPages();

  // Effective size honors /Rotate (90/270 swaps w/h).
  const effSizes = srcPages.map((p) => {
    const { width, height } = p.getSize();
    const rot = ((p.getRotation().angle % 360) + 360) % 360;
    return rot === 90 || rot === 270 ? { width: height, height: width } : { width, height };
  });

  // Batch-embed ALL pages once (pdf-lib copies objects once, shared refs reused).
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const embeddedAll = await out.embedPages(
    srcPages.map((p) => p),
    undefined,
    srcPages.map((p) => {
      const rot = ((p.getRotation().angle % 360) + 360) % 360;
      if (rot === 90) return [0, 0, 1, 0, 0, 1] as [number, number, number, number, number, number];
      if (rot === 270) return [0, -1, 1, 0, 0, 0] as [number, number, number, number, number, number];
      return undefined;
    })
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
        page.drawText(label, {
          x: cell.x + (cell.w - tw) / 2,
          y: cell.y + 3.5,
          size,
          font,
          color: numGray,
        });
      }
    }
    if (onProgress && si % 4 === 3) await new Promise((r) => setTimeout(r, 0)); // yield to UI
  }

  const bytes = await out.save({ useObjectStreams: false });
  return {
    blob: new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
    sheets,
    ms: Math.round(performance.now() - t0),
  };
}

const PAPER_MM = { A4: [210, 297], LETTER: [216, 279], LEGAL: [216, 356] } as const;

/** Live SVG mini-preview of one sheet — true geometry, not a fake grid. */
const SheetPreview: React.FC<{ opts: NupOptions; pageCount: number }> = ({ opts, pageCount }) => {
  const plan = planSheet(opts);
  const { w, h } = nupPaperSize(opts.paper, opts.orientation);
  const vbW = 240;
  const vbH = (h / w) * vbW;
  const sx = vbW / w;
  const sy = vbH / h;
  const shown = Math.min(plan.perSheet, pageCount);
  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} className="w-full" role="img" aria-label={`Sheet preview ${opts.format}`}>
      <rect x={0} y={0} width={vbW} height={vbH} rx={4} className="fill-white stroke-slate-200" strokeWidth={1} />
      {Array.from({ length: shown }).map((_, i) => {
        const c = cellRect(plan, i, h);
        const x = c.x * sx;
        const y = c.y * sy;
        const cw = c.w * sx;
        const ch = c.h * sy;
        // letterbox inner rect mimics a portrait-ish content box
        const ar = 0.75; // typical slide/page aspect
        let iw = cw * 0.92;
        let ih = iw / ar;
        if (ih > ch * 0.94) { ih = ch * 0.94; iw = ih * ar; }
        return (
          <g key={i}>
            {opts.borders && <rect x={x} y={y} width={cw} height={ch} className="fill-none stroke-slate-300" strokeWidth={0.7} />}
            <rect x={x + (cw - iw) / 2} y={y + (ch - ih) / 2} width={iw} height={ih} rx={1.5} className="fill-indigo-50 stroke-indigo-200" strokeWidth={0.7} />
            {opts.numbers && (
              <text x={x + cw / 2} y={(y + ch + 8) > y + ch ? y + ch - 2 : y + ch + 6} textAnchor="middle" fontSize={6.5} className="fill-slate-500">
                {i + 1}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

/**
 * N-up — rebuilt production version.
 * Upload (multi→merge, single→skip) → Layout with live true-geometry preview
 * → vector export via pdf-lib. Rotation-aware, margin control, 9 formats.
 */
export const NupToolView: React.FC<NupToolViewProps> = ({ onBack }) => {
  const [step, setStep] = useState<Step>('upload');
  const [files, setFiles] = useState<Uploaded[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mergedBytes, setMergedBytes] = useState<Uint8Array | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [format, setFormat] = useState<NupFormat>('2x2');
  const [paper, setPaper] = useState<NupPaper>('A4');
  const [orientation, setOrientation] = useState<NupOrientation>('PORTRAIT');
  const [outerMm, setOuterMm] = useState(5);
  const [innerMm, setInnerMm] = useState(3);
  const [borders, setBorders] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [result, setResult] = useState<BuildResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const opts: NupOptions = useMemo(
    () => ({ format, paper, orientation, margins: { outer: outerMm, inner: innerMm }, borders, numbers }),
    [format, paper, orientation, outerMm, innerMm, borders, numbers]
  );
  const perSheet = useMemo(() => nupGrid(format, orientation).cols * nupGrid(format, orientation).rows, [format, orientation]);
  const totalSheets = useMemo(() => (totalPages ? totalSheetsFor(totalPages, perSheet) : 0), [totalPages, perSheet]);

  const addFiles = async (list: FileList | File[]) => {
    setError(null);
    const arr = Array.from(list).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!arr.length) { setError('Please choose PDF files.'); return; }
    setBusy(true);
    setProgress('Reading…');
    const next: Uploaded[] = [];
    for (const file of arr) {
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        const doc = await PDFDocument.load(buf.slice(), { ignoreEncryption: true });
        const first = doc.getPage(0);
        const { width, height } = first.getSize();
        next.push({
          id: `${file.name}-${file.size}-${next.length}`,
          file, bytes: buf, pages: doc.getPageCount(),
          aspect: width / height,
        });
      } catch {
        setError(`Couldn't read "${file.name}" — is it a valid PDF?`);
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    setFiles((prev) => [...prev, ...next].slice(0, 30));
    setBusy(false);
    setProgress(null);
  };

  const removeAt = (idx: number) => setFiles((p) => p.filter((_, i) => i !== idx));
  const move = (idx: number, dir: 'up' | 'down') =>
    setFiles((p) => {
      const t = dir === 'up' ? idx - 1 : idx + 1;
      if (t < 0 || t >= p.length) return p;
      const c = [...p];
      [c[idx], c[t]] = [c[t], c[idx]];
      return c;
    });

  const goLayout = async () => {
    if (!files.length) return;
    setBusy(true); setError(null); setProgress(files.length > 1 ? 'Merging…' : 'Preparing…');
    try {
      const { bytes, pages } = await mergeBytes(files);
      setMergedBytes(bytes);
      setTotalPages(pages);
      setStep('layout');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Merge failed.');
    } finally {
      setBusy(false); setProgress(null);
    }
  };

  const generate = async () => {
    if (!mergedBytes) return;
    setBusy(true); setError(null);
    try {
      const r = await buildNup(mergedBytes, opts, (d, t) => setProgress(`Building sheet ${d}/${t}…`));
      setResult(r);
      setStep('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message.slice(0, 180) : 'N-up failed.');
    } finally {
      setBusy(false); setProgress(null);
    }
  };

  const reset = () => {
    setStep('upload'); setFiles([]); setMergedBytes(null); setTotalPages(0);
    setResult(null); setError(null);
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(result.blob);
    a.download = `n-up-${format}-${paper.toLowerCase()}-${orientation.toLowerCase()}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };

  const [pwMM, phMM] = PAPER_MM[paper];
  const previewLandscape = orientation === 'LANDSCAPE';

  return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <header className="sticky top-0 z-30 -mx-4 flex items-center gap-3 border-b border-surface-2/70 bg-bg/90 px-4 py-3 backdrop-blur-md">
        <button type="button" onClick={onBack} aria-label="Back to tools"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-elevated/60 bg-surface/80 text-ink transition active:scale-95">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-[15px] font-bold text-ink">N-up PDF</h1>
          <p className="truncate text-[11px] text-ink-faint">
            {step === 'upload' && 'Upload → merge → layout'}
            {step === 'layout' && `${totalPages} pages → ${totalSheets} sheets · ${perSheet}/sheet`}
            {step === 'done' && `${result?.sheets} sheets in ${((result?.ms ?? 0) / 1000).toFixed(1)}s`}
          </p>
        </div>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-bold tabular-nums text-accent-soft">
          {step === 'upload' ? '1 · Files' : step === 'layout' ? '2 · Layout' : 'Done'}
        </span>
      </header>

      {/* ---------------- STEP 1: UPLOAD ---------------- */}
      {step === 'upload' && (
        <section aria-label="Upload PDFs" className="rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-ink">Your PDFs</span>
            {files.length > 0 && (
              <span className="rounded-full border border-elevated bg-surface-2/60 px-2 py-0.5 text-xs font-bold tabular-nums text-ink-muted">
                {files.length} file{files.length === 1 ? '' : 's'} · {files.reduce((s, f) => s + f.pages, 0)} pages
              </span>
            )}
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files); }}
            className="mt-3 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-elevated/70 bg-surface-2/40 px-4 py-8 text-center transition hover:border-primary/40 hover:bg-primary/5"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary-soft">
              <Upload className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-bold text-ink">Drop PDFs here or choose</p>
            <p className="max-w-[34ch] text-xs leading-relaxed text-ink-muted">One file goes straight to layout; several are merged in order first.</p>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
              className="mt-1 inline-flex h-10 items-center gap-2 rounded-full bg-primary-strong px-5 text-sm font-bold text-white shadow-md hover:bg-primary active:scale-[0.98] disabled:opacity-40">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
              Choose PDFs
            </button>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden"
              onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ''; }} />
          </div>

          {files.length > 0 && (
            <>
              <ul className="mt-3 flex flex-col gap-2">
                {files.map((f, i) => (
                  <li key={f.id} className="flex items-center gap-2.5 rounded-xl border border-elevated/60 bg-surface px-3 py-2.5">
                    {/* real aspect mini page icon */}
                    <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0" style={{ maxWidth: f.aspect >= 1 ? 32 : 24 }} aria-hidden="true">
                      <rect x={f.aspect >= 1 ? 2 : 5} y={2} width={f.aspect >= 1 ? 20 : 14} height={20} rx={2}
                        className="fill-primary/10 stroke-primary/40" strokeWidth={1.4} />
                      <line x1={f.aspect >= 1 ? 5 : 8} y1={8} x2={f.aspect >= 1 ? 19 : 16} y2={8} className="stroke-primary/50" strokeWidth={1.2} strokeLinecap="round" />
                      <line x1={f.aspect >= 1 ? 5 : 8} y1={12} x2={f.aspect >= 1 ? 19 : 16} y2={12} className="stroke-primary/50" strokeWidth={1.2} strokeLinecap="round" />
                      <line x1={f.aspect >= 1 ? 5 : 8} y1={16} x2={f.aspect >= 1 ? 15 : 13} y2={16} className="stroke-primary/50" strokeWidth={1.2} strokeLinecap="round" />
                    </svg>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{f.file.name}</span>
                      <span className="text-xs tabular-nums text-ink-muted">{f.pages} page{f.pages === 1 ? '' : 's'} · {fmtBytes(f.file.size)}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => move(i, 'up')} disabled={i === 0} aria-label={`Move ${f.file.name} up`}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-elevated bg-surface-2/60 text-ink-muted hover:bg-elevated disabled:opacity-30">
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => move(i, 'down')} disabled={i === files.length - 1} aria-label={`Move ${f.file.name} down`}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-elevated bg-surface-2/60 text-ink-muted hover:bg-elevated disabled:opacity-30">
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => removeAt(i)} aria-label={`Remove ${f.file.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-elevated bg-surface text-ink-muted hover:bg-danger/10 hover:text-danger">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={goLayout} disabled={busy}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary-strong px-5 text-sm font-bold text-white shadow-md shadow-primary/20 hover:bg-primary active:scale-[0.98] disabled:opacity-40">
                  {busy ? progress ?? 'Working…' : files.length === 1 ? 'Continue to layout' : `Merge ${files.length} & layout`}
                  {!busy && <Grid2x2Check className="h-4 w-4" aria-hidden="true" />}
                </button>
                <button type="button" onClick={reset} className="h-11 rounded-full border border-elevated bg-surface px-4 text-sm font-bold text-ink-muted hover:bg-surface-2">
                  Clear
                </button>
              </div>
            </>
          )}

          {error && <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger-faint/50 px-3 py-2 text-xs font-semibold text-danger">{error}</p>}
          <p className="mt-2 text-center text-[11px] text-ink-faint">100% on-device · nothing uploads · works offline</p>
        </section>
      )}

      {/* ---------------- STEP 2: LAYOUT ---------------- */}
      {step === 'layout' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
          <section aria-label="Layout options" className="rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-ink">Pages per sheet</span>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary-soft">
                {totalPages} → {totalSheets} sheet{totalSheets === 1 ? '' : 's'}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="N-up format">
              {NUP_FORMATS.map((o) => (
                <button key={o.format} type="button" role="radio" aria-checked={format === o.format} onClick={() => setFormat(o.format)}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2.5 transition active:scale-[0.97] ${
                    format === o.format ? 'border-primary/50 bg-primary/15 text-primary-soft shadow-sm' : 'border-elevated/60 bg-surface-2/40 text-ink-muted hover:bg-elevated'
                  }`}>
                  <span className="text-sm font-extrabold">{o.label}</span>
                  <span className="text-[10px] leading-none text-ink-faint">{o.sub}</span>
                </button>
              ))}
            </div>

            {/* Paper + Orientation segmented */}
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
              <div role="group" aria-label="Paper size" className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-ink-muted">Paper</span>
                <div className="inline-flex rounded-full border border-elevated bg-surface-2/50 p-0.5">
                  {(['A4', 'LETTER', 'LEGAL'] as const).map((p) => (
                    <button key={p} type="button" onClick={() => setPaper(p)} aria-pressed={paper === p}
                      className={`h-8 rounded-full px-3.5 text-xs font-bold transition ${paper === p ? 'bg-primary-strong text-white shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
                      {p === 'LETTER' ? 'Letter' : p === 'LEGAL' ? 'Legal' : 'A4'}
                    </button>
                  ))}
                </div>
              </div>
              <div role="group" aria-label="Orientation" className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-ink-muted">Orientation</span>
                <div className="inline-flex rounded-full border border-elevated bg-surface-2/50 p-0.5">
                  {(['PORTRAIT', 'LANDSCAPE'] as const).map((o) => (
                    <button key={o} type="button" onClick={() => setOrientation(o)} aria-pressed={orientation === o}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition ${orientation === o ? 'bg-primary-strong text-white shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
                      {/* tiny page glyph rotated */}
                      <svg viewBox="0 0 10 14" className={`h-3.5 ${o === 'LANDSCAPE' ? 'w-4 rotate-90' : 'w-2.5'}`} aria-hidden="true">
                        <rect x={0.5} y={0.5} width={9} height={13} rx={1} className={orientation === o ? 'fill-white/90' : 'fill-current opacity-60'} />
                      </svg>
                      {o === 'PORTRAIT' ? 'Portrait' : 'Landscape'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Margins */}
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-surface-2 pt-3">
              <label className="block">
                <span className="flex items-center justify-between text-xs font-bold text-ink-muted">
                  Outer margin <span className="tabular-nums text-primary-soft">{outerMm} mm</span>
                </span>
                <input type="range" min={0} max={20} step={1} value={outerMm} onChange={(e) => setOuterMm(Number(e.target.value))}
                  aria-label="Outer margin in millimetres"
                  className="mt-2 w-full cursor-pointer appearance-none rounded-full bg-elevated py-1.5 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary-strong [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-primary-strong" />
              </label>
              <label className="block">
                <span className="flex items-center justify-between text-xs font-bold text-ink-muted">
                  Gap between cells <span className="tabular-nums text-primary-soft">{innerMm} mm</span>
                </span>
                <input type="range" min={0} max={15} step={1} value={innerMm} onChange={(e) => setInnerMm(Number(e.target.value))}
                  aria-label="Gap between cells in millimetres"
                  className="mt-2 w-full cursor-pointer appearance-none rounded-full bg-elevated py-1.5 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary-strong [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-primary-strong" />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-surface-2 pt-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" checked={borders} onChange={(e) => setBorders(e.target.checked)} className="h-4 w-4 rounded border-elevated accent-[var(--color-primary)]" /> Cell borders
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" checked={numbers} onChange={(e) => setNumbers(e.target.checked)} className="h-4 w-4 rounded border-elevated accent-[var(--color-primary)]" /> Page numbers
              </label>
              <span className="ml-auto text-[11px] tabular-nums text-ink-faint">{pwMM}×{phMM} mm · vector · pdf-lib</span>
            </div>

            {error && <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger-faint/50 px-3 py-2 text-xs font-semibold text-danger">{error}</p>}

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setStep('upload')} className="h-11 rounded-full border border-elevated bg-surface px-5 text-sm font-bold text-ink hover:bg-surface-2">
                ← Files
              </button>
              <button type="button" onClick={generate} disabled={busy || totalPages === 0}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary-strong px-5 text-sm font-bold text-white shadow-md shadow-primary/20 hover:bg-primary active:scale-[0.98] disabled:opacity-40">
                {busy ? (<><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{progress ?? 'Building…'}</>) : (`Generate ${perSheet}-up PDF`)}
              </button>
            </div>
          </section>

          {/* Live true-geometry preview */}
          <section aria-label="Live sheet preview" className="rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg lg:sticky lg:top-[76px] sm:p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-ink">Live preview</span>
              <span className="rounded-full border border-elevated bg-surface-2/60 px-2 py-0.5 text-[11px] font-bold tabular-nums text-ink-muted">
                {previewLandscape ? 'landscape' : 'portrait'} · sheet 1
              </span>
            </div>
            <div className="rounded-2xl border border-elevated/50 bg-surface-2/30 p-2.5">
              <SheetPreview opts={opts} pageCount={Math.max(totalPages, 1)} />
            </div>
            <ul className="mt-2.5 flex flex-col gap-1 text-[11px] leading-relaxed text-ink-muted">
              <li className="flex justify-between"><span>Format</span><span className="font-bold text-ink">{perSheet} per sheet · {nupGrid(format, orientation).cols}×{nupGrid(format, orientation).rows}</span></li>
              <li className="flex justify-between"><span>Cell size</span><span className="font-bold tabular-nums text-ink">{Math.round(planSheet(opts).cellW / 2.8346)}×{Math.round(planSheet(opts).cellH / 2.8346)} mm</span></li>
              <li className="flex justify-between"><span>Margins</span><span className="font-bold tabular-nums text-ink">{outerMm} mm outer · {innerMm} mm gap</span></li>
              <li className="flex justify-between"><span>Total</span><span className="font-bold tabular-nums text-ink">{totalPages} pages → {totalSheets} sheets</span></li>
            </ul>
          </section>
        </div>
      )}

      {/* ---------------- DONE ---------------- */}
      {step === 'done' && result && (
        <section aria-label="N-up result" className="rounded-2xl border border-success/30 bg-success/5 p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15 text-success">
              <Check className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">{result.sheets} sheet{result.sheets === 1 ? '' : 's'} ready · {perSheet}-up · {paper} {orientation.toLowerCase()}</p>
              <p className="text-xs tabular-nums text-ink-muted">{totalPages} pages → {result.sheets} sheets · {fmtBytes(result.blob.size)} · built in {(result.ms / 1000).toFixed(1)}s</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={download}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary-strong px-5 text-sm font-bold text-white shadow-md shadow-primary/20 hover:bg-primary active:scale-[0.98]">
              <Download className="h-4 w-4" aria-hidden="true" /> Download PDF
            </button>
            <button type="button" onClick={reset}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-elevated bg-surface px-5 text-sm font-bold text-ink hover:bg-surface-2">
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Again
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-ink-faint">Vector output — text stays razor-sharp at any print size.</p>
        </section>
      )}
    </div>
  );
};
