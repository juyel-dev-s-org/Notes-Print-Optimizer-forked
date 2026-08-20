export interface IWasmKernels {
  rgbToHsvBatch(rgba: Uint8ClampedArray, pixelCount: number): Float32Array;
  classifyColors(hsv: Float32Array, pixelCount: number): Uint8Array;
  /**
   * Single-pass HSV classification: OR of all 7 channel decisions, one byte
   * per pixel. Byte-identical to rgbToHsvBatch + classifyColors + OR without
   * the intermediate buffers. Optional: older binaries lack it; callers
   * feature-detect with `typeof kernels.classifyFused === 'function'`.
   */
  classifyFused?(rgba: Uint8ClampedArray, pixelCount: number): Uint8Array;
  connectedComponents(mask: Uint8Array, w: number, h: number): Int32Array;
  stripDecorativeFills(mask: Uint8Array, w: number, h: number): void;
  removeNoise(mask: Uint8Array, w: number, h: number): void;
  dilateMask(mask: Uint8Array, w: number, h: number, ks: number): void;
  unsharpMask(data: Uint8ClampedArray, w: number, h: number, amt: number): void;
  /**
   * 1-channel unsharp for strictly B/W data (R=G=B). Optional: older binaries
   * may lack it; callers feature-detect with `typeof kernels.unsharpMaskBW === 'function'`.
   */
  unsharpMaskBW?(data: Uint8ClampedArray, w: number, h: number, amt: number): void;
  inkCoverage(data: Uint8ClampedArray, pixelCount: number, threshold: number): number;
  /**
   * Monolithic end-to-end page pipeline (WASM-only optimisation).
   * Optional: the JS fallback processes step-by-step via lib/kernels instead,
   * so callers must feature-detect with `typeof kernels.processPage === 'function'`.
   */
  processPage?(
    rgba: Uint8Array,
    width: number,
    height: number,
    invertModeSmart: boolean,
    isDark: boolean,
    dilationKs: number,
    sharpenAmount: number
  ): Uint8Array;
}
