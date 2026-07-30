import { describe, it, expect, beforeAll } from 'vitest';
import { applyMaskDilation as jsDilation, applyUnsharpMask as jsUnsharp } from '../../lib/optimizer/worker/kernels';
import { ensureWasm, applyMaskDilation as wasmDilation, applyUnsharpMask as wasmUnsharp } from '../../lib/optimizer/wasm/wasmRuntime';
import { setWasmHooks, applyMaskDilation as hookedDilation, applyUnsharpMask as hookedUnsharp } from '../../lib/optimizer/worker/kernels';

beforeAll(async () => {
  await ensureWasm();
  setWasmHooks(wasmDilation, wasmUnsharp);
}, 30000);

describe('WASM vs JS parity', () => {
  it('applyMaskDilation ks=3 should match JS output', () => {
    const w = 16, h = 16;
    const jsMask = new Uint8Array(w * h);
    const wasmMask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const v = Math.random() > 0.85 ? 1 : 0;
      jsMask[i] = v; wasmMask[i] = v;
    }
    jsDilation(jsMask, w, h, 3);
    wasmDilation(wasmMask, w, h, 3);
    expect(Array.from(wasmMask)).toEqual(Array.from(jsMask));
  });

  it('applyMaskDilation ks=5 should match JS output', () => {
    const w = 20, h = 20;
    const jsMask = new Uint8Array(w * h);
    const wasmMask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const v = Math.random() > 0.9 ? 1 : 0;
      jsMask[i] = v; wasmMask[i] = v;
    }
    jsDilation(jsMask, w, h, 5);
    wasmDilation(wasmMask, w, h, 5);
    expect(Array.from(wasmMask)).toEqual(Array.from(jsMask));
  });

  it('applyUnsharpMask should match JS output', () => {
    const w = 8, h = 8;
    const jsData = new Uint8ClampedArray(w * h * 4);
    const wasmData = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const r = Math.floor(Math.random() * 256);
      const g = Math.floor(Math.random() * 256);
      const b = Math.floor(Math.random() * 256);
      jsData[i * 4] = r; jsData[i * 4 + 1] = g; jsData[i * 4 + 2] = b; jsData[i * 4 + 3] = 255;
      wasmData[i * 4] = r; wasmData[i * 4 + 1] = g; wasmData[i * 4 + 2] = b; wasmData[i * 4 + 3] = 255;
    }
    jsUnsharp(jsData, w, h, 1.0);
    wasmUnsharp(wasmData, w, h, 1.0);
    expect(Array.from(wasmData)).toEqual(Array.from(jsData));
  });

  it('hooked applyMaskDilation should use WASM and produce correct output', () => {
    const w = 10, h = 10;
    const mask = new Uint8Array(w * h);
    mask[5 * w + 5] = 1;
    const copy = new Uint8Array(mask);
    jsDilation(copy, w, h, 3);
    hookedDilation(mask, w, h, 3);
    expect(Array.from(mask)).toEqual(Array.from(copy));
  });

  it('unsharp mask with amt=0 should produce identical output (no sharpening)', () => {
    const w = 6, h = 6;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = 100; data[i * 4 + 1] = 150; data[i * 4 + 2] = 200; data[i * 4 + 3] = 255;
    }
    data[3 * w * 4 + 3 * 4] = 50;
    const copy = new Uint8ClampedArray(data);
    jsUnsharp(copy, w, h, 0);
    wasmUnsharp(data, w, h, 0);
    expect(Array.from(data)).toEqual(Array.from(copy));
  });
});
