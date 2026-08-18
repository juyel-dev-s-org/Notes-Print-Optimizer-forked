import { test, expect } from '@playwright/test';

/**
 * Verifies the worker-pool infrastructure actually runs in a real browser:
 * the pool must spawn real workers and a full pipeline benchmark must
 * complete with a non-empty pool (C1 regression guard).
 */
test.describe('Worker pool runtime', () => {
  test('pixel workers spawn and process pages end-to-end', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await page.waitForFunction(() => typeof (window as any).__npoBenchmark === 'function');

    const report = await page.evaluate(async () => {
      const r = await (window as any).__npoBenchmark({ pageCount: 6, engineVersion: 'pw-pixel-v1' });
      const stats = await (window as any).__npoWorkerStats();
      return { report: r, stats };
    });

    expect(report.report.totalPages).toBe(6);
    expect(report.report.pagesPerSecond).toBeGreaterThan(0);
    expect(report.stats.capabilities.workers).toBe(true);
    expect(report.stats.pool.poolSize).toBeGreaterThan(0);
    expect(report.stats.pool.healthyCount).toBe(report.stats.pool.poolSize);
    expect(report.stats.pool.pendingCount).toBe(0);
    expect(report.stats.pool.queueLength).toBe(0);
  });
});
