export interface IWasmKernels {
  rgbToHsvBatch(rgba: Uint8ClampedArray, pixelCount: number): Float32Array;
  classifyColors(hsv: Float32Array, pixelCount: number): Uint8Array;
  connectedComponents(mask: Uint8Array, w: number, h: number): Int32Array;
  stripDecorativeFills(mask: Uint8Array, w: number, h: number): void;
  removeNoise(mask: Uint8Array, w: number, h: number): void;
  dilateMask(mask: Uint8Array, w: number, h: number, ks: number): void;
  unsharpMask(data: Uint8ClampedArray, w: number, h: number, amt: number): void;
  inkCoverage(data: Uint8ClampedArray, pixelCount: number, threshold: number): number;
}
