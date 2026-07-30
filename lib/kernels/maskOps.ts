import { bufferPool } from '../optimizer/perf/bufferPool';

let dilationHook: ((mask: Uint8Array, w: number, h: number, ks: number) => void) | null = null;

export function setDilationHook(hook: typeof dilationHook): void {
  dilationHook = hook;
}

export function applyMaskDilation(mask: Uint8Array, w: number, h: number, ks: number): void {
  if (dilationHook) { dilationHook(mask, w, h, ks); return; }
  const copy = bufferPool.acquire(mask.length); copy.set(mask); const off = (ks / 2) | 0;
  const offsets: Array<[number, number]> = [];
  if (ks === 3) offsets.push([0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]);
  else if (ks === 5) {
    for (let kx = -2; kx <= 2; kx++) offsets.push([kx, 0]);
    for (let ky = -2; ky <= 2; ky++) { if (ky === 0) continue; offsets.push([-1, ky], [0, ky], [1, ky]); }
    offsets.push([-2, -1], [2, -1], [-2, 0], [2, 0], [-2, 1], [2, 1], [0, -2], [0, 2]);
  } else { for (let ky = -off; ky <= off; ky++) for (let kx = -off; kx <= off; kx++) offsets.push([kx, ky]); }
  for (let y = off; y < h - off; y++) { const ro = y * w;
    for (let x = off; x < w - off; x++) {
      if (copy[ro + x] === 1) for (let k = 0; k < offsets.length; k++) mask[(y + offsets[k][1]) * w + (x + offsets[k][0])] = 1; } }
  bufferPool.release(copy);
}
