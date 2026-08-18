import { test } from '@playwright/test';

interface NpoBenchResult {
  engineId: string;
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
  environment: { hardwareConcurrency: number };
}

declare global {
  interface Window {
    __npoBenchmark?: (opts?: { pageCount?: number; engineVersion?: string }) => Promise<NpoBenchResult>;
  }
}

test('Full-pipeline phase breakdown: V1 and V2', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__npoBenchmark === 'function');

  const engines: Array<{ id: string; engineVersion?: string }> = [
    { id: 'V2 (sequential)', engineVersion: 'pw-pixel-v2' },
    { id: 'V1 (parallel)', engineVersion: 'pw-pixel-v1' },
  ];

  for (const eng of engines) {
    const report = await page.evaluate(async (engineVersion) => {
      const r = await window.__npoBenchmark!({ pageCount: 10, engineVersion });
      return {
        engine: r.engineId,
        wasm: r.wasmLoaded,
        totalPages: r.totalPages,
        totalMs: r.totalMs,
        pagesPerSecond: r.pagesPerSecond,
        p: r.perPageAvg,
        hw: r.environment.hardwareConcurrency,
      };
    }, eng.engineVersion);

    const p = report.p;
    const total = p.renderMs + p.analyzeMs + p.processMs + p.thumbnailMs + p.persistMs;
    const fmt = (ms: number) => `${ms.toFixed(1)}ms (${((ms / total) * 100).toFixed(1)}%)`;
    console.log('=== REPORT:', eng.id, '===');
    console.log(`  wasm=${report.wasm} hw=${report.hw} pages=${report.totalPages} total=${report.totalMs.toFixed(0)}ms pps=${report.pagesPerSecond.toFixed(2)}`);
    console.log(`  render:    ${fmt(p.renderMs)}`);
    console.log(`  analyze:   ${fmt(p.analyzeMs)}`);
    console.log(`  process:   ${fmt(p.processMs)}`);
    console.log(`  thumbnail: ${fmt(p.thumbnailMs)}`);
    console.log(`  persist:   ${fmt(p.persistMs)}`);
    console.log(`  per-page total: ${total.toFixed(1)}ms`);
  }
});