import { test } from '@playwright/test';

test('Fused classify vs two-step: heap delta + kernel timing (A/B aware)', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__npoBenchmark === 'function');
  const r = await page.evaluate(`(async () => {
    const W = 1600, H = 900, N = W * H;
    const src = new Uint8ClampedArray(N * 4);
    for (let i = 0; i < N; i++) {
      const n = ((i * 31 + 17) % 23) - 11;
      const r = Math.max(0, 28 + n), g = Math.max(0, 30 + n), b = Math.max(0, 44 + n);
      const idx = i * 4;
      src[idx] = r; src[idx + 1] = g; src[idx + 2] = b; src[idx + 3] = 255;
    }
    const wm = await import('/wasm/npo_wasm.js');
    await wm.default();
    const mem = () => (performance.memory ? performance.memory.usedJSHeapSize : -1);
    const hasFused = typeof wm.classify_fused === 'function';

    const warm = (fn) => { for (let i = 0; i < 2; i++) fn(); };
    const twoStep = () => wm.classify_colors(wm.rgb_to_hsv_batch(src, N), N);
    const fused = () => wm.classify_fused(src, N);

    /* correctness vs two-step when fused is present */
    let diffPixels = -1;
    if (hasFused) {
      const hsv = wm.rgb_to_hsv_batch(src, N);
      const ch = wm.classify_colors(hsv, N);
      const fm = fused();
      let diff = 0;
      for (let i = 0; i < N; i++) {
        const base = i * 7;
        const refAny = ch[base] | ch[base + 1] | ch[base + 2] | ch[base + 3] | ch[base + 4] | ch[base + 5] | ch[base + 6];
        if (fm[i] !== refAny) diff++;
      }
      diffPixels = diff;
    }

    warm(hasFused ? fused : twoStep);
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) twoStep();
    const twoStepMs = (performance.now() - t0) / 10;
    let fusedMs = -1;
    if (hasFused) {
      const t1 = performance.now();
      for (let i = 0; i < 10; i++) fused();
      fusedMs = (performance.now() - t1) / 10;
    }

    /* heap deltas */
    const heapBefore = mem();
    const hsv = wm.rgb_to_hsv_batch(src, N);
    const heapAfterHsv = mem();
    const ch = wm.classify_colors(hsv, N);
    const heapBothAlive = mem();
    hsv; ch;
    let fusedHeapDelta = -1;
    if (hasFused) {
      const h0 = mem();
      const fm = fused();
      const h1 = mem();
      fusedHeapDelta = h1 - h0;
      fm;
    }
    return {
      hasFused,
      fusedDiffPixels: diffPixels,
      twoStepMs, fusedMs,
      speedup: fusedMs > 0 ? twoStepMs / fusedMs : -1,
      heapBefore, heapAfterHsv, heapBothAlive,
      twoStepHeapDelta: heapBothAlive - heapBefore,
      fusedHeapDelta,
    };
  })()`);
  console.log('=== fused classify vs two-step (1600x900, 10 runs) ===');
  console.log(JSON.stringify(r, null, 2));
});