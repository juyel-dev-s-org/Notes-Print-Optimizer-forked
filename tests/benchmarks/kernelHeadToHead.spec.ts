import { test } from '@playwright/test';

/**
 * JS vs WASM per-kernel head-to-head in the SAME browser page.
 * JS references are literal copies of lib/wasm/jsFallback.ts.
 */

const JS_REF = `
function rgbToHsvRef(r, g, b, out) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  out[0] = (h * 0.5 + 0.5) | 0;
  out[1] = max === 0 ? 0 : ((delta * 255 / max) + 0.5) | 0;
  out[2] = max;
}
function rgbToHsvBatchRef(rgba, pixelCount) {
  const out = new Float32Array(pixelCount * 3);
  const hsv = [0, 0, 0];
  for (let i = 0; i < pixelCount; i++) {
    const off = i * 4;
    rgbToHsvRef(rgba[off], rgba[off + 1], rgba[off + 2], hsv);
    out[i * 3] = hsv[0]; out[i * 3 + 1] = hsv[1]; out[i * 3 + 2] = hsv[2];
  }
  return out;
}
function classifyColorsRef(hsv, pixelCount) {
  const out = new Uint8Array(pixelCount * 7);
  for (let i = 0; i < pixelCount; i++) {
    const off = i * 3;
    const h = hsv[off], s = hsv[off + 1], v = hsv[off + 2];
    if (v < 70) continue;
    const base = i * 7;
    if (s < 55 && v > 155) out[base] = 1;
    if (h >= 15 && h <= 35 && s > 80 && v > 100) out[base + 1] = 1;
    if (h >= 36 && h <= 85 && s > 55 && v > 75) out[base + 2] = 1;
    if (h >= 86 && h <= 105 && s > 55 && v > 75) out[base + 3] = 1;
    if (h >= 106 && h <= 135 && s > 55 && v > 65) out[base + 4] = 1;
    if (h >= 136 && h <= 175 && s > 55 && v > 75) out[base + 5] = 1;
    if ((h <= 15 || h >= 175) && s > 75 && v > 95) out[base + 6] = 1;
  }
  return out;
}
function dilateMaskRef(mask, w, h, ks) {
  const copy = new Uint8Array(mask);
  const off = (ks / 2) | 0;
  const offsets = [];
  if (ks === 3) offsets.push([0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]);
  else if (ks === 5) {
    for (let kx = -2; kx <= 2; kx++) offsets.push([kx, 0]);
    for (let ky = -2; ky <= 2; ky++) { if (ky === 0) continue; offsets.push([-1, ky], [0, ky], [1, ky]); }
    offsets.push([-2, -1], [2, -1], [-2, 0], [2, 0], [-2, 1], [2, 1], [0, -2], [0, 2]);
  } else { for (let ky = -off; ky <= off; ky++) for (let kx = -off; kx <= off; kx++) offsets.push([kx, ky]); }
  for (let y = off; y < h - off; y++) { const ro = y * w;
    for (let x = off; x < w - off; x++) {
      if (copy[ro + x] === 1) for (const [kx, ky] of offsets) mask[(y + ky) * w + (x + kx)] = 1; } }
}
function unsharpMaskRef(data, w, h, amt) {
  const cp = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++) { const ro = y * w * 4, pro = (y - 1) * w * 4, nro = (y + 1) * w * 4;
    for (let x = 1; x < w - 1; x++) { const idx = ro + x * 4;
      for (let c = 0; c < 3; c++) { const ctr = cp[idx + c];
        const lap = 4 * ctr - cp[pro + x * 4 + c] - cp[nro + x * 4 + c] - cp[idx - 4 + c] - cp[idx + 4 + c];
        const en = ctr + amt * lap; data[idx + c] = en < 0 ? 0 : en > 255 ? 255 : (en + 0.5) | 0; } } }
}
`;

const BENCH = `
  const W = 1600, H = 900, N = W * H;
  ${JS_REF}
  const src = new Uint8ClampedArray(N * 4);
  for (let i = 0; i < N; i++) {
    const n = ((i * 31 + 17) % 23) - 11;
    const r = Math.max(0, 28 + n), g = Math.max(0, 30 + n), b = Math.max(0, 44 + n);
    const idx = i * 4;
    src[idx] = r; src[idx + 1] = g; src[idx + 2] = b; src[idx + 3] = 255;
  }
  for (let y = 40; y < H - 40; y += 40) {
    for (let x = 40; x < W - 40; x += 4) {
      const idx = (y * W + x) * 4;
      const v = 200 + ((x + y) % 40);
      src[idx] = v; src[idx + 1] = v; src[idx + 2] = v;
    }
  }
  const wm = await import('/wasm/npo_wasm.js');
  await wm.default();
  if (!wm.rgb_to_hsv_batch) return { error: 'exports missing' };

  const bench = (fn, runs) => {
    for (let i = 0; i < 2; i++) fn();
    const t0 = performance.now();
    for (let i = 0; i < runs; i++) fn();
    return (performance.now() - t0) / runs;
  };

  /* warm */
  wm.rgb_to_hsv_batch(src, N);
  rgbToHsvBatchRef(src, N);

  const out = {};
  const RUNS = 5;
  out.hsvWasm = bench(() => wm.rgb_to_hsv_batch(src, N), RUNS);
  out.hsvJs = bench(() => rgbToHsvBatchRef(src, N), RUNS);

  const hsvJs = rgbToHsvBatchRef(src, N);
  out.classWasm = bench(() => wm.classify_colors(hsvJs, N), RUNS);
  out.classJs = bench(() => classifyColorsRef(hsvJs, N), RUNS);

  const mask = new Uint8Array(N);
  for (let i = 0; i < N; i += 3) mask[i] = 1;
  out.dilateWasm = bench(() => wm.dilate_mask(mask, W, H, 3), RUNS);
  out.dilateJs = bench(() => dilateMaskRef(mask, W, H, 3), RUNS);

  const img = new Uint8ClampedArray(src);
  out.sharpWasm = bench(() => wm.unsharp_mask(new Uint8ClampedArray(img), W, H, 0.35), RUNS);
  out.sharpJs = bench(() => unsharpMaskRef(new Uint8ClampedArray(img), W, H, 0.35), RUNS);

  /* correctness: JS vs WASM outputs identical? */
  const hw = wm.rgb_to_hsv_batch(src, N);
  let hsvDiff = 0;
  for (let i = 0; i < hw.length; i++) if (hw[i] !== hsvJs[i]) hsvDiff++;
  const cw = wm.classify_colors(hsvJs, N);
  const cj = classifyColorsRef(hsvJs, N);
  let clDiff = 0;
  for (let i = 0; i < cw.length; i++) if (cw[i] !== cj[i]) clDiff++;
  const swImg = new Uint8ClampedArray(img), sjImg = new Uint8ClampedArray(img);
  wm.unsharp_mask(swImg, W, H, 0.35);
  unsharpMaskRef(sjImg, W, H, 0.35);
  let shDiff = 0;
  for (let i = 0; i < swImg.length; i++) if (swImg[i] !== sjImg[i]) shDiff++;
  out.correctness = { hsvDiff, classDiff: clDiff, unsharpDiff: shDiff };
  return out;
`;

test('Kernel head-to-head: WASM vs JS in-browser', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__npoBenchmark === 'function');
  const r = await page.evaluate(`(async () => { ${BENCH} })()`) as {
    hsvWasm: number; hsvJs: number;
    classWasm: number; classJs: number;
    dilateWasm: number; dilateJs: number;
    sharpWasm: number; sharpJs: number;
    correctness: { hsvDiff: number; classDiff: number; unsharpDiff: number };
  };
  console.log('=== WASM vs JS kernel timings (1600x900, ms/op) ===');
  console.log(JSON.stringify(r, null, 2));
  const ratios = {
    hsv: r.hsvJs / r.hsvWasm,
    classify: r.classJs / r.classWasm,
    dilate: r.dilateJs / r.dilateWasm,
    unsharp: r.sharpJs / r.sharpWasm,
  };
  console.log('=== JS/WASM speedup ratios (JS time / WASM time) ===');
  console.log(JSON.stringify(ratios, null, 2));
});
