/**
 * enhanceKernels — pure, deterministic pixel pipeline for the
 * "Enhance Light PDF" tool.
 *
 * Target input: light-background pages with faint/light ink (handwritten
 * notebook scans, photographed module pages). Goal: push faint ink toward
 * black and the background toward pure white so the output survives
 * printing/photocopying.
 *
 * All functions are pure (input -> new output), operate on typed arrays,
 * and are deterministic: identical input + settings => identical output.
 */

import { applyUnsharpMask, applyUnsharpMaskBW } from '@/lib/kernels/sharpen';
import type { EnhanceSettings } from './types';

/**
 * Tunable constants for the enhance pipeline — extracted for testability
 * and future calibration. Values chosen to push faint pencil (luma ~150-180)
 * toward black while preserving dark ink (<40) and mapping paper tint
 * (≥ bg-12) to pure white.
 */
export const ENHANCE_TUNING = {
  /** Ink is considered anything below (bg - this) */
  INK_CEILING_OFFSET: 30,
  /** Pixels with luma ≥ (bg - this) are snapped to white when cleaning */
  BG_CLEAN_THRESHOLD: 12,
  /** Max lift (darken) applied at darken=100 */
  DARKEN_MAX_LIFT: 96,
  /** Contrast gain multiplier */
  CONTRAST_GAIN_FACTOR: 1.5,
  /** Max unsharp amount at sharpen=100 */
  SHARPEN_MAX_AMT: 0.55,
} as const;

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** Single-channel luminance from RGBA (Rec. 601 weights). */
export function lumaOf(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

interface LumaStats {
  /** 1st percentile luminance (darkest real content, immune to outliers). */
  p1: number;
  /** 95th percentile luminance (background estimate, immune to specks). */
  p95: number;
}

/**
 * Percentile stats over the luminance of every pixel. Uses a 256-bin
 * histogram (O(n), no sorting).
 */
export function computeLumaStats(data: Uint8ClampedArray): LumaStats {
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const l = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    hist[clamp255(l) | 0]++;
  }
  const n = data.length / 4;
  const k1 = Math.max(1, Math.round(n * 0.01));
  const k95 = Math.min(n, Math.round(n * 0.95));
  let acc = 0;
  let p1 = 0;
  let p95 = 0;
  let seenP1 = false;
  let seenP95 = false;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (!seenP1 && acc >= k1) { p1 = v; seenP1 = true; }
    if (!seenP95 && acc >= k95) { p95 = v; seenP95 = true; }
    if (seenP1 && seenP95) break;
  }
  return { p1, p95: p95 === 0 ? 255 : p95 };
}

/**
 * Main enhance pipeline. Pure: reads `input`, writes a NEW ImageData.
 *
 * Order (all steps deterministic):
 *  1. cleanBackground — pixels at/near background luminance become pure white
 *  2. contrast — luma-based histogram stretch from (p1, p95) onto (0, 255)
 *  3. darken — ink pixels (below the ink ceiling) get lifted toward black
 *  4. grayscale — collapse to luma (applied before sharpen so the fast
 *     B/W unsharp kernel can be used)
 *  5. sharpen — unsharp mask (strength from settings; skipped when 0)
 */
export function enhanceImageData(input: ImageData, settings: EnhanceSettings): ImageData {
  const src = input.data;
  const { width, height } = input;
  const out = new Uint8ClampedArray(src.length);
  const n = width * height;

  const { p1, p95 } = computeLumaStats(src);

  const bgCeiling = p95;
  const inkCeiling = Math.max(0, bgCeiling - ENHANCE_TUNING.INK_CEILING_OFFSET);
  const darkenLift = Math.round((settings.darken / 100) * ENHANCE_TUNING.DARKEN_MAX_LIFT);

  const contrast = settings.contrast / 100;
  const stretchLo = p1;
  const stretchRange = Math.max(1, p95 - p1);
  const contrastGain = 1 + contrast * ENHANCE_TUNING.CONTRAST_GAIN_FACTOR;

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    let r = src[o];
    let g = src[o + 1];
    let b = src[o + 2];
    const a = src[o + 3];

    let l = lumaOf(r, g, b);

    if (settings.cleanBackground && l >= bgCeiling - ENHANCE_TUNING.BG_CLEAN_THRESHOLD) {
      r = 255; g = 255; b = 255;
      l = 255;
    }

    if (contrast > 0) {
      const t = (l - stretchLo) / stretchRange;
      const stretched = 255 * (t < 0 ? 0 : t > 1 ? 1 : t);
      const boost = (stretched - l) * contrastGain;
      r = clamp255(r + boost);
      g = clamp255(g + boost);
      b = clamp255(b + boost);
      l = lumaOf(r, g, b);
    }

    if (darkenLift > 0 && l < inkCeiling) {
      const lift = Math.min(darkenLift, inkCeiling - l);
      r = clamp255(r - lift);
      g = clamp255(g - lift);
      b = clamp255(b - lift);
    }

    if (settings.grayscale) {
      l = lumaOf(r, g, b);
      r = l; g = l; b = l;
    }

    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = a;
  }

  if (settings.sharpen > 0) {
    const amt = (settings.sharpen / 100) * ENHANCE_TUNING.SHARPEN_MAX_AMT;
    if (settings.grayscale) {
      applyUnsharpMaskBW(out, width, height, amt);
    } else {
      applyUnsharpMask(out, width, height, amt);
    }
  }

  return new ImageData(out, width, height);
}