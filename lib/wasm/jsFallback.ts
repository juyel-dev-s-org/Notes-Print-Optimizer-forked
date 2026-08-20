import type { IWasmKernels } from './types';
import { rgbToHsv } from '../kernels/hsv';
import { ensureCC, getCCLabels, getCCQueue } from '../kernels/connectedComponents';

export const jsKernels: IWasmKernels = {
  rgbToHsvBatch(rgba: Uint8ClampedArray, pixelCount: number): Float32Array {
    const out = new Float32Array(pixelCount * 3);
    const hsv: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < pixelCount; i++) {
      const off = i * 4;
      rgbToHsv(rgba[off], rgba[off + 1], rgba[off + 2], hsv);
      out[i * 3] = hsv[0];
      out[i * 3 + 1] = hsv[1];
      out[i * 3 + 2] = hsv[2];
    }
    return out;
  },

  classifyColors(hsv: Float32Array, pixelCount: number): Uint8Array {
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
  },

  classifyFused(rgba: Uint8ClampedArray, pixelCount: number): Uint8Array {
    const out = new Uint8Array(pixelCount);
    const hsv: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < pixelCount; i++) {
      const off = i * 4;
      rgbToHsv(rgba[off], rgba[off + 1], rgba[off + 2], hsv);
      const h = hsv[0], s = hsv[1], v = hsv[2];
      if (v < 70) continue;
      if ((s < 55 && v > 155) ||
          (h >= 15 && h <= 35 && s > 80 && v > 100) ||
          (h >= 36 && h <= 85 && s > 55 && v > 75) ||
          (h >= 86 && h <= 105 && s > 55 && v > 75) ||
          (h >= 106 && h <= 135 && s > 55 && v > 65) ||
          (h >= 136 && h <= 175 && s > 55 && v > 75) ||
          ((h <= 15 || h >= 175) && s > 75 && v > 95)) out[i] = 1;
    }
    return out;
  },

  connectedComponents(mask: Uint8Array, w: number, h: number): Int32Array {
    const tp = w * h;
    ensureCC(tp);
    const labels = getCCLabels(), queue = getCCQueue();
    let cl = 1;
    for (let i = 0; i < tp; i++) {
      if (mask[i] === 1 && labels[i] === 0) {
        const lb = cl++;
        let hd = 0, tl = 0;
        queue[tl++] = i; labels[i] = lb;
        while (hd < tl) {
          const cu = queue[hd++], cx = cu % w, cy = (cu / w) | 0;
          const yS = cy > 0 ? cy - 1 : cy, yE = cy < h - 1 ? cy + 1 : cy;
          const xS = cx > 0 ? cx - 1 : cx, xE = cx < w - 1 ? cx + 1 : cx;
          for (let ny = yS; ny <= yE; ny++) {
            const ro = ny * w;
            for (let nx = xS; nx <= xE; nx++) {
              if (nx === cx && ny === cy) continue;
              const ni = ro + nx;
              if (mask[ni] === 1 && labels[ni] === 0) { labels[ni] = lb; queue[tl++] = ni; }
            }
          }
        }
      }
    }
    return labels;
  },

  stripDecorativeFills(mask: Uint8Array, w: number, h: number): void {
    const tp = w * h;
    const labels = this.connectedComponents(mask, w, h);
    let cl = 0;
    for (let i = 0; i < tp; i++) if (labels[i] > cl) cl = labels[i];
    const sMinX = new Int32Array(cl + 1).fill(w);
    const sMinY = new Int32Array(cl + 1).fill(h);
    const sMaxX = new Int32Array(cl + 1).fill(-1);
    const sMaxY = new Int32Array(cl + 1).fill(-1);
    const sArea = new Int32Array(cl + 1);
    for (let i = 0; i < tp; i++) {
      const l = labels[i]; if (l === 0) continue;
      const cx = i % w, cy = (i / w) | 0;
      if (cx < sMinX[l]) sMinX[l] = cx; if (cx > sMaxX[l]) sMaxX[l] = cx;
      if (cy < sMinY[l]) sMinY[l] = cy; if (cy > sMaxY[l]) sMaxY[l] = cy;
      sArea[l]++;
    }
    const drop = new Uint8Array(cl + 1);
    for (let lb = 1; lb <= cl; lb++) {
      const cw = sMaxX[lb] - sMinX[lb] + 1, ch = sMaxY[lb] - sMinY[lb] + 1;
      if (sArea[lb] >= 200 && cw / Math.max(ch, 1) > 2.2 && cw / w > 0.20 && sMinY[lb] / h < 0.15 && sArea[lb] > cw * ch * 0.3) drop[lb] = 1;
    }
    for (let i = 0; i < tp; i++) { if (labels[i] > 0 && drop[labels[i]] === 1) mask[i] = 0; }
  },

  removeNoise(mask: Uint8Array, w: number, h: number): void {
    const tp = w * h;
    const labels = this.connectedComponents(mask, w, h);
    let cl = 0;
    for (let i = 0; i < tp; i++) if (labels[i] > cl) cl = labels[i];
    const sArea = new Int32Array(cl + 1);
    for (let i = 0; i < tp; i++) { const l = labels[i]; if (l > 0) sArea[l]++; }
    const minA = Math.max(6, (tp / 600000) | 0);
    for (let i = 0; i < tp; i++) { const l = labels[i]; if (l > 0 && sArea[l] < minA) mask[i] = 0; }
  },

  dilateMask(mask: Uint8Array, w: number, h: number, ks: number): void {
    const copy = new Uint8Array(mask);
    const off = (ks / 2) | 0;
    const offsets: [number, number][] = [];
    if (ks === 3) offsets.push([0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]);
    else if (ks === 5) {
      for (let kx = -2; kx <= 2; kx++) offsets.push([kx, 0]);
      for (let ky = -2; ky <= 2; ky++) { if (ky === 0) continue; offsets.push([-1, ky], [0, ky], [1, ky]); }
      offsets.push([-2, -1], [2, -1], [-2, 0], [2, 0], [-2, 1], [2, 1], [0, -2], [0, 2]);
    } else { for (let ky = -off; ky <= off; ky++) for (let kx = -off; kx <= off; kx++) offsets.push([kx, ky]); }
    for (let y = off; y < h - off; y++) { const ro = y * w;
      for (let x = off; x < w - off; x++) {
        if (copy[ro + x] === 1) for (const [kx, ky] of offsets) mask[(y + ky) * w + (x + kx)] = 1; } }
  },

  unsharpMask(data: Uint8ClampedArray, w: number, h: number, amt: number): void {
    const cp = new Uint8ClampedArray(data);
    for (let y = 1; y < h - 1; y++) { const ro = y * w * 4, pro = (y - 1) * w * 4, nro = (y + 1) * w * 4;
      for (let x = 1; x < w - 1; x++) { const idx = ro + x * 4;
        for (let c = 0; c < 3; c++) { const ctr = cp[idx + c];
          const lap = 4 * ctr - cp[pro + x * 4 + c] - cp[nro + x * 4 + c] - cp[idx - 4 + c] - cp[idx + 4 + c];
          const en = ctr + amt * lap; data[idx + c] = en < 0 ? 0 : en > 255 ? 255 : (en + 0.5) | 0; } } }
  },

  unsharpMaskBW(data: Uint8ClampedArray, w: number, h: number, amt: number): void {
    const cp = new Uint8ClampedArray(data);
    for (let y = 1; y < h - 1; y++) { const ro = y * w * 4, pro = (y - 1) * w * 4, nro = (y + 1) * w * 4;
      for (let x = 1; x < w - 1; x++) { const idx = ro + x * 4;
        const ctr = cp[idx];
        const lap = 4 * ctr - cp[pro + x * 4] - cp[nro + x * 4] - cp[idx - 4] - cp[idx + 4];
        const en = ctr + amt * lap; const v = en < 0 ? 0 : en > 255 ? 255 : (en + 0.5) | 0;
        data[idx] = v; data[idx + 1] = v; data[idx + 2] = v; } }
  },

  inkCoverage(data: Uint8ClampedArray, pixelCount: number, threshold: number): number {
    const st = Math.max(1, Math.floor(Math.sqrt(pixelCount / 50000)));
    let nw = 0, sm = 0;
    for (let i = 0; i < data.length; i += 4 * st) {
      if (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] < threshold) nw++; sm++;
    }
    return Number(((nw / sm) * 100).toFixed(1));
  },

  enhanceFaded(data: Uint8ClampedArray, width: number, height: number, intensity: number, binarizeThreshold: number): void {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { enhanceFadedDocument: _enhance } = require('../kernels/enhance');
    _enhance(data, width, height, { intensity, binarizeThreshold });
  },
};
