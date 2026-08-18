import { test } from '@playwright/test';

test('HSV intermediate buffer: heap delta in-browser', async ({ page }) => {
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

    /* warm both paths */
    wm.rgb_to_hsv_batch(src, N); wm.classify_colors(wm.rgb_to_hsv_batch(src, N), N);

    const heapBefore = mem();
    const t0 = performance.now();
    const hsv = wm.rgb_to_hsv_batch(src, N);
    const t1 = performance.now();
    const heapAfterHsv = mem();
    const ch = wm.classify_colors(hsv, N);
    const t2 = performance.now();
    const heapBothAlive = mem();
    hsv; ch;
    return {
      hsvAllocMs: t1 - t0,
      classifyMs: t2 - t1,
      hsvBytes: hsv.byteLength,
      channelsBytes: ch.byteLength,
      heapBefore: heapBefore,
      heapAfterHsv: heapAfterHsv,
      heapBothAlive: heapBothAlive,
    };
  })()`);
  console.log('=== HSV intermediate buffer memory (1600x900) ===');
  console.log(JSON.stringify(r, null, 2));
  const expectedBytes = 1600 * 900 * 3 * 4 + 1600 * 900 * 7;
  console.log(`expected simultaneous bytes (Float32Array hsv + Uint8Array channels): ${expectedBytes} = ${(expectedBytes / 1048576).toFixed(1)} MB`);
});