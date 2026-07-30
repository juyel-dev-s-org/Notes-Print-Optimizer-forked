let unsharpHook: ((data: Uint8ClampedArray, w: number, h: number, amt: number) => void) | null = null;

export function setUnsharpHook(hook: typeof unsharpHook): void {
  unsharpHook = hook;
}

export function applyUnsharpMask(data: Uint8ClampedArray, w: number, h: number, amt: number): void {
  if (unsharpHook) { unsharpHook(data, w, h, amt); return; }
  const cp = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++) { const ro = y * w * 4, pro = (y - 1) * w * 4, nro = (y + 1) * w * 4;
    for (let x = 1; x < w - 1; x++) { const idx = ro + x * 4;
      for (let c = 0; c < 3; c++) { const ctr = cp[idx + c];
        const lap = 4 * ctr - cp[pro + x * 4 + c] - cp[nro + x * 4 + c] - cp[idx - 4 + c] - cp[idx + 4 + c];
        const en = ctr + amt * lap; data[idx + c] = en < 0 ? 0 : en > 255 ? 255 : (en + 0.5) | 0; } } }
}
