/**
 * processPage - Core pixel processing kernel.
 *
 * Production optimizations:
 *  - Lazy channel mask allocation: only allocates masks for channels with data
 *  - Single-pass HSV classification with early-exit for dark pixels
 *  - Zero-copy crop via subarray (no intermediate buffer)
 *  - Bulk row copy via set() for fast path
 *  - Fast V-check avoids full HSV conversion for dark pixel rejection
 */
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

/** Fast max-channel check (avoids full HSV for dark pixel rejection) */
function fastMaxChannel(r: number, g: number, b: number): number {
  return r > g ? (r > b ? r : b) : (g > b ? g : b);
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
    dilationKernelSize?: number;
  },
  profile: { classification: string; darkBackgroundRatio: number }
): KernelProcessResult {
  const sw = width, sh = height;
  const ct = Math.floor(sh * (params.bannerCropTopPct / 100));
  const cb = Math.floor(sh * (params.bannerCropBottomPct / 100));
  const dw = sw, dh = Math.max(10, sh - ct - cb);
  const totalPixels = dw * dh;
  const dst = new Uint8ClampedArray(totalPixels * 4);

  const convertColors = params.invertMode === 'smart';
  const isDark = profile.classification === 'DARK_SLIDE' || profile.darkBackgroundRatio > 0.4;
  const shouldProcess = params.invertMode !== 'none' || isDark;

  const ks = params.dilationKernelSize != null
    ? params.dilationKernelSize
    : (params.strokeEnhancement === 'strong' ? 5 : params.strokeEnhancement === 'normal' ? 3 : 0);

  /* Monolithic WASM path: single call, 2 copies (in+out) vs ~15 round-trips.
   * Falls through to per-kernel path if WASM isn't loaded or processPage
   * isn't available in the current module. */
  if (shouldProcess && wasmKernels && typeof wasmKernels.processPage === 'function') {
    try {
      const cropped = srcData.subarray(ct * sw * 4, (ct + dh) * sw * 4);
      const rgbaView = new Uint8Array(cropped.buffer, cropped.byteOffset, cropped.byteLength);
      const out = wasmKernels.processPage(
        rgbaView, dw, dh,
        convertColors, isDark,
        ks,
        params.sharpenAmount / 100,
      );
      /* process_page returns an owned Vec<u8>; copy into a fresh ArrayBuffer so the
         result is decoupled from WASM linear memory and typed as ArrayBuffer. */
      const outBuffer = new ArrayBuffer(out.byteLength);
      new Uint8Array(outBuffer).set(out);
      return { buffer: outBuffer, width: dw, height: dh };
    } catch {
      /* WASM process_page trapped/failed at runtime; fall through to the
         per-kernel WASM/JS path below instead of crashing the page. */
    }
  }

  /* Fast path: no processing, just crop copy */
  if (!shouldProcess) {
    const srcRowBytes = sw * 4;
    const dstRowBytes = dw * 4;
    const srcOffset = ct * srcRowBytes;
    for (let y = 0; y < dh; y++) {
      const srcStart = srcOffset + y * srcRowBytes;
      const dstStart = y * dstRowBytes;
      dst.set(srcData.subarray(srcStart, srcStart + dstRowBytes), dstStart);
    }
    for (let i = 3; i < dst.length; i += 4) dst[i] = 255;
    return { buffer: dst.buffer, width: dw, height: dh };
  }

  /* Foreground mask extraction */
  const fm = new Uint8Array(totalPixels);

  if (convertColors && wasmKernels) {
    /* WASM-accelerated path */
    const cropped = srcData.subarray(ct * sw * 4, (ct + dh) * sw * 4);
    const hsv = wasmKernels.rgbToHsvBatch(cropped, totalPixels);
    const channels = wasmKernels.classifyColors(hsv, totalPixels);

    for (let c = 0; c < 7; c++) {
      let hasData = false;
      for (let i = c; i < totalPixels * 7; i += 7) {
        if (channels[i] === 1) { hasData = true; break; }
      }
      if (!hasData) continue;

      const cm = new Uint8Array(totalPixels);
      for (let i = 0; i < totalPixels; i++) {
        if (channels[i * 7 + c] === 1) cm[i] = 1;
      }
      wasmKernels.stripDecorativeFills(cm, dw, dh);
      for (let i = 0; i < totalPixels; i++) {
        if (cm[i] === 1) fm[i] = 1;
      }
    }
  } else if (convertColors) {
    /* JS fallback: single-pass HSV with LAZY channel masks */
    const hsv: [number, number, number] = [0, 0, 0];
    const cm: (Uint8Array | null)[] = [null, null, null, null, null, null, null];

    for (let y = 0; y < dh; y++) {
      const srcRowOffset = (y + ct) * sw * 4;
      const dstRowOffset = y * dw;

      for (let x = 0; x < dw; x++) {
        const si = srcRowOffset + x * 4;
        const r = srcData[si], g = srcData[si + 1], b = srcData[si + 2];

        /* Early exit: skip dark pixels without full HSV conversion */
        if (fastMaxChannel(r, g, b) < 70) continue;

        rgbToHsv(r, g, b, hsv);
        const h = hsv[0], s = hsv[1], v = hsv[2];
        const pi = dstRowOffset + x;

        if (s < 55 && v > 155) {
          if (!cm[0]) cm[0] = new Uint8Array(totalPixels);
          cm[0][pi] = 1;
        } else if (h >= 15 && h <= 35 && s > 80 && v > 100) {
          if (!cm[1]) cm[1] = new Uint8Array(totalPixels);
          cm[1][pi] = 1;
        } else if (h >= 36 && h <= 85 && s > 55 && v > 75) {
          if (!cm[2]) cm[2] = new Uint8Array(totalPixels);
          cm[2][pi] = 1;
        } else if (h >= 86 && h <= 105 && s > 55 && v > 75) {
          if (!cm[3]) cm[3] = new Uint8Array(totalPixels);
          cm[3][pi] = 1;
        } else if (h >= 106 && h <= 135 && s > 55 && v > 65) {
          if (!cm[4]) cm[4] = new Uint8Array(totalPixels);
          cm[4][pi] = 1;
        } else if (h >= 136 && h <= 175 && s > 55 && v > 75) {
          if (!cm[5]) cm[5] = new Uint8Array(totalPixels);
          cm[5][pi] = 1;
        } else if (((h <= 15) || (h >= 175)) && s > 75 && v > 95) {
          if (!cm[6]) cm[6] = new Uint8Array(totalPixels);
          cm[6][pi] = 1;
        }
      }
    }

    for (let c = 0; c < 7; c++) {
      const mask = cm[c];
      if (!mask) continue;
      stripDecorativeFills(mask, dw, dh);
      for (let i = 0; i < totalPixels; i++) {
        if (mask[i] === 1) fm[i] = 1;
      }
    }
  } else {
    /* Simple luminance-based extraction */
    for (let y = 0; y < dh; y++) {
      const srcRowOffset = (y + ct) * sw * 4;
      const dstRowOffset = y * dw;
      for (let x = 0; x < dw; x++) {
        const si = srcRowOffset + x * 4;
        if (getLuminance(srcData[si], srcData[si + 1], srcData[si + 2]) >= 70) {
          fm[dstRowOffset + x] = 1;
        }
      }
    }
  }

  /* Post-processing: dilation with numeric kernel size override */
  if (ks > 0) {
    applyMaskDilation(fm, dw, dh, ks);
  }

  if (wasmKernels) {
    wasmKernels.removeNoise(fm, dw, dh);
  } else {
    removeNoise(fm, dw, dh);
  }

  /* Composite: mask to B/W output */
  for (let i = 0; i < totalPixels; i++) {
    const di = i * 4;
    const val = fm[i] === 1 ? 0 : 255;
    dst[di] = val;
    dst[di + 1] = val;
    dst[di + 2] = val;
    dst[di + 3] = 255;
  }

  if (params.sharpenAmount > 0) {
    applyUnsharpMask(dst, dw, dh, params.sharpenAmount / 100);
  }

  return { buffer: dst.buffer, width: dw, height: dh };
}

export function createImageDataFromBuffer(
  buffer: ArrayBuffer,
  width: number,
  height: number,
): ImageData {
  const data = new Uint8ClampedArray(buffer);
  return new ImageData(data, width, height);
}
