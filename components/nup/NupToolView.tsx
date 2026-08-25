'use client';

import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, ArrowDown, FileText, Trash2, Upload, Grid3X3, Download, RotateCcw, Check } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

export interface NupToolViewProps {
  onBack: () => void;
}

type Step = 'upload' | 'layout' | 'done';
type N = 1 | 2 | 4 | 6 | 9;
type Paper = 'A4' | 'LETTER';
type Ori = 'AUTO' | 'PORTRAIT' | 'LANDSCAPE';

interface Uploaded {
  id: string;
  file: File;
  bytes: Uint8Array;
  pages: number;
}

const N_OPTIONS: Array<{ n: N; label: string; sub: string }> = [
  { n: 1, label: '1-up', sub: '1 per sheet' },
  { n: 2, label: '2-up', sub: '2 per sheet' },
  { n: 4, label: '4-up', sub: '2×2' },
  { n: 6, label: '6-up', sub: '2×3' },
  { n: 9, label: '9-up', sub: '3×3' },
];

function gridForN(n: N): { cols: number; rows: number } {
  if (n === 1) return { cols: 1, rows: 1 };
  if (n === 2) return { cols: 1, rows: 2 };
  if (n === 4) return { cols: 2, rows: 2 };
  if (n === 6) return { cols: 2, rows: 3 };
  return { cols: 3, rows: 3 };
}

function paperDims(paper: Paper, ori: Ori): { w: number; h: number } {
  let w = paper === 'A4' ? 595.28 : 612;
  let h = paper === 'A4' ? 841.89 : 792;
  if (ori === 'LANDSCAPE') [w, h] = [h, w];
  // AUTO = portrait base; per-sheet we could flip later, but keep portrait
  return { w, h };
}

async function mergeBytes(files: Uploaded[]): Promise<{ bytes: Uint8Array; pages: number }> {
  if (files.length === 1) return { bytes: files[0].bytes, pages: files[0].pages };
  const out = await PDFDocument.create();
  let total = 0;
  for (const f of files) {
    const src = await PDFDocument.load(f.bytes, { ignoreEncryption: true });
    const copied = await out.copyPages(src, src.getPageIndices());
    copied.forEach((p) => out.addPage(p));
    total += src.getPageCount();
  }
  return { bytes: await out.save(), pages: total };
}

async function buildNup(inputBytes: Uint8Array, n: N, paper: Paper, ori: Ori, showBorders: boolean, showNumbers: boolean): Promise<{ blob: Blob; sheets: number }> {
  const { cols, rows } = gridForN(n);
  const totalPerSheet = cols * rows;
  const srcDoc = await PDFDocument.load(inputBytes, { ignoreEncryption: true });
  const srcCount = srcDoc.getPageCount();
  const sheets = Math.ceil(srcCount / totalPerSheet);
  const out = await PDFDocument.create();

  // cache embedded pages — embed each source page once
  const embedded: Awaited<ReturnType<typeof out.embedPdf>>[] = [];
  // embed all at once is faster, but pdf-lib embedPdf with indices does it; do per sheet chunk to keep memory low
  for (let si = 0; si < sheets; si++) {
    const indices = Array.from({ length: totalPerSheet }, (_, k) => si * totalPerSheet + k).filter((i) => i < srcCount);
    // embed this sheet's pages
    const chunkEmbedded = await out.embedPdf(inputBytes, indices);
    // chunkEmbedded order matches indices
    const { w: paperW, h: paperH } = paperDims(paper, ori === 'AUTO' ? 'PORTRAIT' : ori);
    const marginOuter = 12; // ~4mm
    const marginInner = 6;
    const availW = paperW - marginOuter * 2 - marginInner * (cols - 1);
    const availH = paperH - marginOuter * 2 - marginInner * (rows - 1) - (showNumbers ? 10 : 0);
    const cellW = availW / cols;
    const cellH = availH / rows;

    const page = out.addPage([paperW, paperH]);

    indices.forEach((srcIdx, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x0 = marginOuter + col * (cellW + marginInner);
      // y top-down: row 0 is top
      const yTop = paperH - marginOuter - row * (cellH + marginInner) - cellH;
      const emb = chunkEmbedded[idx];
      const { width: pw, height: ph } = emb.scale(1);
      const scale = Math.min(cellW / pw, cellH / ph);
      const dw = pw * scale;
      const dh = ph * scale;
      const dx = x0 + (cellW - dw) / 2;
      const dy = yTop + (cellH - dh) / 2;
      page.drawPage(emb, { x: dx, y: dy, width: dw, height: dh });
      if (showBorders) {
        page.drawRectangle({ x: x0, y: yTop, width: cellW, height: cellH, borderColor: { type: 'RGB', red: 0.82, green: 0.84, blue: 0.88 } as unknown as never, borderWidth: 0.5, opacity: 0 });
        // pdf-lib borderColor needs explicit; use drawRectangle border
        page.drawRectangle({ x: x0, y: yTop, width: cellW, height: cellH, borderWidth: 0.5, borderColor: { type: 'RGB', red: 0.82, green: 0.84, blue: 0.88 } as unknown as never, color: undefined as unknown as never });
      }
      if (showNumbers) {
        const label = `${srcIdx + 1}`;
        const fontSize = 7;
        // center under cell
        page.drawText(label, { x: x0 + cellW / 2 - label.length * 2, y: yTop + 2, size: fontSize, color: { type: 'RGB', red: 0.35, green: 0.4, blue: 0.5 } as unknown as never });
      }
      // keep for type
      void embedded;
    });
  }

  const bytes = await out.save();
  return { blob: new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }), sheets };
}

/**
 * N-up — ultra fast, light, very simple.
 * Step 1: upload (multi → merge, single → skip). Step 2: layout (1/2/4/6/9, A4/Letter, ori, borders/numbers) → generate.
 * No WASM, just pdf-lib.
 */
export const NupToolView: React.FC<NupToolViewProps> = ({ onBack }) => {
  const [step, setStep] = useState<Step>('upload');
  const [files, setFiles] = useState<Uploaded[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergedBytes, setMergedBytes] = useState<Uint8Array | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [n, setN] = useState<N>(4);
  const [paper, setPaper] = useState<Paper>('A4');
  const [ori, setOri] = useState<Ori>('PORTRAIT');
  const [borders, setBorders] = useState(true);
  const [numbers, setNumbers] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultSheets, setResultSheets] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalSheets = useMemo(() => {
    if (!totalPages) return 0;
    const { cols, rows } = gridForN(n);
    return Math.ceil(totalPages / (cols * rows));
  }, [totalPages, n]);

  const addFiles = async (list: FileList | File[]) => {
    setError(null);
    const arr = Array.from(list).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!arr.length) {
      setError('Please select PDF files.');
      return;
    }
    setBusy(true);
    const next: Uploaded[] = [];
    for (const file of arr) {
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
        next.push({ id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, file, bytes: buf, pages: doc.getPageCount() });
      } catch {
        setError(`Could not read "${file.name}" — is it a valid PDF?`);
      }
    }
    setFiles((prev) => [...prev, ...next].slice(0, 20));
    setBusy(false);
  };

  const removeAt = (idx: number) => setFiles((p) => p.filter((_, i) => i !== idx));
  const move = (idx: number, dir: 'up' | 'down') => {
    const t = dir === 'up' ? idx - 1 : idx + 1;
    if (t < 0 || t >= files.length) return;
    setFiles((p) => {
      const c = [...p];
      [c[idx], c[t]] = [c[t], c[idx]];
      return c;
    });
  };

  const goLayout = async () => {
    if (!files.length) return;
    setBusy(true);
    setError(null);
    try {
      const { bytes, pages } = await mergeBytes(files);
      setMergedBytes(bytes);
      setTotalPages(pages);
      setStep('layout');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Merge failed.');
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    if (!mergedBytes) return;
    setBusy(true);
    setError(null);
    try {
      const { blob, sheets } = await buildNup(mergedBytes, n, paper, ori, borders, numbers);
      setResultBlob(blob);
      setResultSheets(sheets);
      setStep('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message.slice(0, 200) : 'N-up failed.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setFiles([]);
    setMergedBytes(null);
    setTotalPages(0);
    setResultBlob(null);
    setResultSheets(0);
    setError(null);
    setN(4);
    setPaper('A4');
    setOri('PORTRAIT');
  };

  const download = () => {
    if (!resultBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(resultBlob);
    a.download = `n-up-${n}-up-${paper.toLowerCase()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <header className="sticky top-0 z-30 -mx-4 flex items-center gap-3 border-b border-surface-2/70 bg-bg/90 px-4 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to tools"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-elevated/60 bg-surface/80 text-ink transition active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-[15px] font-bold text-ink">N-up PDF</h1>
          <p className="truncate text-[11px] text-ink-faint">
            {step === 'upload' && 'Upload → auto-merge → layout'}
            {step === 'layout' && `${totalPages} pages → ${totalSheets} sheets · ${n}-up`}
            {step === 'done' && `${resultSheets} sheets ready`}
          </p>
        </div>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-bold tabular-nums text-accent-soft">
          {step === 'upload' ? '1 · Upload' : step === 'layout' ? '2 · Layout' : '3 · Done'}
        </span>
      </header>

      {step === 'upload' && (
        <>
          <section aria-label="Upload PDFs" className="rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-ink">PDFs</span>
              <span className="rounded-full border border-elevated bg-surface-2/60 px-2 py-0.5 text-xs font-bold tabular-nums text-ink-muted">
                {files.length} files · {files.reduce((s, f) => s + f.pages, 0) || 0} pages
              </span>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
              }}
              className="mt-3 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-elevated/70 bg-surface-2/40 px-4 py-8 text-center transition hover:border-primary/30 hover:bg-primary/5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary-soft">
                <Upload className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-bold text-ink">Drop PDFs here or choose</p>
              <p className="text-xs text-ink-muted">Single → direct. Multiple → auto-merged in order.</p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary-strong px-5 text-sm font-bold text-white shadow-md hover:bg-primary active:scale-[0.98] disabled:opacity-40"
              >
                <FileText className="h-4 w-4" aria-hidden="true" /> Choose PDFs
              </button>
              <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={(e) => e.target.files && void addFiles(e.target.files)} />
            </div>

            {files.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {files.map((f, i) => (
                  <li key={f.id} className="flex items-center gap-2 rounded-xl border border-elevated/60 bg-surface px-3 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-soft">
                      <FileText className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{f.file.name}</span>
                      <span className="text-xs text-ink-muted">{f.pages} pages · {(f.file.size / 1024).toFixed(0)} KB</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => move(i, 'up')} disabled={i === 0} aria-label={`Move ${f.file.name} up`} className="flex h-8 w-8 items-center justify-center rounded-full border border-elevated bg-surface-2/60 text-ink-muted hover:bg-elevated disabled:opacity-30">
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => move(i, 'down')} disabled={i === files.length - 1} aria-label={`Move ${f.file.name} down`} className="flex h-8 w-8 items-center justify-center rounded-full border border-elevated bg-surface-2/60 text-ink-muted hover:bg-elevated disabled:opacity-30">
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => removeAt(i)} aria-label={`Remove ${f.file.name}`} className="flex h-8 w-8 items-center justify-center rounded-full border border-elevated bg-surface text-ink-muted hover:bg-danger/10 hover:text-danger">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {error && <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{error}</p>}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={goLayout}
                disabled={files.length === 0 || busy}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary-strong px-5 text-sm font-bold text-white shadow-md hover:bg-primary active:scale-[0.98] disabled:opacity-40"
              >
                {busy ? 'Reading…' : files.length === 1 ? 'Continue → Layout' : `Merge ${files.length} → Layout`}
                {!busy && <Grid3X3 className="h-4 w-4" aria-hidden="true" />}
              </button>
              {files.length > 0 && (
                <button type="button" onClick={reset} className="h-11 rounded-full border border-elevated bg-surface px-4 text-sm font-bold text-ink-muted hover:bg-surface-2">
                  Clear
                </button>
              )}
            </div>
            <p className="mt-2 text-center text-[11px] text-ink-faint">On-device only — nothing uploaded. Merge is instant pdf-lib.</p>
          </section>

          {files.length > 1 && (
            <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-ink-muted">
              <span className="font-bold text-primary-soft">Tip:</span> Reorder with ↑↓ — first file’s first page becomes page 1. Single file also works perfectly, skip merge.
            </p>
          )}
        </>
      )}

      {step === 'layout' && (
        <>
          <section aria-label="Layout options" className="rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-ink">Pages per sheet</span>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary-soft">{totalPages} → {totalSheets} sheets</span>
            </div>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {N_OPTIONS.map((o) => (
                <button
                  key={o.n}
                  type="button"
                  onClick={() => setN(o.n)}
                  aria-pressed={n === o.n}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 py-3 transition active:scale-[0.97] ${n === o.n ? 'border-primary/40 bg-primary/15 text-primary-soft shadow-sm' : 'border-elevated/60 bg-surface-2/40 text-ink-muted hover:bg-elevated'}`}
                >
                  <span className="text-sm font-extrabold">{o.label}</span>
                  <span className="text-[10px] leading-none text-ink-faint">{o.sub}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-bold text-ink">Paper</span>
                <select value={paper} onChange={(e) => setPaper(e.target.value as Paper)} className="mt-1 w-full rounded-xl border border-elevated bg-surface-2/60 px-3 py-2.5 text-sm font-bold text-ink">
                  <option value="A4">A4</option>
                  <option value="LETTER">Letter</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-ink">Orientation</span>
                <select value={ori} onChange={(e) => setOri(e.target.value as Ori)} className="mt-1 w-full rounded-xl border border-elevated bg-surface-2/60 px-3 py-2.5 text-sm font-bold text-ink">
                  <option value="PORTRAIT">Portrait</option>
                  <option value="LANDSCAPE">Landscape</option>
                  <option value="AUTO">Auto</option>
                </select>
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-surface-2 pt-3">
              <label className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                <input type="checkbox" checked={borders} onChange={(e) => setBorders(e.target.checked)} className="h-4 w-4 rounded border-elevated" /> Borders
              </label>
              <label className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                <input type="checkbox" checked={numbers} onChange={(e) => setNumbers(e.target.checked)} className="h-4 w-4 rounded border-elevated" /> Page numbers
              </label>
              <span className="ml-auto hidden text-xs text-ink-faint sm:inline">Light · pdf-lib only</span>
            </div>

            {/* tiny visual grid */}
            <div className="mt-4">
              <p className="mb-2 text-xs font-bold text-ink-muted">Preview — {n} per sheet</p>
              <div className="rounded-2xl border border-elevated/60 bg-white p-3 shadow-inner">
                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${gridForN(n).cols}, minmax(0, 1fr))` }}>
                  {Array.from({ length: n }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex aspect-[3/4] items-center justify-center rounded-lg border text-xs font-bold ${i < Math.min(n, totalPages) ? 'border-primary/20 bg-primary/5 text-primary-soft' : 'border-dashed border-elevated bg-surface-2/40 text-ink-faint'}`}
                    >
                      {i < totalPages ? i + 1 : '·'}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-center text-[11px] text-ink-faint">
                  {paper} {ori === 'AUTO' ? '' : `· ${ori.toLowerCase()}`} · {borders ? 'borders' : 'no borders'}
                  {numbers ? ' · numbers' : ''} · {totalSheets} sheet{totalSheets === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {error && <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{error}</p>}

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setStep('upload')} className="h-11 rounded-full border border-elevated bg-surface px-5 text-sm font-bold text-ink hover:bg-surface-2">
                ← Back
              </button>
              <button
                type="button"
                onClick={generate}
                disabled={busy}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary-strong px-5 text-sm font-bold text-white shadow-md hover:bg-primary active:scale-[0.98] disabled:opacity-40"
              >
                {busy ? 'Building…' : `Generate ${n}-up PDF`}
                {!busy && <Grid3X3 className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </section>
        </>
      )}

      {step === 'done' && resultBlob && (
        <section aria-label="N-up result" className="rounded-2xl border border-success/30 bg-success/5 p-4 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/15 text-success">
              <Check className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-ink">Done — {resultSheets} sheet{resultSheets === 1 ? '' : 's'} · {n}-up · {paper}</p>
              <p className="text-xs text-ink-muted">
                {totalPages} pages → {resultSheets} sheets · {(resultBlob.size / 1024).toFixed(0)} KB
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={download} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary-strong px-5 text-sm font-bold text-white shadow-md hover:bg-primary">
              <Download className="h-4 w-4" aria-hidden="true" /> Download PDF
            </button>
            <button type="button" onClick={reset} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-elevated bg-surface px-5 text-sm font-bold text-ink hover:bg-surface-2">
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Again
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-ink-faint">On-device pdf-lib · no quality loss</p>
        </section>
      )}
    </div>
  );
};
