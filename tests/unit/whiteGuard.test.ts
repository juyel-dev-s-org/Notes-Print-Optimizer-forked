import { describe, it, expect } from 'vitest';
import { resolveEffectiveInvertMode } from '../../lib/optimizer/engine/v2/resolveInvertMode';
import { processPage } from '../../lib/kernels/processPage';
import { DARK_BG_RATIO_THRESHOLD } from '../../lib/kernels/constants';

describe('resolveEffectiveInvertMode (white-page guard)', () => {
  it('smart + DARK_SLIDE -> smart (inverts)', () => {
    expect(resolveEffectiveInvertMode('smart', 'DARK_SLIDE')).toBe('smart');
  });

  it('smart + LIGHT_SLIDE -> none (never inverts a white page)', () => {
    expect(resolveEffectiveInvertMode('smart', 'LIGHT_SLIDE')).toBe('none');
  });

  it('smart + MIXED -> none (sticky notes survive until region restore)', () => {
    expect(resolveEffectiveInvertMode('smart', 'MIXED')).toBe('none');
  });

  it('simple stays literal (explicit invert-all intent)', () => {
    expect(resolveEffectiveInvertMode('simple', 'LIGHT_SLIDE')).toBe('simple');
  });

  it('none stays none for every classification', () => {
    expect(resolveEffectiveInvertMode('none', 'DARK_SLIDE')).toBe('none');
    expect(resolveEffectiveInvertMode('none', 'MIXED')).toBe('none');
  });
});

describe('kernel honors unified dark threshold', () => {
  /* h=16: kernel pads output to a minimum of 10 rows — stay above it. */
  const w = 4;
  const h = 16;
  /* Mid-gray page: darkBgRatio 0 (no pixel < 60) — below the unified band. */
  const gray = new Uint8ClampedArray(w * h * 4).fill(128);

  const profile = {
    classification: 'MIXED' as const,
    darkBackgroundRatio: DARK_BG_RATIO_THRESHOLD - 0.03,
  };
  const params = {
    invertMode: 'none',
    bannerCropTopPct: 0,
    bannerCropBottomPct: 0,
    sharpenAmount: 0,
  };

  it('invertMode=none on a sub-threshold dark ratio preserves grayscale (fast path)', () => {
    const { buffer } = processPage(gray, w, h, params, profile);
    const out = new Uint8ClampedArray(buffer);
    /* Every pixel must keep its original 128 value — NOT binarized to 0/255,
       NOT corrupted by the old Uint32 alpha bug (red/transparent). */
    for (let i = 0; i < out.length; i += 4) {
      expect(out[i]).toBe(128);
      expect(out[i + 1]).toBe(128);
      expect(out[i + 2]).toBe(128);
      expect(out[i + 3]).toBe(255);
    }
  });

  it('invertMode=smart on a bright low-sat page binarizes it to foreground', () => {
    /* Gray 200: maxC>155 + low saturation -> foreground -> black composite. */
    const bright = new Uint8ClampedArray(w * h * 4).fill(200);
    const { buffer } = processPage(bright, w, h, { ...params, invertMode: 'smart' }, profile);
    const out = new Uint8ClampedArray(buffer);
    expect(out[0]).toBe(0);
    expect(out[3]).toBe(255);
  });
});
