import { getLuminance } from './luminance';
import { rgbToHsv } from './hsv';
import { stripDecorativeFills, removeNoise } from './noise';
import { applyMaskDilation, setDilationHook } from './maskOps';
import { applyUnsharpMask, setUnsharpHook } from './sharpen';
import type { IWasmKernels } from '../wasm/types';

let wasmKernels: IWasmKernels | null = null;

export function setWasmKernelsHooks(kernels: IWasmKernels): void {
  wasmKernels = kernels;
  setDilationHook((mask, w, h, ks) => kernels.dilateMask(mask, w, h, ks));
  setUnsharpHook((data, w, h, amt) => kernels.unsharpMask(data, w, h, amt));
}

export function clearWasmKernelsHooks(): void {
  wasmKernels = null;
  setDilationHook(null);
  setUnsharpHook(null);
}

export function setWasmHooks(
  dilation: (mask: Uint8Array, w: number, h: number, ks: number) => void,
  unsharp: (data: Uint8ClampedArray, w: number, h: number, amt: number) => void,
): void {
  setDilationHook(dilation);
  setUnsharpHook(unsharp);
}

export interface KernelProcessResult {
  buffer: ArrayBuffer;
  width: number;
  height: number;
}

export function processPage(
  srcData: Uint8ClampedArray,
  width: number,
  height: number,
  params: {
    invertMode: string;
    bannerCropTopPct: number;
    bannerCropBottomPct: number;
    strokeEnhancement?: string;
    sharpenAmount: number;
  },
  profile: { classification: string; darkBackgroundRatio: number }
): KernelProcessResult {
  const sw = width, sh = height;
  const ct = Math.floor(sh * (params.bannerCropTopPct / 100));
  const cb = Math.floor(sh * (params.bannerCropBottomPct / 100));
  const dw = sw, dh = Math.max(10, sh - ct - cb);
  const dst = new Uint8ClampedArray(dw * dh * 4);
  const convertColors = params.invertMode === 'smart';
  const isDark = profile.classification === 'DARK_SLIDE' || profile.darkBackgroundRatio > 0.4;
  const shouldProcess = params.invertMode !== 'none' || isDark;
  if (!shouldProcess) {
    for (let y = 0; y < dh; y++) { const sro = (y + ct) * sw * 4, dro = y * dw * 4;
      for (let x = 0; x < dw; x++) { const si = sro + x * 4, di = dro + x * 4;
        dst[di] = srcData[si]; dst[di + 1] = srcData[si + 1]; dst[di + 2] = srcData[si + 2]; dst[di + 3] = 255; } }
    return { buffer: dst.buffer, width: dw, height: dh };
  }
  const tp = dw * dh; const fm = new Uint8Array(tp);
  if (convertColors && wasmKernels) {
    const cropped = srcData.subarray(ct * sw * 4, (ct + dh) * sw * 4);
    const hsv = wasmKernels.rgbToHsvBatch(cropped, dw * dh);
    const channels = wasmKernels.classifyColors(hsv, dw * dh);
    for (let c = 0; c < 7; c++) {
      const cm = new Uint8Array(tp);
      let hasData = false;
      for (let i = 0; i < tp; i++) {
        if (channels[i * 7 + c] === 1) { cm[i] = 1; hasData = true; }
      }
      if (hasData) {
        wasmKernels.stripDecorativeFills(cm, dw, dh);
        for (let i = 0; i < tp; i++) if (cm[i] === 1) fm[i] = 1;
      }
    }
  } else if (convertColors) {
    const hsv: [number, number, number] = [0, 0, 0];
    const cm: Uint8Array[] = []; const cf: boolean[] = [false, false, false, false, false, false, false];
    for (let c = 0; c < 7; c++) cm.push(new Uint8Array(tp));
    for (let y = 0; y < dh; y++) { const sro = (y + ct) * sw * 4, dro = y * dw;
      for (let x = 0; x < dw; x++) { const si = sro + x * 4;
        rgbToHsv(srcData[si], srcData[si + 1], srcData[si + 2], hsv);
        const h = hsv[0], s = hsv[1], v = hsv[2];
        if (v < 70) continue; const pi = dro + x;
        if (s < 55 && v > 155) { cm[0][pi] = 1; cf[0] = true; }
        if (h >= 15 && h <= 35 && s > 80 && v > 100) { cm[1][pi] = 1; cf[1] = true; }
        if (h >= 36 && h <= 85 && s > 55 && v > 75) { cm[2][pi] = 1; cf[2] = true; }
        if (h >= 86 && h <= 105 && s > 55 && v > 75) { cm[3][pi] = 1; cf[3] = true; }
        if (h >= 106 && h <= 135 && s > 55 && v > 65) { cm[4][pi] = 1; cf[4] = true; }
        if (h >= 136 && h <= 175 && s > 55 && v > 75) { cm[5][pi] = 1; cf[5] = true; }
        if (((h <= 15) || (h >= 175)) && s > 75 && v > 95) { cm[6][pi] = 1; cf[6] = true; } } }
    for (let c = 0; c < 7; c++) {
      if (cf[c]) { stripDecorativeFills(cm[c], dw, dh); for (let i = 0; i < tp; i++) if (cm[c][i] === 1) fm[i] = 1; } }
  } else {
    for (let y = 0; y < dh; y++) { const sro = (y + ct) * sw * 4, dro = y * dw;
      for (let x = 0; x < dw; x++) { const si = sro + x * 4;
        if (getLuminance(srcData[si], srcData[si + 1], srcData[si + 2]) >= 70) fm[dro + x] = 1; } }
  }
  if (params.strokeEnhancement !== 'none') applyMaskDilation(fm, dw, dh, params.strokeEnhancement === 'strong' ? 5 : 3);
  if (wasmKernels) {
    wasmKernels.removeNoise(fm, dw, dh);
  } else {
    removeNoise(fm, dw, dh);
  }
  for (let i = 0; i < tp; i++) { const di = i * 4, val = fm[i] === 1 ? 0 : 255;
    dst[di] = val; dst[di + 1] = val; dst[di + 2] = val; dst[di + 3] = 255; }
  if (params.sharpenAmount > 0) applyUnsharpMask(dst, dw, dh, params.sharpenAmount / 100);
  return { buffer: dst.buffer, width: dw, height: dh };
}

export function createImageDataFromBuffer(
  buffer: ArrayBuffer,
  width: number,
  height: number,
  data?: Uint8ClampedArray<ArrayBuffer>
): ImageData {
  const clamped: Uint8ClampedArray<ArrayBuffer> = data ?? new Uint8ClampedArray(buffer);
  return new ImageData(clamped, width, height);
}
