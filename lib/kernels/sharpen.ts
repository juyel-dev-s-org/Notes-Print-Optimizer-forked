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

  // Rolling 3-row window: keeps prev/current/next rows in small buffers so we
  // never need a full-image copy. The previous implementation only held 2 rows
  // and loaded row y+2 into the "current" slot (off-by-one), sharpening each
  // row against the wrong centre/neighbours.
  let r0 = new Uint8ClampedArray(rowBytes);
  let r1 = new Uint8ClampedArray(rowBytes);
  let r2 = new Uint8ClampedArray(rowBytes);

  r0.set(data.subarray(0, rowBytes));
  r1.set(data.subarray(rowBytes, rowBytes * 2));

  for (let y = 1; y < h - 1; y++) {
    const nro = (y + 1) * rowBytes;
    r2.set(data.subarray(nro, nro + rowBytes));
    const ro = y * rowBytes;

    for (let x = 1; x < w - 1; x++) {
      const idx = x * 4;
      // Red
      const ctrR = r1[idx];
      const lapR = 4 * ctrR - r0[idx] - r2[idx] - r1[idx - 4] - r1[idx + 4];
      const enR = ctrR + amt * lapR;
      data[ro + idx] = enR < 0 ? 0 : enR > 255 ? 255 : (enR + 0.5) | 0;
      // Green
      const ctrG = r1[idx + 1];
      const lapG = 4 * ctrG - r0[idx + 1] - r2[idx + 1] - r1[idx - 3] - r1[idx + 5];
      const enG = ctrG + amt * lapG;
      data[ro + idx + 1] = enG < 0 ? 0 : enG > 255 ? 255 : (enG + 0.5) | 0;
      // Blue
      const ctrB = r1[idx + 2];
      const lapB = 4 * ctrB - r0[idx + 2] - r2[idx + 2] - r1[idx - 2] - r1[idx + 6];
      const enB = ctrB + amt * lapB;
      data[ro + idx + 2] = enB < 0 ? 0 : enB > 255 ? 255 : (enB + 0.5) | 0;
    }

    // Rotate: r0 <- r1 <- r2 <- (next row loaded at top of loop)
    const tmp = r0; r0 = r1; r1 = r2; r2 = tmp;
  }
}
