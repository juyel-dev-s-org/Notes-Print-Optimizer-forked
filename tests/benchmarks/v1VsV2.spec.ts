/**
 * V1 vs V2 same-window paired A/B on the real 18-page fixture deck.
 *
 * Question (Q45 row 5): should V1 be the default engine for >=10-page decks?
 * Earlier claims (2.2x at 10 pages, 1.9x memory) came from synthetic PDFs.
 * This spec re-measures on the committed real fixtures, alternating engine
 * order per round to cancel machine drift, with page-side gc() + heap
 * sampling (launched with --js-flags=--expose-gc) for retained-memory.
 *
 * Verdict rule: switch default only if V1 wins throughput meaningfully on
 * real content AND the memory delta is acceptable for the target device.
 */
import { test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PDFDocument } from 'pdf-lib';

interface NpoBenchResult {
  engineId: string;
  engineVersion: string;
  wasmLoaded: boolean;
  totalPages: number;
  totalMs: number;
  pagesPerSecond: number;
  perPageAvg: {
    renderMs: number;
    analyzeMs: number;
    processMs: number;
    thumbnailMs: number;
    persistMs: number;
  };
  environment: { hardwareConcurrency: number; isMobile: boolean; devicePixelRatio: number };
}

declare global {
  interface Window {
    __npoProcessPdf?: (pdfBuffer: ArrayBuffer, opts?: { engineVersion?: string }) => Promise<NpoBenchResult>;
    gc?: () => void;
  }
}

const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'pdf');
const OUT_FIXTURES_DIR = join(__dirname, '..', '..', 'out', 'fixtures', 'pdf');
const FIXTURE_NAMES = ['text.pdf', 'image.pdf', 'scanned.pdf', 'mixed.pdf'];

const ENGINES = ['v1', 'pw-pixel-v2'] as const;

interface EngineRound {
  engine: string;
  ms: number;
  peakMB: number;
  retainedMB: number;
  pps: number;
}

test('V1 vs V2 paired A/B on the real 18-page deck', async ({ page }) => {
  test.setTimeout(300_000);

  /* Assemble the 18-page deck (6+4+4+4) next to the served fixtures. */
  const deck = await PDFDocument.create();
  for (const name of FIXTURE_NAMES) {
    const src = await PDFDocument.load(readFileSync(join(FIXTURES_DIR, name)));
    const pages = await deck.copyPages(src, src.getPageIndices());
    for (const p of pages) deck.addPage(p);
  }
  const deckBytes = await deck.save();
  writeFileSync(join(OUT_FIXTURES_DIR, 'deck-18.pdf'), deckBytes);

  await page.goto('/');
  await page.waitForFunction(() => typeof window.__npoProcessPdf === 'function');

  const ROUNDS = 3;
  const acc = new Map<string, { ms: number; peakMB: number; retainedMB: number }>(
    ENGINES.map((e) => [e, { ms: 0, peakMB: 0, retainedMB: 0 }])
  );

  for (let r = 0; r < ROUNDS; r++) {
    const order = r % 2 === 0 ? [...ENGINES] : [...ENGINES].reverse();
    const roundLog: string[] = [`--- round ${r + 1}/${ROUNDS} (order: ${order.join(' -> ')}) ---`];
    for (const engine of order) {
      const res = await page.evaluate(
        async ({ engine, deckUrl }: { engine: string; deckUrl: string }) => {
          const perf = () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
          window.gc?.();
          const heap0 = perf();
          let peak = 0;
          const iv = setInterval(() => {
            const cur = perf() - heap0;
            if (cur > peak) peak = cur;
          }, 50);
          const t0 = performance.now();
          const r = await fetch(deckUrl);
          if (!r.ok) throw new Error(`deck fetch failed: ${r.status}`);
          const pdfBuffer = await r.arrayBuffer();
          const report = await window.__npoProcessPdf!(pdfBuffer, { engineVersion: engine });
          clearInterval(iv);
          const ms = performance.now() - t0;
          window.gc?.();
          const retained = perf() - heap0;
          return {
            engineId: report.engineId,
            wasm: report.wasmLoaded,
            pages: report.totalPages,
            pps: report.pagesPerSecond,
            ms,
            peakMB: peak / 1048576,
            retainedMB: retained / 1048576,
          };
        },
        { engine, deckUrl: '/fixtures/pdf/deck-18.pdf' }
      );

      if (!res.wasm) throw new Error(`${engine}: WASM not loaded — A/B must run on the WASM path`);
      if (res.pages !== 18) throw new Error(`${engine}: expected 18 pages, got ${res.pages}`);

      const a = acc.get(engine)!;
      a.ms += res.ms;
      a.peakMB = Math.max(a.peakMB, res.peakMB);
      a.retainedMB = Math.max(a.retainedMB, res.retainedMB);
      roundLog.push(
        `  ${engine.padEnd(11)} ${res.engineId.padEnd(6)} ${res.ms.toFixed(0)}ms total (${res.pps.toFixed(2)} pps) | peak heap +${res.peakMB.toFixed(1)}MB | retained +${res.retainedMB.toFixed(1)}MB`
      );
    }
    console.log(roundLog.join('\n'));
  }

  const n = ROUNDS;
  const sum = (e: string) => acc.get(e)!;
  const v1 = sum('v1'), v2 = sum('pw-pixel-v2');
  const v1Ms = v1.ms / n, v2Ms = v2.ms / n;
  const speedup = v2Ms / v1Ms; /* >1 => V1 faster */
  const memRatio = v1.retainedMB / Math.max(v2.retainedMB, 0.001); /* >1 => V1 uses more */
  console.log('=== V1 vs V2 verdict (18 real pages x 3 rounds, alternate order) ===');
  console.log(`  V1: ${v1Ms.toFixed(0)}ms/deck  peak +${v1.peakMB.toFixed(1)}MB retained +${v1.retainedMB.toFixed(1)}MB`);
  console.log(`  V2: ${v2Ms.toFixed(0)}ms/deck  peak +${v2.peakMB.toFixed(1)}MB retained +${v2.retainedMB.toFixed(1)}MB`);
  console.log(`  V1/V2 speedup ratio: ${speedup.toFixed(2)}x | V1/V2 retained-memory ratio: ${memRatio.toFixed(2)}x`);
});