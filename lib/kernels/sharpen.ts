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
      // Unrolled channel loop (R, G, B) - alpha skipped
      // Red
      const ctrR = currRow[idx];
      const lapR = 4 * ctrR - prevRow[idx] - data[nro + idx] - currRow[idx - 4] - currRow[idx + 4];
      const enR = ctrR + amt * lapR;
      data[ro + idx] = enR < 0 ? 0 : enR > 255 ? 255 : (enR + 0.5) | 0;
      // Green
      const ctrG = currRow[idx + 1];
      const lapG = 4 * ctrG - prevRow[idx + 1] - data[nro + idx + 1] - currRow[idx - 3] - currRow[idx + 5];
      const enG = ctrG + amt * lapG;
      data[ro + idx + 1] = enG < 0 ? 0 : enG > 255 ? 255 : (enG + 0.5) | 0;
      // Blue
      const ctrB = currRow[idx + 2];
      const lapB = 4 * ctrB - prevRow[idx + 2] - data[nro + idx + 2] - currRow[idx - 2] - currRow[idx + 6];
      const enB = ctrB + amt * lapB;
      data[ro + idx + 2] = enB < 0 ? 0 : enB > 255 ? 255 : (enB + 0.5) | 0;
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
