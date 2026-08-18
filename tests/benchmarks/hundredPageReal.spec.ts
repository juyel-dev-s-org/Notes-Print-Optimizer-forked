/**
 * Final production verification: a 100-page REAL-content deck (committed
 * fixtures cycled — no synthetic pages) through the production engine
 * (V2 + WASM), with page-side heap sampling.
 *
 * Structural assertions only (pages processed, WASM on): timing is reported,
 * not thresholded, because machine-load variance is ~2.5x between sessions.
 */
import { test } from '@playwright/test';
import { join } from 'path';
import { buildFixtureDeck } from './benchTypes';

test('100-page real deck through the production engine (V2 + WASM)', async ({ page }) => {
  test.setTimeout(600_000);

  const deckPath = join(__dirname, '..', '..', 'out', 'fixtures', 'pdf', 'deck-100.pdf');
  const deckPages = await buildFixtureDeck(deckPath, 100);

  await page.goto('/');
  await page.waitForFunction(() => typeof window.__npoProcessPdf === 'function');

  const res = await page.evaluate(async (deckUrl: string) => {
    const perf = () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
    window.gc?.();
    const heap0 = perf();
    let peak = 0;
    const iv = setInterval(() => {
      const cur = perf() - heap0;
      if (cur > peak) peak = cur;
    }, 100);
    const t0 = performance.now();
    const r = await fetch(deckUrl);
    if (!r.ok) throw new Error(`deck fetch failed: ${r.status}`);
    const pdfBuffer = await r.arrayBuffer();
    const report = await window.__npoProcessPdf!(pdfBuffer, { engineVersion: 'pw-pixel-v2' });
    clearInterval(iv);
    const ms = performance.now() - t0;
    window.gc?.();
    const retained = perf() - heap0;
    return {
      engine: report.engineId,
      wasm: report.wasmLoaded,
      pages: report.totalPages,
      totalMs: report.totalMs,
      pps: report.pagesPerSecond,
      perPage: report.perPageAvg,
      peakMB: peak / 1048576,
      retainedMB: retained / 1048576,
      hw: report.environment.hardwareConcurrency,
    };
  }, '/fixtures/pdf/deck-100.pdf');

  if (!res.wasm) throw new Error('WASM not loaded — production benchmark must run on the WASM path');
  if (res.pages !== deckPages) throw new Error(`expected ${deckPages} pages, got ${res.pages}`);
  if (res.pages !== 100) throw new Error(`expected 100 pages, got ${res.pages}`);
  const p = res.perPage;
  for (const [k, v] of Object.entries(p)) {
    if (typeof v !== 'number' || !(v > 0)) throw new Error(`phase ${k} must be > 0, got ${v}`);
  }

  const total = p.renderMs + p.analyzeMs + p.processMs + p.thumbnailMs + p.persistMs;
  console.log('=== FINAL PRODUCTION VERIFICATION: 100-page real deck (V2 + WASM) ===');
  console.log(`  engine=${res.engine} wasm=ON hw=${res.hw} pages=${res.pages} total=${res.totalMs.toFixed(0)}ms pps=${res.pps.toFixed(2)}`);
  console.log(`  per-page: render=${p.renderMs.toFixed(1)}ms analyze=${p.analyzeMs.toFixed(1)}ms process=${p.processMs.toFixed(1)}ms thumb=${p.thumbnailMs.toFixed(1)}ms persist=${p.persistMs.toFixed(1)}ms (sum=${total.toFixed(1)}ms)`);
  console.log(`  heap: peak +${res.peakMB.toFixed(1)}MB retained +${res.retainedMB.toFixed(1)}MB`);
});