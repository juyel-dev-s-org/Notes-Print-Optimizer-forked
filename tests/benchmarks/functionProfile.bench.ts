import { describe, it, expect } from 'vitest';
import { jsKernels } from '../../lib/wasm/jsFallback';
import { ParameterGenerator } from '../../lib/optimizer/parameterGenerator';
import { processPage } from '../../lib/kernels';

const PAGE_W = 1600;
const PAGE_H = 900;
const PIXELS = PAGE_W * PAGE_H;
const RUNS = 5;

function makeDarkSlide(seed: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(PIXELS * 4);
  for (let i = 0; i < PIXELS; i++) {
    const idx = i * 4;
    const n = ((i * 31 + seed * 17) % 23) - 11;
    data[idx] = Math.max(0, 28 + n);
    data[idx + 1] = Math.max(0, 30 + n);
    data[idx + 2] = Math.max(0, 44 + n);
    data[idx + 3] = 255;
  }
  for (let y = 40; y < PAGE_H - 40; y += 40) {
    for (let x = 40; x < PAGE_W - 40; x += 4) {
      const idx = (y * PAGE_W + x) * 4;
      const bright = 200 + ((x + y + seed) % 40);
      data[idx] = bright; data[idx + 1] = bright; data[idx + 2] = bright;
    }
  }
  return data;
}

describe('Per-function kernel timing (JS fallback, 1600x900 dark slide)', () => {
  it('times each kernel function in isolation', () => {
    const src = makeDarkSlide(1);
    const hsv = jsKernels.rgbToHsvBatch(src, PIXELS);
    const ch = jsKernels.classifyColors(hsv, PIXELS);
    const mask = new Uint8Array(PIXELS);
    for (let i = 0; i < PIXELS; i++) {
      const base = i * 7;
      if (ch[base] === 1 || ch[base + 1] === 1 || ch[base + 2] === 1 ||
          ch[base + 3] === 1 || ch[base + 4] === 1 || ch[base + 5] === 1 ||
          ch[base + 6] === 1) mask[i] = 1;
    }

    const avg = (fn: () => void): number => {
      for (let i = 0; i < 2; i++) fn(); /* warmup */
      const t0 = performance.now();
      for (let i = 0; i < RUNS; i++) fn();
      return (performance.now() - t0) / RUNS;
    };

    const timings: Array<{ name: string; ms: number }> = [];
    timings.push({ name: 'rgbToHsvBatch (RGB -> HSV)', ms: avg(() => jsKernels.rgbToHsvBatch(src, PIXELS)) });
    timings.push({ name: 'classifyColors (HSV -> 7 channels)', ms: avg(() => jsKernels.classifyColors(hsv, PIXELS)) });
    timings.push({ name: 'connectedComponents', ms: avg(() => jsKernels.connectedComponents(mask, PAGE_W, PAGE_H)) });
    timings.push({ name: 'dilateMask ks=3', ms: avg(() => jsKernels.dilateMask(new Uint8Array(mask), PAGE_W, PAGE_H, 3)) });
    timings.push({ name: 'removeNoise', ms: avg(() => jsKernels.removeNoise(new Uint8Array(mask), PAGE_W, PAGE_H)) });
    timings.push({ name: 'unsharpMask', ms: avg(() => jsKernels.unsharpMask(new Uint8ClampedArray(src), PAGE_W, PAGE_H, 0.5)) });
    timings.push({ name: 'inkCoverage', ms: avg(() => jsKernels.inkCoverage(src, PIXELS, 240)) });

    timings.sort((a, b) => b.ms - a.ms);
    console.log('=== PER-FUNCTION KERNEL TIMING (per page, 1600x900) ===');
    for (const t of timings) console.log(`  ${t.name}: ${t.ms.toFixed(2)}ms`);
    console.log('=== END ===');
    expect(timings.length).toBe(7);
  });

  it('times processPage sub-stages by param toggling (exact, derived)', () => {
    const params = ParameterGenerator.getPresetParameters('PW_DARK_SLIDE');
    const prof = { classification: 'DARK_SLIDE', darkBackgroundRatio: 0.9 };
    const avg = (p: typeof params): number => {
      for (let i = 0; i < 2; i++) processPage(new Uint8ClampedArray(src), PAGE_W, PAGE_H, p, prof);
      const t0 = performance.now();
      for (let i = 0; i < RUNS; i++) processPage(new Uint8ClampedArray(src), PAGE_W, PAGE_H, p, prof);
      return (performance.now() - t0) / RUNS;
    };
    const src = makeDarkSlide(2);
    const full = avg(params);
    const noSharpen = avg({ ...params, sharpenAmount: 0 });
    const noBoth = avg({ ...params, dilationKernelSize: 0, sharpenAmount: 0 });

    const sharpen = full - noSharpen;
    const dilate = noSharpen - noBoth;
    const maskAndCc = noBoth;

    console.log('=== PROCESSPAGE SUB-STAGE (exact derived) ===');
    console.log(`  full processPage:        ${full.toFixed(2)}ms`);
    console.log(`  unsharp sharpen:         ${sharpen.toFixed(2)}ms (${((sharpen / full) * 100).toFixed(1)}%)`);
    console.log(`  mask extract + CC pass:  ${maskAndCc.toFixed(2)}ms (${((maskAndCc / full) * 100).toFixed(1)}%)`);
    console.log(`  dilation ks=3:           ${dilate.toFixed(2)}ms (${((dilate / full) * 100).toFixed(1)}%)`);
    console.log('=== END ===');
    expect(full).toBeGreaterThan(0);
  });
});
