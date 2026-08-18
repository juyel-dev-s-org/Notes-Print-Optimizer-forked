/**
 * Real-PDF baseline: the committed fixture PDFs through the REAL engine in
 * the browser (WASM path), served from public/fixtures/pdf/.
 *
 * This is the production acceptance baseline: real-world content types
 * (vector text, embedded rasters, scans, mixed), real renderer, real engine,
 * real WASM. Timings are reported per fixture; no cross-run comparisons.
 */
import { test } from '@playwright/test';
import { FIXTURE_NAMES } from './benchTypes';

const EXPECTED_PAGES: Record<(typeof FIXTURE_NAMES)[number], number> = {
  'text.pdf': 6,
  'image.pdf': 4,
  'scanned.pdf': 4,
  'mixed.pdf': 4,
};
const FIXTURES = FIXTURE_NAMES.map((name) => ({ name, expectPages: EXPECTED_PAGES[name] }));

test('Real-PDF fixtures through the real engine (WASM)', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__npoProcessPdf === 'function');

  for (const fx of FIXTURES) {
    const report = await page.evaluate(async (url: string) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`fixture fetch failed: ${r.status}`);
      const pdfBuffer = await r.arrayBuffer();
      /* Production engine is V2 — measure it explicitly (registry default is v1). */
      const res = await window.__npoProcessPdf!(pdfBuffer, { engineVersion: 'pw-pixel-v2' });
      return {
        engine: res.engineId,
        wasm: res.wasmLoaded,
        totalPages: res.totalPages,
        totalMs: res.totalMs,
        pagesPerSecond: res.pagesPerSecond,
        p: res.perPageAvg,
        hw: res.environment.hardwareConcurrency,
      };
    }, `/fixtures/pdf/${fx.name}`);

    if (report.totalPages !== fx.expectPages) {
      throw new Error(`expected ${fx.expectPages} pages for ${fx.name}, got ${report.totalPages}`);
    }
    if (!report.wasm) {
      throw new Error(`WASM not loaded for ${fx.name} — baseline must run on the WASM path`);
    }

    const p = report.p;
    const total = p.renderMs + p.analyzeMs + p.processMs + p.thumbnailMs + p.persistMs;
    const fmt = (ms: number) => `${ms.toFixed(1)}ms (${((ms / total) * 100).toFixed(1)}%)`;
    console.log(`=== REPORT: ${fx.name} ===`);
    console.log(`  engine=${report.engine} wasm=${report.wasm ? 'ON' : 'OFF'} hw=${report.hw} pages=${report.totalPages} total=${report.totalMs.toFixed(0)}ms pps=${report.pagesPerSecond.toFixed(2)}`);
    console.log(`  render:    ${fmt(p.renderMs)}`);
    console.log(`  analyze:   ${fmt(p.analyzeMs)}`);
    console.log(`  process:   ${fmt(p.processMs)}`);
    console.log(`  thumbnail: ${fmt(p.thumbnailMs)}`);
    console.log(`  persist:   ${fmt(p.persistMs)}`);
    console.log(`  per-page total: ${total.toFixed(1)}ms`);
  }
});