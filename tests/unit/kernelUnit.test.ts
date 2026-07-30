import { describe, it, expect, beforeEach } from 'vitest';
import { getLuminance } from '../../lib/kernels/luminance';
import { rgbToHsv } from '../../lib/kernels/hsv';
import { ensureCC, getCCLabels, getCCQueue } from '../../lib/kernels/connectedComponents';
import { applyMaskDilation, setDilationHook } from '../../lib/kernels/maskOps';
import { applyUnsharpMask, setUnsharpHook } from '../../lib/kernels/sharpen';
import { detectBanners } from '../../lib/kernels/bannerDetection';
import { calculateInkCoverage } from '../../lib/kernels/inkCoverage';
import { stripDecorativeFills, removeNoise } from '../../lib/kernels/noise';
import { setWasmKernelsHooks, clearWasmKernelsHooks, setWasmHooks, processPage, createImageDataFromBuffer } from '../../lib/kernels/processPage';
import type { IWasmKernels } from '../../lib/wasm/types';

describe('getLuminance', () => {
  it('returns 0 for black', () => {
    expect(getLuminance(0, 0, 0)).toBe(0);
  });
  it('returns 255 for white', () => {
    expect(getLuminance(255, 255, 255)).toBe(255);
  });
  it('weighs green more than red', () => {
    expect(getLuminance(0, 255, 0)).toBeGreaterThan(getLuminance(255, 0, 0));
  });
});

describe('rgbToHsv', () => {
  it('converts red to H~0', () => {
    const out: [number, number, number] = [0, 0, 0];
    rgbToHsv(255, 0, 0, out);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(255);
    expect(out[2]).toBe(255);
  });
  it('converts green to H~60 (120deg * 0.5)', () => {
    const out: [number, number, number] = [0, 0, 0];
    rgbToHsv(0, 255, 0, out);
    expect(out[0]).toBe(60);
    expect(out[1]).toBe(255);
    expect(out[2]).toBe(255);
  });
  it('converts white to S=0', () => {
    const out: [number, number, number] = [0, 0, 0];
    rgbToHsv(255, 255, 255, out);
    expect(out[1]).toBe(0);
    expect(out[2]).toBe(255);
  });
  it('converts black to V=0', () => {
    const out: [number, number, number] = [0, 0, 0];
    rgbToHsv(0, 0, 0, out);
    expect(out[2]).toBe(0);
  });
});

describe('ensureCC / getCCLabels / getCCQueue', () => {
  beforeEach(() => { ensureCC(10); });
  it('allocates buffers on first call', () => {
    ensureCC(100);
    expect(getCCLabels().length).toBe(100);
    expect(getCCQueue().length).toBe(100);
  });
  it('re-allocates when size exceeds capacity', () => {
    ensureCC(100);
    ensureCC(200);
    expect(getCCLabels().length).toBe(200);
  });
  it('fills existing buffer with zeros when size fits', () => {
    ensureCC(100);
    getCCLabels()[25] = 99;
    ensureCC(50);
    expect(getCCLabels()[25]).toBe(0);
    expect(getCCLabels()[60]).toBe(0);
    expect(getCCLabels().length).toBe(200);
  });
});

describe('applyMaskDilation', () => {
  it('dilates a single pixel to a cross with ks=3', () => {
    const mask = new Uint8Array(25);
    mask[12] = 1;
    applyMaskDilation(mask, 5, 5, 3);
    const dilated = [7, 11, 12, 13, 17];
    for (let i = 0; i < 25; i++) {
      if (dilated.includes(i)) expect(mask[i]).toBe(1);
      else expect(mask[i]).toBe(0);
    }
  });
  it('dilates a single pixel to a diamond with ks=5', () => {
    const mask = new Uint8Array(25);
    mask[12] = 1;
    applyMaskDilation(mask, 5, 5, 5);
    const nonZero: number[] = [];
    for (let i = 0; i < 25; i++) if (mask[i] === 1) nonZero.push(i);
    expect(nonZero.length).toBeGreaterThan(5);
    expect(nonZero.length).toBeLessThan(25);
  });
  it('delegates to hook when set', () => {
    const mask = new Uint8Array(9);
    mask[4] = 1;
    let called = false;
    setDilationHook((_m, _w, _h, _ks) => { called = true; _m[0] = 1; });
    applyMaskDilation(mask, 3, 3, 3);
    expect(called).toBe(true);
    expect(mask[0]).toBe(1);
    setDilationHook(null);
  });
});

describe('applyUnsharpMask', () => {
  it('leaves uniform pixels unchanged', () => {
    const data = new Uint8ClampedArray(16);
    for (let i = 0; i < 12; i++) data[i] = 128;
    data[12] = 255; data[13] = 255; data[14] = 255; data[15] = 255;
    applyUnsharpMask(data, 2, 2, 0.5);
    expect(data[0]).toBe(128);
    expect(data[12]).toBe(255);
  });
  it('delegates to hook when set', () => {
    const data = new Uint8ClampedArray(16).fill(128);
    let called = false;
    setUnsharpHook((_d, _w, _h, _amt) => { called = true; _d[0] = 0; });
    applyUnsharpMask(data, 2, 2, 0.5);
    expect(called).toBe(true);
    expect(data[0]).toBe(0);
    setUnsharpHook(null);
  });
});

describe('detectBanners', () => {
  it('returns zero top banners for bright page (top requires dark)', () => {
    const data = new Uint8ClampedArray(100 * 100 * 4);
    for (let i = 0; i < data.length; i += 4) { data[i] = 240; data[i + 1] = 240; data[i + 2] = 240; data[i + 3] = 255; }
    const result = detectBanners(data, 100, 100);
    expect(result.topBannerPct).toBe(0);
  });
  it('detects dark top banner', () => {
    const data = new Uint8ClampedArray(100 * 100 * 4);
    for (let i = 0; i < data.length; i += 4) { data[i] = 240; data[i + 1] = 240; data[i + 2] = 240; data[i + 3] = 255; }
    for (let y = 0; y < 15; y++) for (let x = 0; x < 100; x++) { const idx = (y * 100 + x) * 4; data[idx] = 30; data[idx+1] = 30; data[idx+2] = 30; }
    const result = detectBanners(data, 100, 100);
    expect(result.topBannerPct).toBeGreaterThan(0);
    expect(result.topBannerPct).toBeLessThan(0.25);
  });
});

describe('calculateInkCoverage', () => {
  it('returns 0 for white image', () => {
    const data = new Uint8ClampedArray(100 * 100 * 4);
    for (let i = 0; i < data.length; i += 4) { data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255; }
    expect(calculateInkCoverage(data)).toBe(0);
  });
  it('returns 100 for black image', () => {
    const data = new Uint8ClampedArray(100 * 100 * 4);
    for (let i = 0; i < data.length; i += 4) { data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255; }
    expect(calculateInkCoverage(data)).toBe(100);
  });
  it('returns ~50 for 50% ink', () => {
    const w = 100, h = 100;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { const idx = i * 4; const fill = i % 2 === 0 ? 0 : 255;
      data[idx] = fill; data[idx + 1] = fill; data[idx + 2] = fill; data[idx + 3] = 255; }
    const cov = calculateInkCoverage(data);
    expect(cov).toBeGreaterThan(35);
    expect(cov).toBeLessThan(65);
  });
});

describe('stripDecorativeFills', () => {
  it('removes wide top banner but keeps center content', () => {
    const w = 50, h = 50;
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) { const y = Math.floor(i / w); if (y < 5) mask[i] = 1; }
    mask[12 * w + 25] = 1;
    stripDecorativeFills(mask, w, h);
    const topRemains = Array.from(mask.slice(0, 5 * w)).filter(v => v === 1).length;
    expect(topRemains).toBe(0);
    expect(mask[12 * w + 25]).toBe(1);
  });
});

describe('removeNoise', () => {
  it('removes small isolated pixels but keeps large clusters', () => {
    const w = 50, h = 50;
    const mask = new Uint8Array(w * h);
    mask[w + 25] = 1;
    for (let y = 20; y < 30; y++) for (let x = 20; x < 30; x++) mask[y * w + x] = 1;
    removeNoise(mask, w, h);
    expect(mask[w + 25]).toBe(0);
    for (let y = 20; y < 30; y++) expect(mask[y * w + 20]).toBe(1);
  });
});

describe('WASM hooks', () => {
  it('setWasmHooks should set dilation and unsharp hooks', () => {
    let dCalled = false, uCalled = false;
    setWasmHooks(
      () => { dCalled = true; },
      () => { uCalled = true; },
    );
    const mask = new Uint8Array(9); mask[4] = 1;
    applyMaskDilation(mask, 3, 3, 3);
    expect(dCalled).toBe(true);
    const data = new Uint8ClampedArray(16).fill(128);
    applyUnsharpMask(data, 2, 2, 0.5);
    expect(uCalled).toBe(true);
    setDilationHook(null);
    setUnsharpHook(null);
  });
  it('clearWasmKernelsHooks should revert to JS fallback', () => {
    const fakeKernels: Partial<IWasmKernels> = {
      dilateMask: () => { throw new Error('should not be called'); },
      unsharpMask: () => { throw new Error('should not be called'); },
    };
    setWasmKernelsHooks(fakeKernels as IWasmKernels);
    clearWasmKernelsHooks();
    const mask = new Uint8Array(9); mask[4] = 1;
    expect(() => applyMaskDilation(mask, 3, 3, 3)).not.toThrow();
  });
});

describe('processPage edge cases', () => {
  it('handles invertMode=none with crop', () => {
    const w = 20, h = 20;
    const src = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < src.length; i += 4) { src[i] = 200; src[i+1] = 200; src[i+2] = 200; src[i+3] = 255; }
    const result = processPage(src, w, h, { invertMode: 'none', bannerCropTopPct: 10, bannerCropBottomPct: 10, sharpenAmount: 0 }, { classification: 'LIGHT_SLIDE', darkBackgroundRatio: 0 });
    expect(result.width).toBe(w);
    expect(result.height).toBe(16);
  });
  it('handles invertMode=smart dark slide without WASM', () => {
    const w = 16, h = 16;
    const src = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { const idx = i * 4; const dark = Math.random() > 0.8 ? 255 : 30;
      src[idx] = dark; src[idx+1] = dark; src[idx+2] = dark; src[idx+3] = 255; }
    const result = processPage(src, w, h, { invertMode: 'smart', bannerCropTopPct: 0, bannerCropBottomPct: 0, strokeEnhancement: 'none', sharpenAmount: 0 }, { classification: 'DARK_SLIDE', darkBackgroundRatio: 0.6 });
    expect(result.width).toBe(w);
    expect(result.height).toBe(h);
    expect(result.buffer.byteLength).toBeGreaterThan(0);
  });
  it('creates ImageData from buffer', () => {
    const buf = new ArrayBuffer(16 * 16 * 4);
    const img = createImageDataFromBuffer(buf, 16, 16);
    expect(img.width).toBe(16);
    expect(img.height).toBe(16);
    expect(img.data.length).toBe(16 * 16 * 4);
  });
});
