import { describe, it, expect } from 'vitest';
import {
  detectWhiteBoxRegions,
  compositeWhiteBoxRegions,
  processPageWithWhiteBoxHeal,
  shouldHealWhiteBoxes,
  WHITE_BOX_TUNING,
  type WhiteBoxRegion,
} from '../../lib/kernels/whiteBox';

/* ---------- synthetic page builder ---------- */
function buildPage(
  w: number,
  h: number,
  bgLum: number,
  boxes: Array<{ x: number; y: number; w: number; h: number; lum?: number }>,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4).fill(bgLum);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  for (const b of boxes) {
    const lum = b.lum ?? 255;
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        const idx = (y * w + x) * 4;
        data[idx] = lum; data[idx + 1] = lum; data[idx + 2] = lum;
      }
    }
  }
  return data;
}

const DARK_PROFILE = { classification: 'DARK_SLIDE' as const, darkBackgroundRatio: 0.9 };
const HEAL_PARAMS: import('../../lib/kernels/whiteBox').WhiteBoxHealParams = { invertMode: 'smart', bannerCropTopPct: 0, bannerCropBottomPct: 0, sharpenAmount: 0, autoWhiteBoxFix: true };

describe('shouldHealWhiteBoxes (gate)', () => {
  it('heals DARK_SLIDE by default', () => {
    expect(shouldHealWhiteBoxes({ ...HEAL_PARAMS, autoWhiteBoxFix: undefined }, DARK_PROFILE)).toBe(true);
  });
  it('skips when autoWhiteBoxFix is false (user switch OFF)', () => {
    expect(shouldHealWhiteBoxes({ ...HEAL_PARAMS, autoWhiteBoxFix: false }, DARK_PROFILE)).toBe(false);
  });
  it('skips light pages even when enabled', () => {
    expect(shouldHealWhiteBoxes(HEAL_PARAMS, { classification: 'LIGHT_SLIDE', darkBackgroundRatio: 0.05 })).toBe(false);
  });
  it('heals sub-threshold MIXED pages via ratio gate', () => {
    expect(shouldHealWhiteBoxes(HEAL_PARAMS, { classification: 'MIXED', darkBackgroundRatio: 0.5 })).toBe(true);
  });
});

describe('detectWhiteBoxRegions', () => {
  const W = 800;
  const H = 600;

  it('finds a large centered white box', () => {
    const box = { x: 200, y: 150, w: 400, h: 300 };
    const src = buildPage(W, H, 25, [box]);
    const regions = detectWhiteBoxRegions(src, W, H);
    expect(regions).toHaveLength(1);
    const r = regions[0];
    /* Padded region must fully contain the source box. */
    expect(r.x).toBeLessThanOrEqual(box.x);
    expect(r.y).toBeLessThanOrEqual(box.y);
    expect(r.x + r.width).toBeGreaterThanOrEqual(box.x + box.w);
    expect(r.y + r.height).toBeGreaterThanOrEqual(box.y + box.h);
  });

  it('returns nothing on an all-dark page', () => {
    expect(detectWhiteBoxRegions(buildPage(W, H, 25, []), W, H)).toHaveLength(0);
  });

  it('ignores small white dots (text-sized, below min area)', () => {
    const dots: Array<{ x: number; y: number; w: number; h: number; lum?: number }> = [];
    for (let i = 0; i < 40; i++) {
      dots.push({ x: 30 + (i % 10) * 70, y: 30 + Math.floor(i / 10) * 130, w: 14, h: 10 });
    }
    expect(detectWhiteBoxRegions(buildPage(W, H, 25, dots), W, H)).toHaveLength(0);
  });

  it('rejects a hollow white frame (fill ratio below threshold)', () => {
    const t = 30;
    const frame = [
      { x: 100, y: 100, w: 500, h: t },            /* top */
      { x: 100, y: 400, w: 500, h: t },            /* bottom */
      { x: 100, y: 100, w: t, h: 330 },            /* left */
      { x: 570, y: 100, w: t, h: 330 },            /* right */
    ];
    expect(detectWhiteBoxRegions(buildPage(W, H, 25, frame), W, H)).toHaveLength(0);
  });

  it('finds two separate boxes and caps at maxRegions', () => {
    const boxes = [
      { x: 40, y: 40, w: 260, h: 200 },
      { x: 420, y: 300, w: 300, h: 220 },
    ];
    const regions = detectWhiteBoxRegions(buildPage(W, H, 25, boxes), W, H);
    expect(regions.length).toBe(2);
  });

  it('caps the number of regions', () => {
    const boxes: Array<{ x: number; y: number; w: number; h: number }> = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        boxes.push({ x: 20 + col * 270, y: 20 + row * 190, w: 220, h: 150 });
      }
    }
    const regions = detectWhiteBoxRegions(buildPage(W, H, 25, boxes), W, H);
    expect(regions.length).toBeLessThanOrEqual(WHITE_BOX_TUNING.maxRegions);
  });

  it('handles a box touching the page edge (clamp, no overflow)', () => {
    const box = { x: 0, y: H - 200, w: W, h: 200 };
    const regions = detectWhiteBoxRegions(buildPage(W, H, 25, [box]), W, H);
    expect(regions.length).toBe(1);
    const r: WhiteBoxRegion = regions[0];
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y + r.height).toBeLessThanOrEqual(H);
  });
});

describe('compositeWhiteBoxRegions', () => {
  it('pastes original pixels inside the region only', () => {
    const w = 40, h = 30;
    const dst = new Uint8ClampedArray(w * h * 4).fill(255); /* whitened */
    const src = buildPage(w, h, 25, [{ x: 10, y: 5, w: 20, h: 10, lum: 128 }]);
    compositeWhiteBoxRegions(dst, src, w, h, [{ x: 10, y: 5, width: 20, height: 10 }], 0);
    const inside = (5 * w + 15) * 4;
    const outside = (25 * w + 5) * 4;
    expect(dst[inside]).toBe(128);
    expect(dst[outside]).toBe(255);
  });

  it('shifts regions by the banner crop offset (cropped coords)', () => {
    const w = 40, h = 30;
    const cropTop = 5;
    const dstHeight = h - cropTop;
    const dst = new Uint8ClampedArray(w * dstHeight * 4).fill(255);
    // Regions are CROPPED coords: r.y=5 means src row 10 (5+cropTop) → dst y 5
    const src = buildPage(w, h, 25, [{ x: 10, y: 10, w: 10, h: 6, lum: 77 }]);
    compositeWhiteBoxRegions(dst, src, w, dstHeight, [{ x: 10, y: 5, width: 10, height: 6 }], cropTop);
    expect(dst[(5 * w + 12) * 4]).toBe(77);
    /* Row above the region stays whitened. */
    expect(dst[(4 * w + 12) * 4]).toBe(255);
  });

  it('cropped height exactly matches dst — manual export path', () => {
    const w = 50, fullH = 40, cropTop = 8, cropBot = 4;
    const dstH = fullH - cropTop - cropBot; // 28
    const dst = new Uint8ClampedArray(w * dstH * 4).fill(255);
    const src = buildPage(w, fullH, 20, [{ x: 5, y: 12, w: 20, h: 10, lum: 90 }]);
    // Box at full y=12 → cropped y=4 (12-8)
    compositeWhiteBoxRegions(dst, src, w, dstH, [{ x: 5, y: 4, width: 20, height: 10 }], cropTop);
    expect(dst[(4 * w + 10) * 4]).toBe(90);
    expect(dst[(15 * w + 10) * 4]).toBe(255); // below box
  });
});

describe('processPageWithWhiteBoxHeal (integration)', () => {
  it('dark page with box: output keeps original pixels inside the box', () => {
    const W = 320, H = 240;
    const box = { x: 90, y: 70, w: 140, h: 100, lum: 255 };
    const src = buildPage(W, H, 30, [box]);
    const healed = processPageWithWhiteBoxHeal(src, W, H, HEAL_PARAMS, DARK_PROFILE);
    expect(healed.whiteBoxRegions.length).toBe(1);
    const out = new Uint8ClampedArray(healed.buffer);
    /* Inside the box the ORIGINAL white survives (255), not inverted black. */
    const probe = ((box.y + 50) * W + (box.x + 70)) * 4;
    expect(out[probe]).toBe(255);
    /* Dark background outside the box is whitened by the kernel. */
    const bgProbe = (10 * W + 10) * 4;
    expect(out[bgProbe]).toBeGreaterThan(200);
  });

  it('autoWhiteBoxFix=false: box inverts to black (legacy behavior)', () => {
    const W = 320, H = 240;
    const box = { x: 90, y: 70, w: 140, h: 100, lum: 255 };
    const src = buildPage(W, H, 30, [box]);
    const healed = processPageWithWhiteBoxHeal(src, W, H, { ...HEAL_PARAMS, autoWhiteBoxFix: false }, DARK_PROFILE);
    expect(healed.whiteBoxRegions).toHaveLength(0);
    const out = new Uint8ClampedArray(healed.buffer);
    const probe = ((box.y + 50) * W + (box.x + 70)) * 4;
    expect(out[probe]).toBe(0); /* inverted to black */
  });

  it('banner crop: whiteBoxRegions are stored CROPPED and heal aligns', () => {
    const W = 320, H = 240;
    const cropTop = 24; // 10%
    const boxFull = { x: 40, y: 50, w: 120, h: 80, lum: 255 }; // full coords
    const src = buildPage(W, H, 30, [boxFull]);
    const params = { ...HEAL_PARAMS, bannerCropTopPct: 10, bannerCropBottomPct: 0 };
    const healed = processPageWithWhiteBoxHeal(src, W, H, params, DARK_PROFILE);
    // Expect stored y = full y - cropTop
    expect(healed.whiteBoxRegions.length).toBe(1);
    const r = healed.whiteBoxRegions[0];
    expect(r.y).toBeLessThan(boxFull.y); // cropped
    expect(r.y).toBeGreaterThanOrEqual(0);
    // Healed buffer height is cropped
    expect(healed.height).toBe(H - cropTop);
    const out = new Uint8ClampedArray(healed.buffer);
    // Probe inside box in CROPPED coords: full y 50 -> cropped y 26
    const croppedY = boxFull.y - cropTop + 10;
    const probe = (croppedY * W + (boxFull.x + 10)) * 4;
    expect(out[probe]).toBe(255);
  });
});

describe('perf guard', () => {
  it('detects on a full-res page well under the frame budget', () => {
    const W = 1728, H = 972;
    const src = buildPage(W, H, 28, [{ x: 300, y: 200, w: 900, h: 500 }]);
    const t0 = performance.now();
    const regions = detectWhiteBoxRegions(src, W, H);
    const ms = performance.now() - t0;
    expect(regions.length).toBe(1);
    console.log(`[whiteBox] detect on ${W}x${H}: ${ms.toFixed(1)}ms`);
    /* Generous CI margin — typical runs land in single-digit ms. */
    expect(ms).toBeLessThan(120);
  });
});
