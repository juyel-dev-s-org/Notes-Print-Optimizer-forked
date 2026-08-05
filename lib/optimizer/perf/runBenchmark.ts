/**
 * Phase-0 full-pipeline benchmark (runs in the browser).
 *
 * Builds a synthetic multi-page dark-slide PDF, runs it through the real
 * engine (pdfjs render + analyze + process + thumbnail + persist), and reads
 * the per-phase breakdown emitted by the instrumented engine (doc:phases).
 *
 * Usage (in the deployed app / preview):
 *   - Console:  await window.__npoBenchmark()
 *   - Auto-run: open the page with ?bench=1 (and optional &pages=20)
 */

import { metricsBus } from '../../metrics/MetricsBus';
import type { DocPhasesEvent } from '../../metrics/types';
import type { EngineVersion } from '../engine/types';

export interface PhaseBreakdown {
  renderMs: number;
  analyzeMs: number;
  processMs: number;
  thumbnailMs: number;
  persistMs: number;
}

export interface FullBenchmarkReport {
  engineId: string;
  engineVersion: string;
  totalPages: number;
  totalMs: number;
  pagesPerSecond: number;
  phases: PhaseBreakdown;
  perPageAvg: PhaseBreakdown;
  environment: {
    hardwareConcurrency: number;
    isMobile: boolean;
    devicePixelRatio: number;
  };
}

/** Build an N-page dark-slide PDF using pdf-lib (browser). */
async function buildBenchmarkPdf(pageCount: number, w = 1600, h = 900): Promise<ArrayBuffer> {
  const { PDFDocument } = await import('pdf-lib');
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1e2233';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e8e8e8';
  for (let y = 40; y < h - 40; y += 40) ctx.fillRect(40, y, w - 80, 3);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(60, 80, 320, 22);
  ctx.fillStyle = '#7dd3fc';
  ctx.fillRect(60, 160, 240, 18);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  const imageBytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
  const pdfDoc = await PDFDocument.create();
  const img = await pdfDoc.embedJpg(imageBytes);
  for (let i = 0; i < pageCount; i++) {
    const page = pdfDoc.addPage([w, h]);
    page.drawImage(img, { x: 0, y: 0, width: w, height: h });
  }
  const bytes = await pdfDoc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function runFullBenchmark(
  opts: { pageCount?: number; engineVersion?: EngineVersion } = {}
): Promise<FullBenchmarkReport> {
  const pageCount = opts.pageCount ?? 12;
  const { getProcessingEngine } = await import('../engine');
  const engine = getProcessingEngine(opts.engineVersion);
  const pdfBuffer = await buildBenchmarkPdf(pageCount);

  let doc: DocPhasesEvent | null = null;
  const unsub = metricsBus.on('doc:phases', (e) => { doc = e as DocPhasesEvent; });

  try {
    const t0 = performance.now();
    const result = await engine.processDocument(
      { pdfBuffer, pdfId: `npo_bench_${Date.now()}`, presetMode: 'AUTO_ADAPTIVE' },
      {}, undefined, undefined
    );
    const totalMs = performance.now() - t0;
    unsub();

    const n = Math.max(1, result.processedPages.length);
    /* Re-widen: TS can't see the metricsBus callback mutates `doc`. */
    const docEvent = doc as DocPhasesEvent | null;
    const phases: PhaseBreakdown = docEvent
      ? { renderMs: docEvent.renderMs, analyzeMs: docEvent.analyzeMs, processMs: docEvent.processMs, thumbnailMs: docEvent.thumbnailMs, persistMs: docEvent.persistMs }
      : { renderMs: 0, analyzeMs: 0, processMs: 0, thumbnailMs: 0, persistMs: 0 };

    return {
      engineId: result.engineId,
      engineVersion: result.engineVersion,
      totalPages: result.processedPages.length,
      totalMs,
      pagesPerSecond: result.processedPages.length / (totalMs / 1000),
      phases,
      perPageAvg: {
        renderMs: phases.renderMs / n,
        analyzeMs: phases.analyzeMs / n,
        processMs: phases.processMs / n,
        thumbnailMs: phases.thumbnailMs / n,
        persistMs: phases.persistMs / n,
      },
      environment: {
        hardwareConcurrency: (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 0) || 0,
        isMobile: typeof window !== 'undefined' && window.innerWidth <= 768,
        devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      },
    };
  } catch (err) {
    unsub();
    throw err;
  }
}

/** Expose window.__npoBenchmark and auto-run on ?bench=1. */
export function installGlobalBenchmark(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, unknown>;

  if (!w.__npoBenchmark) {
    w.__npoBenchmark = async (opts?: { pageCount?: number; engineVersion?: string }) => {
      console.log('[NPO Benchmark] Running full-pipeline benchmark…');
      const report = await runFullBenchmark({
        pageCount: opts?.pageCount,
        engineVersion: opts?.engineVersion as EngineVersion | undefined,
      });
      console.log('%c[NPO Phase-0 Benchmark] Full pipeline report', 'color:#818cf8;font-weight:bold');
      console.log(`  engine=${report.engineId} pages=${report.totalPages} total=${report.totalMs.toFixed(0)}ms pps=${report.pagesPerSecond.toFixed(2)}`);
      console.log(`  per-page avg: render=${report.perPageAvg.renderMs.toFixed(1)}ms analyze=${report.perPageAvg.analyzeMs.toFixed(1)}ms process=${report.perPageAvg.processMs.toFixed(1)}ms thumb=${report.perPageAvg.thumbnailMs.toFixed(1)}ms persist=${report.perPageAvg.persistMs.toFixed(1)}ms`);
      console.log('[NPO Benchmark]', report);
      return report;
    };
  }

  // Auto-run when opened with ?bench=1
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('bench') === '1' && !w.__npoAutoRan) {
      w.__npoAutoRan = true;
      const pages = Number(params.get('pages') || 12);
      const engine = params.get('engine') || undefined;
      setTimeout(() => { (w.__npoBenchmark as (o?: { pageCount?: number; engineVersion?: string }) => void)({ pageCount: pages, engineVersion: engine }); }, 1200);
    }
  } catch { /* noop */ }
}
