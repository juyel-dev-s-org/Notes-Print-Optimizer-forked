import { describe, it, expect } from 'vitest';
import { analyzeImageData } from '../../lib/optimizer/analysis';
import { processPage, calculateInkCoverage, createImageDataFromBuffer } from '../../lib/kernels';
import { ParameterGenerator } from '../../lib/optimizer/parameterGenerator';

/**
 * Phase-0 baseline: CPU-bound per-page pipeline (no PDF rendering).
 *
 * Mirrors what the V1 engine does on the main thread for each page:
 *   analyze -> processPage(kernel) -> inkCoverage(before) -> inkCoverage(after)
 *
 * Rendering (pdfjs) is measured separately via the in-browser harness because
 * it cannot run reliably in Vitest/jsdom. This benchmark isolates the CPU work
 * that parallelisation + WASM target.
 */

const PAGE_W = 1600;
const PAGE_H = 900;
const PAGE_COUNT = 10;
const PIXELS = PAGE_W * PAGE_H;

/** Synthetic dark lecture slide: dark background + lighter content strokes. */
function makeDarkSlide(seed: number): ImageData {
  const data = new Uint8ClampedArray(PIXELS * 4);
  for (let i = 0; i < PIXELS; i++) {
    const idx = i * 4;
    // dark bluish background with slight noise
    const n = ((i * 31 + seed * 17) % 23) - 11;
    data[idx] = Math.max(0, 28 + n);
    data[idx + 1] = Math.max(0, 30 + n);
    data[idx + 2] = Math.max(0, 44 + n);
    data[idx + 3] = 255;
  }
  // draw lighter "content" strokes (every ~40px a bright pixel run)
  for (let y = 40; y < PAGE_H - 40; y += 40) {
    for (let x = 40; x < PAGE_W - 40; x += 4) {
      const idx = (y * PAGE_W + x) * 4;
      const bright = 200 + ((x + y + seed) % 40);
      data[idx] = bright; data[idx + 1] = bright; data[idx + 2] = bright;
    }
  }
  return new ImageData(data, PAGE_W, PAGE_H);
}

describe('Phase-0 CPU baseline (per-page pipeline, no render)', () => {
  it('measures analyze/process/ink breakdown and pages/sec', () => {
    const params = ParameterGenerator.getPresetParameters('PW_DARK_SLIDE');
    const pages: ImageData[] = [];
    for (let p = 0; p < PAGE_COUNT; p++) pages.push(makeDarkSlide(p + 1));

    let analyzeTotal = 0, processTotal = 0, inkTotal = 0;
    let t0 = 0;

    const overall = performance.now();
    for (let p = 0; p < PAGE_COUNT; p++) {
      const img = pages[p];

      t0 = performance.now();
      const profile = analyzeImageData(img, p);
      analyzeTotal += performance.now() - t0;

      t0 = performance.now();
      const res = processPage(img.data, img.width, img.height, params, profile);
      processTotal += performance.now() - t0;

      t0 = performance.now();
      calculateInkCoverage(img.data);
      calculateInkCoverage(new Uint8ClampedArray(res.buffer));
      inkTotal += performance.now() - t0;

      expect(profile).toBeDefined();
      expect(res.buffer.byteLength).toBeGreaterThan(0);
    }
    const totalMs = performance.now() - overall;
    const pagesPerSec = PAGE_COUNT / (totalMs / 1000);

    const analyzeAvg = analyzeTotal / PAGE_COUNT;
    const processAvg = processTotal / PAGE_COUNT;
    const inkAvg = inkTotal / PAGE_COUNT;
    const cpuPerPage = analyzeAvg + processAvg + inkAvg;

    // Parseable, stable summary block (read from CI logs for BASELINE.md)
    console.log('=== PHASE-0 CPU BASELINE (Vitest, main-thread JS) ===');
    console.log(`page_size: ${PAGE_W}x${PAGE_H} (${(PIXELS / 1e6).toFixed(2)} MPx)`);
    console.log(`pages: ${PAGE_COUNT}`);
    console.log(`analyze_ms_per_page: ${analyzeAvg.toFixed(2)}`);
    console.log(`process_ms_per_page: ${processAvg.toFixed(2)}`);
    console.log(`ink_ms_per_page: ${inkAvg.toFixed(2)}`);
    console.log(`cpu_total_ms_per_page: ${cpuPerPage.toFixed(2)}`);
    console.log(`total_ms: ${totalMs.toFixed(1)}`);
    console.log(`pages_per_sec_cpu: ${pagesPerSec.toFixed(2)}`);
    console.log(`breakdown_pct: analyze=${((analyzeAvg / cpuPerPage) * 100).toFixed(0)}% process=${((processAvg / cpuPerPage) * 100).toFixed(0)}% ink=${((inkAvg / cpuPerPage) * 100).toFixed(0)}%`);
    console.log('=== END PHASE-0 CPU BASELINE ===');

    // Sanity: work actually happened and throughput is positive.
    expect(analyzeAvg).toBeGreaterThan(0);
    expect(processAvg).toBeGreaterThan(0);
    expect(pagesPerSec).toBeGreaterThan(0);
  });
});
