import { describe, it, expect } from 'vitest';

/**
 * Sharpen variant shootout: try several implementations of a 3x3
 * Laplacian unsharp mask and pick the fastest.
 *
 * Variants:
 *   A) current: rolling 2-row buffer (lib/kernels/sharpen.ts)
 *   B) full-image copy
 *   C) rolling buffer + row-pair precompute (process 2 rows per pass)
 *   D) full copy + Uint32 channel stride tricks
 *   E) chunked row-buffer (larger rolling window, less per-row setup)
 */

const W = 1600, H = 900, PIXELS = W * H;
const AMT = 0.5;
const RUNS = 10;

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
  for (let y = 40; y < H - 40; y += 40) {
    for (let x = 40; x < W - 40; x += 4) {
      const idx = (y * W + x) * 4;
      const bright = 200 + ((x + y + seed) % 40);
      data[idx] = bright; data[idx + 1] = bright; data[idx + 2] = bright;
    }
  }
  return data;
}

/* A: current rolling 2-row buffer (exact production reference) */
function variantA(data: Uint8ClampedArray, w: number, h: number, amt: number): void {
  const rowBytes = w * 4;
  const prevRow = new Uint8ClampedArray(rowBytes);
  const currRow = new Uint8ClampedArray(rowBytes);
  prevRow.set(data.subarray(0, rowBytes));
  currRow.set(data.subarray(rowBytes, rowBytes * 2));
  for (let y = 1; y < h - 1; y++) {
    const ro = y * rowBytes;
    const nro = (y + 1) * rowBytes;
    for (let x = 1; x < w - 1; x++) {
      const idx = x * 4;
      const ctrR = currRow[idx];
      const lapR = 4 * ctrR - prevRow[idx] - data[nro + idx] - currRow[idx - 4] - currRow[idx + 4];
      const enR = ctrR + amt * lapR;
      data[ro + idx] = enR < 0 ? 0 : enR > 255 ? 255 : (enR + 0.5) | 0;
      const ctrG = currRow[idx + 1];
      const lapG = 4 * ctrG - prevRow[idx + 1] - data[nro + idx + 1] - currRow[idx - 3] - currRow[idx + 5];
      const enG = ctrG + amt * lapG;
      data[ro + idx + 1] = enG < 0 ? 0 : enG > 255 ? 255 : (enG + 0.5) | 0;
      const ctrB = currRow[idx + 2];
      const lapB = 4 * ctrB - prevRow[idx + 2] - data[nro + idx + 2] - currRow[idx - 2] - currRow[idx + 6];
      const enB = ctrB + amt * lapB;
      data[ro + idx + 2] = enB < 0 ? 0 : enB > 255 ? 255 : (enB + 0.5) | 0;
    }
    prevRow.set(currRow);
    if (y + 2 < h) currRow.set(data.subarray(nro + rowBytes, nro + rowBytes * 2));
    else currRow.set(data.subarray(nro, nro + rowBytes));
  }
}

/* B: full-image copy (simple reference) */
function variantB(data: Uint8ClampedArray, w: number, h: number, amt: number): void {
  const cp = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++) {
    const ro = y * w * 4, pro = (y - 1) * w * 4, nro = (y + 1) * w * 4;
    for (let x = 1; x < w - 1; x++) {
      const idx = ro + x * 4;
      for (let c = 0; c < 3; c++) {
        const ctr = cp[idx + c];
        const lap = 4 * ctr - cp[pro + x * 4 + c] - cp[nro + x * 4 + c] - cp[idx - 4 + c] - cp[idx + 4 + c];
        const en = ctr + amt * lap;
        data[idx + c] = en < 0 ? 0 : en > 255 ? 255 : (en + 0.5) | 0;
      }
    }
  }
}

/* C: 3-row rolling buffer (keeps prev/curr/next) to avoid re-reading data */
function variantC(data: Uint8ClampedArray, w: number, h: number, amt: number): void {
  const rowBytes = w * 4;
  let r0 = new Uint8ClampedArray(rowBytes);
  let r1 = new Uint8ClampedArray(rowBytes);
  let r2 = new Uint8ClampedArray(rowBytes);
  r0.set(data.subarray(0, rowBytes));
  r1.set(data.subarray(rowBytes, rowBytes * 2));
  for (let y = 1; y < h - 1; y++) {
    const nro = (y + 1) * rowBytes;
    if (y + 1 < h) r2.set(data.subarray(nro, nro + rowBytes));
    else r2.fill(0);
    const ro = y * rowBytes;
    for (let x = 1; x < w - 1; x++) {
      const idx = x * 4;
      const ctrR = r1[idx];
      const lapR = 4 * ctrR - r0[idx] - r2[idx] - r1[idx - 4] - r1[idx + 4];
      const enR = ctrR + amt * lapR;
      data[ro + idx] = enR < 0 ? 0 : enR > 255 ? 255 : (enR + 0.5) | 0;
      const ctrG = r1[idx + 1];
      const lapG = 4 * ctrG - r0[idx + 1] - r2[idx + 1] - r1[idx - 3] - r1[idx + 5];
      const enG = ctrG + amt * lapG;
      data[ro + idx + 1] = enG < 0 ? 0 : enG > 255 ? 255 : (enG + 0.5) | 0;
      const ctrB = r1[idx + 2];
      const lapB = 4 * ctrB - r0[idx + 2] - r2[idx + 2] - r1[idx - 2] - r1[idx + 6];
      const enB = ctrB + amt * lapB;
      data[ro + idx + 2] = enB < 0 ? 0 : enB > 255 ? 255 : (enB + 0.5) | 0;
    }
    const tmp = r0; r0 = r1; r1 = r2; r2 = tmp;
  }
}

/* D: full copy but process all 3 channels in one inner loop pass w/ local vars */
function variantD(data: Uint8ClampedArray, w: number, h: number, amt: number): void {
  const cp = data.slice();
  for (let y = 1; y < h - 1; y++) {
    const pro = (y - 1) * w * 4, ro = y * w * 4, nro = (y + 1) * w * 4;
    for (let x = 1; x < w - 1; x++) {
      const idx = ro + x * 4, pidx = pro + x * 4, nidx = nro + x * 4, l = idx - 4, r = idx + 4;
      const ctrR = cp[idx], ctrG = cp[idx + 1], ctrB = cp[idx + 2];
      const lapR = 4 * ctrR - cp[pidx] - cp[nidx] - cp[l] - cp[r];
      const lapG = 4 * ctrG - cp[pidx + 1] - cp[nidx + 1] - cp[l + 1] - cp[r + 1];
      const lapB = 4 * ctrB - cp[pidx + 2] - cp[nidx + 2] - cp[l + 2] - cp[r + 2];
      const eR = ctrR + amt * lapR, eG = ctrG + amt * lapG, eB = ctrB + amt * lapB;
      data[idx] = eR < 0 ? 0 : eR > 255 ? 255 : (eR + 0.5) | 0;
      data[idx + 1] = eG < 0 ? 0 : eG > 255 ? 255 : (eG + 0.5) | 0;
      data[idx + 2] = eB < 0 ? 0 : eB > 255 ? 255 : (eB + 0.5) | 0;
    }
  }
}

/* E: precompute prev-row into a plain array of 3 channels to speed loads */
function variantE(data: Uint8ClampedArray, w: number, h: number, amt: number): void {
  const rowBytes = w * 4;
  const prev = new Float32Array(rowBytes);
  const curr = new Float32Array(rowBytes);
  for (let i = 0; i < rowBytes; i++) { prev[i] = data[i]; curr[i] = data[rowBytes + i]; }
  for (let y = 1; y < h - 1; y++) {
    const ro = y * rowBytes;
    const nro = (y + 1) * rowBytes;
    for (let x = 1; x < w - 1; x++) {
      const idx = x * 4;
      const ctrR = curr[idx];
      const lapR = 4 * ctrR - prev[idx] - data[nro + idx] - curr[idx - 4] - curr[idx + 4];
      const eR = ctrR + amt * lapR;
      data[ro + idx] = eR < 0 ? 0 : eR > 255 ? 255 : (eR + 0.5) | 0;
      const ctrG = curr[idx + 1];
      const lapG = 4 * ctrG - prev[idx + 1] - data[nro + idx + 1] - curr[idx - 3] - curr[idx + 5];
      const eG = ctrG + amt * lapG;
      data[ro + idx + 1] = eG < 0 ? 0 : eG > 255 ? 255 : (eG + 0.5) | 0;
      const ctrB = curr[idx + 2];
      const lapB = 4 * ctrB - prev[idx + 2] - data[nro + idx + 2] - curr[idx - 2] - curr[idx + 6];
      const eB = ctrB + amt * lapB;
      data[ro + idx + 2] = eB < 0 ? 0 : eB > 255 ? 255 : (eB + 0.5) | 0;
    }
    for (let i = 0; i < rowBytes; i++) { prev[i] = curr[i]; curr[i] = data[nro + i]; }
  }
}

/* F: 3-row rolling but row pointers as Float32 offsets precomputed + hoisted bounds */
function variantF(data: Uint8ClampedArray, w: number, h: number, amt: number): void {
  const rowBytes = w * 4;
  let r0 = new Uint8ClampedArray(rowBytes);
  let r1 = new Uint8ClampedArray(rowBytes);
  let r2 = new Uint8ClampedArray(rowBytes);
  r0.set(data.subarray(0, rowBytes));
  r1.set(data.subarray(rowBytes, rowBytes * 2));
  const lastRow = h - 1;
  for (let y = 1; y < lastRow; y++) {
    const nro = (y + 1) * rowBytes;
    r2.set(data.subarray(nro, nro + rowBytes));
    const ro = y * rowBytes;
    let x = 1;
    const xEnd = w - 1;
    while (x < xEnd) {
      const idx = x * 4;
      const ctrR = r1[idx];
      const lapR = 4 * ctrR - r0[idx] - r2[idx] - r1[idx - 4] - r1[idx + 4];
      const enR = ctrR + amt * lapR;
      data[ro + idx] = enR < 0 ? 0 : enR > 255 ? 255 : (enR + 0.5) | 0;
      const ctrG = r1[idx + 1];
      const lapG = 4 * ctrG - r0[idx + 1] - r2[idx + 1] - r1[idx - 3] - r1[idx + 5];
      const enG = ctrG + amt * lapG;
      data[ro + idx + 1] = enG < 0 ? 0 : enG > 255 ? 255 : (enG + 0.5) | 0;
      const ctrB = r1[idx + 2];
      const lapB = 4 * ctrB - r0[idx + 2] - r2[idx + 2] - r1[idx - 2] - r1[idx + 6];
      const enB = ctrB + amt * lapB;
      data[ro + idx + 2] = enB < 0 ? 0 : enB > 255 ? 255 : (enB + 0.5) | 0;
      x++;
    }
    const tmp = r0; r0 = r1; r1 = r2; r2 = tmp;
  }
}

describe('Sharpen variant shootout', () => {
  it('benchmarks A-E and prints results', () => {
    const base = makeDarkSlide(1);
    const variants: Array<{ name: string; fn: (d: Uint8ClampedArray, w: number, h: number, a: number) => void }> = [
      { name: 'A rolling-2row (current)', fn: variantA },
      { name: 'B full-copy', fn: variantB },
      { name: 'C rolling-3row', fn: variantC },
      { name: 'D full-copy+localvars', fn: variantD },
      { name: 'E float32 rolling', fn: variantE },
      { name: 'F rolling-3row+hoisted', fn: variantF },
    ];

    const results: Array<{ name: string; ms: number }> = [];
    for (const v of variants) {
      const t0 = performance.now();
      for (let r = 0; r < RUNS; r++) {
        const d = new Uint8ClampedArray(base);
        v.fn(d, W, H, AMT);
      }
      const ms = (performance.now() - t0) / RUNS;
      results.push({ name: v.name, ms });
    }

    /* Verify all produce identical output against variant C (correct 3-row rolling).
       Variant A (production) is known-buggy (off-by-one rolling) — we keep it only
       as a timing reference and assert its OUTPUT DIFFERS from the correct one. */
    const ref = new Uint8ClampedArray(base);
    variantC(ref, W, H, AMT);
    for (const v of variants) {
      const d = new Uint8ClampedArray(base);
      v.fn(d, W, H, AMT);
      let same = true;
      let firstDiff = -1;
      for (let i = 0; i < d.length; i++) if (d[i] !== ref[i]) { same = false; firstDiff = i; break; }
      if (v.name.startsWith('A ') && same) throw new Error(`${v.name} unexpectedly matches correct output (bug gone?)`);
      if (!v.name.startsWith('A ') && !same) throw new Error(`${v.name} output differs from correct reference! firstDiff=${firstDiff} (${d[firstDiff]} vs ${ref[firstDiff]})`);
    }

    results.sort((a, b) => a.ms - b.ms);
    console.log('=== SHARPEN VARIANT SHOOTOUT (per-call, 1600x900) ===');
    for (const r of results) {
      console.log(`  ${r.name}: ${r.ms.toFixed(2)}ms`);
    }
    console.log('=== END ===');
    expect(results[0].ms).toBeGreaterThan(0);
  });
});