import type { IWasmKernels } from './types';
import { jsKernels } from './jsFallback';

let wasmModule: IWasmKernels | null = null;
let initPromise: Promise<IWasmKernels> | null = null;

async function loadWasm(): Promise<IWasmKernels | null> {
  try {
    const wasm = await import(/* @vite-ignore */ '../../wasm/pkg/npo_wasm.js');
    try {
      await wasm.default();
    } catch {
      const resp = await fetch('/wasm/npo_wasm_bg.wasm');
      const mod = await WebAssembly.compile(await resp.arrayBuffer());
      wasm.initSync({ module_or_path: mod });
    }
    const exports = wasm as {
      rgb_to_hsv_batch: (rgba: Uint8Array, pixel_count: number) => Float32Array;
      classify_colors: (hsv: Float32Array, pixel_count: number) => Uint8Array;
      connected_components: (mask: Uint8Array, width: number, height: number) => Int32Array;
      strip_decorative_fills: (mask: Uint8Array, width: number, height: number) => void;
      remove_noise: (mask: Uint8Array, width: number, height: number) => void;
      dilate_mask: (mask: Uint8Array, width: number, height: number, ks: number) => void;
      unsharp_mask: (data: Uint8Array, width: number, height: number, amt: number) => void;
      ink_coverage: (data: Uint8Array, pixel_count: number, threshold: number) => number;
    };
    return {
      rgbToHsvBatch(rgba: Uint8ClampedArray, pixelCount: number) {
        return exports.rgb_to_hsv_batch(new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength), pixelCount);
      },
      classifyColors(hsv: Float32Array, pixelCount: number) {
        return exports.classify_colors(hsv, pixelCount);
      },
      connectedComponents(mask: Uint8Array, w: number, h: number) {
        return exports.connected_components(mask, w, h);
      },
      stripDecorativeFills(mask: Uint8Array, w: number, h: number) {
        exports.strip_decorative_fills(mask, w, h);
      },
      removeNoise(mask: Uint8Array, w: number, h: number) {
        exports.remove_noise(mask, w, h);
      },
      dilateMask(mask: Uint8Array, w: number, h: number, ks: number) {
        exports.dilate_mask(mask, w, h, ks);
      },
      unsharpMask(data: Uint8ClampedArray, w: number, h: number, amt: number) {
        exports.unsharp_mask(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), w, h, amt);
      },
      inkCoverage(data: Uint8ClampedArray, pixelCount: number, threshold: number) {
        return exports.ink_coverage(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), pixelCount, threshold);
      },
    };
  } catch (e) {
    console.warn('[WASM] Failed to load wasm module, using JS fallback:', e);
    return null;
  }
}

export async function ensureWasmKernels(): Promise<IWasmKernels> {
  if (wasmModule) return wasmModule;
  if (initPromise) return initPromise;
  initPromise = loadWasm().then((mod) => {
    wasmModule = mod;
    return wasmModule ?? jsKernels;
  });
  return initPromise;
}

export function getKernels(): IWasmKernels {
  return wasmModule ?? jsKernels;
}

export function isWasmLoaded(): boolean {
  return wasmModule !== null;
}
