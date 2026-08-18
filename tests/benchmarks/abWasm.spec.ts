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

test('A/B 100-page warm benchmark (2 consecutive runs)', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__npoBenchmark === 'function');
  for (let i = 1; i <= 2; i++) {
    const r = await page.evaluate(async () => await window.__npoBenchmark!({ pageCount: 100, engineVersion: 'pw-pixel-v2' }));
    const p = r.perPageAvg;
    console.log(`RUN${i} total=${r.totalMs.toFixed(0)}ms pps=${r.pagesPerSecond.toFixed(2)} render=${p.renderMs.toFixed(1)} analyze=${p.analyzeMs.toFixed(1)} process=${p.processMs.toFixed(1)} thumb=${p.thumbnailMs.toFixed(1)} persist=${p.persistMs.toFixed(1)}`);
  }
});