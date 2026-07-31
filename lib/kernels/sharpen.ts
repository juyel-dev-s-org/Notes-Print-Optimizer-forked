/**
 * applyUnsharpMask - 3x3 Laplacian sharpening kernel.
 *
 * Production optimization:
 *  - Rolling 2-row buffer instead of full-image copy
 *    (saves W*H*4 bytes allocation per call - critical on 4GB devices)
 *  - WASM hook for SIMD-accelerated path when available
 *  - Boundary pixels left unmodified (avoids branch per pixel)
 */

let unsharpHook: ((data: Uint8ClampedArray, w: number, h: number, amt: number) => void) | null = null;

export function setUnsharpHook(hook: typeof unsharpHook): void {
  unsharpHook = hook;
}

export function applyUnsharpMask(data: Uint8ClampedArray, w: number, h: number, amt: number): void {
  if (unsharpHook) { unsharpHook(data, w, h, amt); return; }
  if (h < 3 || w < 3) return;

  const rowBytes = w * 4;

  // Rolling buffer: keep original values of prev row and current row
  // since we modify data in-place. Only 2*rowBytes allocation vs full image.
  const prevRow = new Uint8ClampedArray(rowBytes);
  const currRow = new Uint8ClampedArray(rowBytes);

  prevRow.set(data.subarray(0, rowBytes));
  currRow.set(data.subarray(rowBytes, rowBytes * 2));

  for (let y = 1; y < h - 1; y++) {
    const ro = y * rowBytes;
    const nro = (y + 1) * rowBytes;

    for (let x = 1; x < w - 1; x++) {
      const idx = x * 4;
      for (let c = 0; c < 3; c++) {
        const ctr = currRow[idx + c];
        const lap = 4 * ctr
          - prevRow[idx + c]
          - data[nro + idx + c]
          - currRow[idx - 4 + c]
          - currRow[idx + 4 + c];
        const en = ctr + amt * lap;
        data[ro + idx + c] = en < 0 ? 0 : en > 255 ? 255 : (en + 0.5) | 0;
      }
    }

    // Roll buffers
    prevRow.set(currRow);
    if (y + 2 < h) {
      currRow.set(data.subarray(nro + rowBytes, nro + rowBytes * 2));
    } else {
      currRow.set(data.subarray(nro, nro + rowBytes));
    }
  }
}
