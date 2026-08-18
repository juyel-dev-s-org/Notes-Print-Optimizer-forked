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

const PAGE_COUNTS = [1, 10, 50, 100];
const ENGINES: Array<{ id: string; engineVersion?: string }> = [
  { id: 'V2 (sequential)', engineVersion: 'pw-pixel-v2' },
  { id: 'V1 (parallel)', engineVersion: 'pw-pixel-v1' },
];

test('Pipeline benchmarks: 1/10/50/100 pages, cold+warm, memory, long tasks', async ({ page }) => {
  test.setTimeout(900_000);
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__npoBenchmark === 'function');

  const results: string[] = [];
  for (const eng of ENGINES) {
    for (const pages of PAGE_COUNTS) {
      /* V1 (worker pool) only at 1+10 pages to bound runtime */
      if (eng.engineVersion === 'pw-pixel-v1' && pages > 10) continue;
      for (const run of ['cold', 'warm'] as const) {
        const report = await page.evaluate(
          async ({ pageCount, engineVersion, run }) => {
            const perfMem = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
            const memBefore = perfMem ? perfMem.usedJSHeapSize : -1;
            let peakMem = memBefore;
            let blockingMs = 0;

            /* long-task observer for main-thread blocking */
            let tasks: number[] = [];
            const obs = new PerformanceObserver((list) => {
              for (const e of list.getEntries()) tasks.push(e.duration);
            });
            try { obs.observe({ type: 'longtask', buffered: false }); } catch { /* noop */ }

            /* memory sampling every 75ms during the run */
            const sampler = setInterval(() => {
              if (perfMem && perfMem.usedJSHeapSize > peakMem) peakMem = perfMem.usedJSHeapSize;
            }, 75);

            const t0 = performance.now();
            const r = await window.__npoBenchmark!({ pageCount, engineVersion });
            const wallMs = performance.now() - t0;
            clearInterval(sampler);
            tasks = tasks.filter((d) => d >= 50);
            blockingMs = tasks.reduce((a, b) => a + b, 0);
            try { obs.disconnect(); } catch { /* noop */ }

            const memAfter = perfMem ? perfMem.usedJSHeapSize : -1;
            const memTotal = perfMem ? perfMem.jsHeapSizeLimit : -1;

            return {
              run, engine: r.engineId, wasm: r.wasmLoaded,
              totalPages: r.totalPages, totalMs: r.totalMs, wallMs,
              pps: r.pagesPerSecond,
              p: r.perPageAvg,
              hw: r.environment.hardwareConcurrency,
              memBeforeKB: Math.round(memBefore / 1024),
              peakMemKB: Math.round(peakMem / 1024),
              memAfterKB: Math.round(memAfter / 1024),
              memLimitKB: Math.round(memTotal / 1024),
              blockingMs: Math.round(blockingMs * 10) / 10,
              longTasks: tasks.length,
            };
          },
          { pageCount: pages, engineVersion: eng.engineVersion, run }
        );

        const p = report.p;
        const total = p.renderMs + p.analyzeMs + p.processMs + p.thumbnailMs + p.persistMs;
        const fmt = (ms: number) => `${ms.toFixed(1)}ms`;
        console.log(`=== ${eng.id} ${pages} pages [${run}] ===`);
        console.log(`  wasm=${report.wasm} hw=${report.hw} total=${report.totalMs.toFixed(0)}ms wall=${report.wallMs.toFixed(0)}ms pps=${report.pps.toFixed(2)}`);
        console.log(`  render: ${fmt(p.renderMs)}  analyze: ${fmt(p.analyzeMs)}  process: ${fmt(p.processMs)}  thumb: ${fmt(p.thumbnailMs)}  persist: ${fmt(p.persistMs)}`);
        console.log(`  per-page: ${total.toFixed(1)}ms`);
        console.log(`  peak heap: ${report.peakMemKB}KB  before: ${report.memBeforeKB}KB  after: ${report.memAfterKB}KB  limit: ${report.memLimitKB}KB`);
        console.log(`  main-thread blocking: ${report.blockingMs}ms across ${report.longTasks} long tasks`);
        results.push(JSON.stringify({ ...report, pages, eng: eng.id, total }));
      }
    }
  }
  console.log('=== ALL RESULTS JSON ===');
  console.log(JSON.stringify(results.map((r) => JSON.parse(r)), null, 0));
});