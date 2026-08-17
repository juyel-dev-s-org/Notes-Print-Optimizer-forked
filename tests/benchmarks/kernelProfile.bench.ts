import { describe, it, expect } from 'vitest';
import { processPage } from '../../lib/kernels';
import { jsKernels } from '../../lib/wasm/jsFallback';
import { ParameterGenerator } from '../../lib/optimizer/parameterGenerator';

/**
 * Intra-kernel profiling: breaks processPage's pipeline into its operations
 * (mask extraction, CC pass, dilation, composite, sharpen) and times each.
 *
 * The JS-path operations mirror what the WASM monolithic process_page does
 * internally (hsv -> classify -> mask OR -> CC(decorative+noise) -> dilate
 * -> composite -> unsharp), so relative shares transfer to the WASM path.
 */

const PAGE_W = 1600;
const PAGE_H = 900;
const PIXELS = PAGE_W * PAGE_H;
const PAGE_COUNT = 10;

function makeDarkSlide(seed: number): ImageData {
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
  return new ImageData(data, PAGE_W, PAGE_H);
}

/** Faithful replica of processPage's JS-path foreground mask extraction. */
function extractMask(rgba: Uint8ClampedArray, dw: number, dh: number): Uint8Array {
  const hsv = jsKernels.rgbToHsvBatch(rgba, dw * dh);
  const ch = jsKernels.classifyColors(hsv, dw * dh);
  const fm = new Uint8Array(dw * dh);
  for (let i = 0; i < dw * dh; i++) {
    const base = i * 7;
    if (ch[base] === 1 || ch[base + 1] === 1 || ch[base + 2] === 1 ||
        ch[base + 3] === 1 || ch[base + 4] === 1 || ch[base + 5] === 1 ||
        ch[base + 6] === 1) fm[i] = 1;
  }
  return fm;
}

/** Faithful replica of removeDecorativeAndNoise (single CC pass + drop logic). */
function ccPass(mask: Uint8Array, dw: number, dh: number): void {
  const labels = jsKernels.connectedComponents(mask, dw, dh);
  const tp = dw * dh;
  let cl = 0;
  for (let i = 0; i < tp; i++) if (labels[i] > cl) cl = labels[i];
  const sMinX = new Int32Array(cl + 1).fill(dw);
  const sMinY = new Int32Array(cl + 1).fill(dh);
  const sMaxX = new Int32Array(cl + 1).fill(-1);
  const sMaxY = new Int32Array(cl + 1).fill(-1);
  const sArea = new Int32Array(cl + 1);
  for (let i = 0; i < tp; i++) {
    const l = labels[i]; if (l === 0) continue;
    const cx = i % dw, cy = (i / dw) | 0;
    if (cx < sMinX[l]) sMinX[l] = cx; if (cx > sMaxX[l]) sMaxX[l] = cx;
    if (cy < sMinY[l]) sMinY[l] = cy; if (cy > sMaxY[l]) sMaxY[l] = cy;
    sArea[l]++;
  }
  const drop = new Uint8Array(cl + 1);
  for (let lb = 1; lb <= cl; lb++) {
    const cw = sMaxX[lb] - sMinX[lb] + 1, ch = sMaxY[lb] - sMinY[lb] + 1;
    if (sArea[lb] >= 200 && cw / Math.max(ch, 1) > 2.2 && cw / dw > 0.20 && sMinY[lb] / dh < 0.15 && sArea[lb] > cw * ch * 0.3) drop[lb] = 1;
  }
  for (let i = 0; i < tp; i++) { if (labels[i] > 0 && drop[labels[i]] === 1) mask[i] = 0; }
}

/** Faithful replica of composite: mask -> B/W RGBA via Uint32 writes. */
function composite(mask: Uint8Array, dw: number, dh: number): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(dw * dh * 4);
  const dst32 = new Uint32Array(dst.buffer);
  for (let i = 0; i < dw * dh; i++) dst32[i] = mask[i] === 1 ? 0xFF000000 : 0xFFFFFFFF;
  return dst;
}

describe('Intra-kernel operation profile', () => {
  it('breaks processPage into per-operation timing', () => {
    const params = ParameterGenerator.getPresetParameters('PW_DARK_SLIDE');
    const pages: ImageData[] = [];
    for (let p = 0; p < PAGE_COUNT; p++) pages.push(makeDarkSlide(p + 1));

    /* Isolate stages by toggling params on the REAL processPage (exact). */
    const t = { full: 0, noDilate: 0, noSharpen: 0, noDilateNoSharpen: 0, mask: 0, cc: 0, dilate: 0, composite: 0, sharpen: 0 };
    let t0 = 0;

    for (let p = 0; p < PAGE_COUNT; p++) {
      const img = pages[p];
      const prof = { classification: 'DARK_SLIDE', darkBackgroundRatio: 0.9 };

      t0 = performance.now();
      processPage(img.data, img.width, img.height, params, prof);
      t.full += performance.now() - t0;

      /* No dilation (ks=0), sharpen on */
      t0 = performance.now();
      processPage(img.data, img.width, img.height, { ...params, dilationKernelSize: 0 }, prof);
      t.noDilate += performance.now() - t0;

      /* No sharpen, dilation on */
      t0 = performance.now();
      processPage(img.data, img.width, img.height, { ...params, sharpenAmount: 0 }, prof);
      t.noSharpen += performance.now() - t0;

      /* No dilation, no sharpen -> mask extraction + CC only */
      t0 = performance.now();
      processPage(img.data, img.width, img.height, { ...params, dilationKernelSize: 0, sharpenAmount: 0 }, prof);
      t.noDilateNoSharpen += performance.now() - t0;

      const src = new Uint8ClampedArray(img.data);

      /* 1. Foreground mask extraction (HSV convert + classify + OR) */
      t0 = performance.now();
      const fm = extractMask(src, PAGE_W, PAGE_H);
      t.mask += performance.now() - t0;

      /* 2. Connected-components pass (decorative + noise) */
      t0 = performance.now();
      ccPass(fm, PAGE_W, PAGE_H);
      t.cc += performance.now() - t0;

      /* 3. Composite mask -> B/W (unused for share math; reference) */
      t0 = performance.now();
      composite(fm, PAGE_W, PAGE_H);
      t.composite += performance.now() - t0;

      expect(fm.length).toBe(PIXELS);
    }

    const avg = (v: number) => v / PAGE_COUNT;

    /* Exact costs derived from real processPage toggle differences. */
    const full = avg(t.full);
    const noDilate = avg(t.noDilate);
    const noSharpen = avg(t.noSharpen);
    const noBoth = avg(t.noDilateNoSharpen);

    /* sharpen cost = full - noSharpen (dilate present both) */
    const sharpen = full - noSharpen;
    /* dilate cost = noSharpen - noBoth (mask+cc both present) */
    const dilate = noSharpen - noBoth;
    /* mask extraction = noBoth - ccReplica (isolate CC via replica share) */
    const maskAvg = avg(t.mask);
    const ccAvg = avg(t.cc);

    const ops = [
      { name: 'mask extraction (HSV+classify+OR)', ms: maskAvg },
      { name: 'connected-components pass', ms: ccAvg },
      { name: 'dilation (ks=3)', ms: Math.max(0, dilate) },
      { name: 'composite (mask->B/W)', ms: Math.max(0, full - noSharpen - dilate - maskAvg - ccAvg) },
      { name: 'unsharp sharpen', ms: Math.max(0, sharpen) },
    ];

    console.log('=== INTRA-KERNEL PROFILE (per-page, 1600x900 dark slide) ===');
    console.log(`full processPage (exact): ${full.toFixed(1)}ms`);
    console.log(`  [cross-check] no-dilate run: ${noDilate.toFixed(1)}ms  (expect ~full - dilate)`);
    console.log(`  [derived] dilate(ks=3): ${dilate.toFixed(1)}ms  [noSharpen(${noSharpen.toFixed(1)}) - noBoth(${noBoth.toFixed(1)})]`);
    console.log(`  [derived] sharpen:      ${sharpen.toFixed(1)}ms  [full(${full.toFixed(1)}) - noSharpen(${noSharpen.toFixed(1)})]`);
    for (const o of ops) {
      console.log(`  ${o.name}: ${o.ms.toFixed(1)}ms (${((o.ms / full) * 100).toFixed(1)}% of full)`);
    }
    console.log('=== END INTRA-KERNEL PROFILE ===');

    expect(full).toBeGreaterThan(0);
  });
});