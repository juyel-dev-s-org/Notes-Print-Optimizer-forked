import type { IWasmKernels } from './types';
import { jsKernels } from './jsFallback';

let wasmModule: IWasmKernels | null = null;
let initPromise: Promise<IWasmKernels> | null = null;

function basePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || '';
}

async function loadWasm(): Promise<IWasmKernels | null> {
  try {
    // The wasm-pack glue (npo_wasm.js) is served from public/wasm/.
    // `webpackIgnore` keeps this as a native runtime import (not bundled),
    // so the generated glue can be committed and served as a static asset.
    const glueUrl = `${basePath()}/wasm/npo_wasm.js`;
    const wasm = await import(/* webpackIgnore: true */ glueUrl);

    // Initialise the module. The default export fetches npo_wasm_bg.wasm
    // relative to the glue file (same public/wasm/ directory).
    if (typeof wasm.default === 'function') {
      try {
        await wasm.default();
      } catch {
        // Fallback: compile the binary ourselves and hand it to initSync.
        const resp = await fetch(`${basePath()}/wasm/npo_wasm_bg.wasm`);
        const mod = await WebAssembly.compile(await resp.arrayBuffer());
        wasm.initSync({ module_or_path: mod });
      }
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
      process_page: (rgba: Uint8Array, width: number, height: number, invert_mode_smart: boolean, is_dark: boolean, dilation_ks: number, sharpen_amount: number) => Uint8Array;
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
      processPage(rgba: Uint8Array, width: number, height: number, invertModeSmart: boolean, isDark: boolean, dilationKs: number, sharpenAmount: number) {
        return exports.process_page(rgba, width, height, invertModeSmart, isDark, dilationKs, sharpenAmount);
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
