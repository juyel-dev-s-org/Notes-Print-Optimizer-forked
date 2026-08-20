/**
 * Unit tests for the Enhance Light PDF kernel pipeline (pure functions).
 *
 * Synthetic pages: uniform-light "paper" with faint/dark "ink" bands.
 * All expectations follow the pipeline contract:
 *  - background at/above (p95 - 12) maps to pure white when cleanBackground
 *  - ink below (p95 - 30) is lifted toward black by darken
 *  - sharpen = 0 leaves the tonal result byte-identical
 *  - identical input + settings => identical output (determinism)
 */

import { describe, expect, it } from 'vitest';
import { enhanceImageData, computeLumaStats } from '@/lib/enhance/enhanceKernels';
import type { EnhanceSettings } from '@/lib/enhance/types';

const W = 16;
const H = 16;

function makePage(paperLuma: number, inkLuma: number, inkPixels = 8): ImageData {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    data[i * 4] = paperLuma;
    data[i * 4 + 1] = paperLuma;
    data[i * 4 + 2] = paperLuma;
    data[i * 4 + 3] = 255;
  }
  for (let i = 0; i < inkPixels; i++) {
    data[i * 4] = inkLuma;
    data[i * 4 + 1] = inkLuma;
    data[i * 4 + 2] = inkLuma;
    data[i * 4 + 3] = 255;
  }
  return new ImageData(data, W, H);
}

const baseSettings: EnhanceSettings = {
  darken: 50,
  contrast: 30,
  sharpen: 0,
  cleanBackground: true,
  grayscale: false,
};

describe('computeLumaStats', () => {
  it('finds the background estimate at p95', () => {
    const page = makePage(200, 60, 4); // 4/256 ink pixels ≈ 1.6%
    const { p1, p95 } = computeLumaStats(page.data);
    expect(p95).toBe(200);
    expect(p1).toBe(60);
  });

  it('handles a pure-white page', () => {
    const page = makePage(255, 255, 0);
    const { p95 } = computeLumaStats(page.data);
    expect(p95).toBe(255);
  });
});

describe('enhanceImageData — background cleaning', () => {
  it('maps near-background paper tint to pure white', () => {
    const page = makePage(205, 90, 6); // slightly gray paper, faint ink
    const out = enhanceImageData(page, baseSettings);
    const counts = { white: 0, dark: 0 };
    for (let i = 0; i < out.data.length; i += 4) {
      const v = out.data[i];
      if (v === 255) counts.white++;
      else if (v < 130) counts.dark++;
    }
    // 256 - 6 ink pixels => 250 pure white
    expect(counts.white).toBe(250);
    expect(counts.dark).toBe(6);
  });

  it('keeps genuinely dark ink dark', () => {
    const page = makePage(245, 30, 8);
    const out = enhanceImageData(page, baseSettings);
    for (let i = 0; i < 8 * 4; i += 4) {
      expect(out.data[i]).toBeLessThan(40);
    }
  });
});

describe('enhanceImageData — darken', () => {
  it('pushes faint ink toward black', () => {
    const page = makePage(240, 160, 8); // pencil-light ink on light paper
    const out = enhanceImageData(page, baseSettings);
    for (let i = 0; i < 8 * 4; i += 4) {
      expect(out.data[i]).toBeLessThan(120);
    }
  });

  it('is a no-op when darken = 0 and nothing else active', () => {
    const page = makePage(245, 120, 8);
    const settings: EnhanceSettings = { ...baseSettings, darken: 0, contrast: 0, cleanBackground: false };
    const out = enhanceImageData(page, settings);
    expect(Array.from(out.data)).toEqual(Array.from(page.data));
  });
});

describe('enhanceImageData — contrast stretch', () => {
  it('spreads a narrow gray band wider (flat input becomes higher contrast)', () => {
    const page = makePage(180, 130, 8);
    const settings: EnhanceSettings = { ...baseSettings, contrast: 100, darken: 0, cleanBackground: false };
    const out = enhanceImageData(page, settings);
    const maxLuma = Math.max(...Array.from(out.data).filter((_, i) => i % 4 === 0));
    const minLuma = Math.min(...Array.from(out.data).filter((_, i) => i % 4 === 0));
    expect(maxLuma - minLuma).toBeGreaterThan(180 - 130);
  });
});

describe('enhanceImageData — grayscale', () => {
  it('collapses R=G=B', () => {
    const data = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      data[i * 4] = 200;
      data[i * 4 + 1] = 90;
      data[i * 4 + 2] = 40;
      data[i * 4 + 3] = 255;
    }
    const page = new ImageData(data, W, H);
    const settings: EnhanceSettings = { ...baseSettings, grayscale: true, cleanBackground: false, contrast: 0, darken: 0 };
    const out = enhanceImageData(page, settings);
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(out.data[i + 1]);
      expect(out.data[i + 1]).toBe(out.data[i + 2]);
    }
  });
});

describe('enhanceImageData — sharpen gate + determinism', () => {
  it('sharpen = 0 never modifies the tonal pipeline output', () => {
    const page = makePage(230, 150, 10);
    const a = enhanceImageData(page, baseSettings);
    const b = enhanceImageData(page, baseSettings);
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });

  it('sharpen > 0 changes output but stays deterministic', () => {
    const page = makePage(230, 150, 10);
    const s: EnhanceSettings = { ...baseSettings, sharpen: 40 };
    const a = enhanceImageData(page, s);
    const b = enhanceImageData(page, s);
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });

  it('preserves alpha untouched', () => {
    const page = makePage(230, 150, 10);
    const out = enhanceImageData(page, baseSettings);
    for (let i = 3; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(255);
    }
  });
});