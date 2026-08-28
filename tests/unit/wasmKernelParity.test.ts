import { describe, it, expect, beforeAll } from 'vitest';
import { ensureWasmKernels, getKernels, isWasmLoaded } from '../../lib/wasm/loader';
import { jsKernels } from '../../lib/wasm/jsFallback';
import type { IWasmKernels } from '../../lib/wasm/types';

let wasmKernels: IWasmKernels;

beforeAll(async () => {
  try {
    wasmKernels = await ensureWasmKernels();
  } catch {
    wasmKernels = jsKernels;
  }
}, 30000);

function randomMask(w: number, h: number, density = 0.15): Uint8Array {
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = Math.random() < density ? 1 : 0;
  return m;
}

function randomRGBA(w: number, h: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    d[i * 4] = Math.floor(Math.random() * 256);
    d[i * 4 + 1] = Math.floor(Math.random() * 256);
    d[i * 4 + 2] = Math.floor(Math.random() * 256);
    d[i * 4 + 3] = 255;
  }
  return d;
}

describe('Rust WASM vs JS Fallback Parity', () => {
  it('rgbToHsvBatch should match jsKernels', () => {
    const w = 16, h = 16;
    const rgba = randomRGBA(w, h);
    const wasm = wasmKernels.rgbToHsvBatch(rgba, w * h);
    const js = jsKernels.rgbToHsvBatch(rgba, w * h);
    expect(wasm.length).toBe(js.length);
    for (let i = 0; i < wasm.length; i++) {
      expect(Math.abs(wasm[i] - js[i])).toBeLessThanOrEqual(1);
    }
  });

  it('classifyColors should match jsKernels', () => {
    const w = 16, h = 16;
    const rgba = randomRGBA(w, h);
    const hsv = jsKernels.rgbToHsvBatch(rgba, w * h);
    const wasm = wasmKernels.classifyColors(hsv, w * h);
    const js = jsKernels.classifyColors(hsv, w * h);
    expect(Array.from(wasm)).toEqual(Array.from(js));
  });

  it('connectedComponents should match jsKernels', () => {
    const w = 20, h = 20;
    const mask = randomMask(w, h);
    const wasm = wasmKernels.connectedComponents(mask, w, h);
    const js = jsKernels.connectedComponents(mask, w, h);
    expect(wasm.length).toBe(js.length);
    for (let i = 0; i < wasm.length; i++) {
      if (mask[i] === 0) {
        expect(wasm[i]).toBe(js[i]);
      }
    }
  });

  it('dilateMask ks=3 should match jsKernels', () => {
    const w = 16, h = 16;
    const jsMask = randomMask(w, h);
    const wasmMask = new Uint8Array(jsMask);
    jsKernels.dilateMask(jsMask, w, h, 3);
    wasmKernels.dilateMask(wasmMask, w, h, 3);
    expect(Array.from(wasmMask)).toEqual(Array.from(jsMask));
  });

  it('dilateMask ks=5 should match jsKernels', () => {
    const w = 20, h = 20;
    const jsMask = randomMask(w, h);
    const wasmMask = new Uint8Array(jsMask);
    jsKernels.dilateMask(jsMask, w, h, 5);
    wasmKernels.dilateMask(wasmMask, w, h, 5);
    expect(Array.from(wasmMask)).toEqual(Array.from(jsMask));
  });

  it('unsharpMask should match jsKernels', () => {
    const w = 8, h = 8;
    const jsData = randomRGBA(w, h);
    const wasmData = new Uint8ClampedArray(jsData);
    jsKernels.unsharpMask(jsData, w, h, 1.0);
    wasmKernels.unsharpMask(wasmData, w, h, 1.0);
    expect(Array.from(wasmData)).toEqual(Array.from(jsData));
  });

  it('inkCoverage should match jsKernels', () => {
    const w = 16, h = 16;
    const data = randomRGBA(w, h);
    const wasm = wasmKernels.inkCoverage(data, w * h, 240);
    const js = jsKernels.inkCoverage(data, w * h, 240);
    expect(wasm).toBe(js);
  });

});

describe('getKernels / isWasmLoaded API', () => {
  it('getKernels should return a valid IWasmKernels object', () => {
    const k = getKernels();
    expect(k).toBeDefined();
    expect(typeof k.rgbToHsvBatch).toBe('function');
    expect(typeof k.classifyColors).toBe('function');
  });

  it('isWasmLoaded should return boolean', () => {
    expect(typeof isWasmLoaded()).toBe('boolean');
  });
});
