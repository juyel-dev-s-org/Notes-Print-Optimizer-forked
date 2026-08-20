/**
 * enhance — Print-enhance kernel for white-background faded notes.
 *
 * Problem: handwritten / scanned module pages on white paper have low-
 * contrast ink (luminance ~150-190) that vanishes on print/xerox (printer
 * threshold). Solution: per-page auto-levels contrast stretch that maps
 * faint ink → near-black and paper stains → pure white, preserving hue.
 *
 * Design constraints (long-term maintainability):
 *  - Single linear pass + histogram (256 bins) — O(N), no allocs except
 *    histogram. No per-pixel branching beyond the stretch.
 *  - Deterministic: same input → same output, no randomness.
 *  - In-place on Uint8ClampedArray (no extra image copy).
 *  - 0-100 intensity maps to percentile window, not magic constants.
 *  - PureBlack (binarize) is an optional final threshold, reusing the
 *    existing `binaizationThreshold` param (0=off).
 */

export interface EnhanceOptions {
  /** 0-100 — 0 subtle, 50 standard, 100 strong */
  intensity: number;
  /** 0 = off, 1-255 = binarize threshold; 0 keeps grayscale */
  binarizeThreshold: number;
}

let enhanceHook: ((data: Uint8ClampedArray, w: number, h: number, intensity: number, thr: number) => void) | null = null;

export function setEnhanceHook(
  hook: typeof enhanceHook,
): void {
  enhanceHook = hook;
}

/**
 * Histogram-based auto-levels: stretch [low, high] → [0, 255] per channel.
 * low/high are derived from luminance percentiles controlled by intensity.
 */
export function enhanceFadedDocument(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  opts: EnhanceOptions,
): void {
  if (enhanceHook) {
    enhanceHook(data, width, height, opts.intensity ?? 50, opts.binarizeThreshold ?? 0);
    return;
  }
  const total = width * height;
  if (total === 0 || data.length < total * 4) return;

  const intensity = Math.max(0, Math.min(100, opts.intensity ?? 50));
  const binThr = opts.binarizeThreshold ?? 0;

  // Build luminance histogram (sampled). Sampling keeps histogram cheap on
  // large pages while staying deterministic (fixed stride).
  const hist = new Uint32Array(256);
  const stride = total > 500_000 ? 2 : 1; // ~2x fewer samples on large pages
  let sampled = 0;
  for (let i = 0; i < total; i += stride) {
    const off = i * 4;
    const lum = (0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2]) | 0;
    hist[lum]++;
    sampled++;
  }

  // Percentile window widens with intensity: subtle keeps more paper
  // variation, strong aggressively whitens stains.
  const pLow = 0.05 - intensity * 0.0004; // 5% → 1% (0 → 100)
  const pHigh = 0.95 + intensity * 0.00045; // 95% → 99.5%
  const lowCount = Math.max(1, Math.floor(sampled * pLow));
  const highCount = Math.floor(sampled * pHigh);

  let low = 0;
  let cum = 0;
  for (let v = 0; v < 256; v++) {
    cum += hist[v];
    if (cum >= lowCount) { low = v; break; }
  }
  let high = 255;
  cum = 0;
  for (let v = 255; v >= 0; v--) {
    cum += hist[v];
    if (cum >= sampled - highCount) { high = v; break; }
  }

  // Guard: avoid over-stretch on already high-contrast pages or near-solid
  // colors. Keep at least 30 levels of range; clamp extremes.
  if (high - low < 30) {
    const mid = (low + high) / 2;
    low = Math.max(0, Math.floor(mid - 15));
    high = Math.min(255, Math.floor(mid + 15));
    if (high - low < 30) { high = Math.min(255, low + 30); }
  }
  low = Math.max(0, Math.min(200, low));
  high = Math.max(low + 30, Math.min(255, high));

  const range = high - low;
  const scale = 255 / range;

  // In-place linear stretch per channel (preserves hue: same low/scale
  // for R/G/B derived from luminance histogram).
  for (let i = 0; i < total; i++) {
    const off = i * 4;
    let r = data[off];
    let g = data[off + 1];
    let b = data[off + 2];
    r = (r - low) * scale;
    g = (g - low) * scale;
    b = (b - low) * scale;
    // Clamp
    data[off] = r < 0 ? 0 : r > 255 ? 255 : r | 0;
    data[off + 1] = g < 0 ? 0 : g > 255 ? 255 : g | 0;
    data[off + 2] = b < 0 ? 0 : b > 255 ? 255 : b | 0;
    // alpha untouched
  }

  // Optional pure-black binarize (Xerox Dark): threshold on luminance of
  // the stretched pixel. Keeps the result strictly B/W for maximum
  // print contrast. Disabled when threshold is 0.
  if (binThr > 0 && binThr < 255) {
    const thr = binThr | 0;
    for (let i = 0; i < total; i++) {
      const off = i * 4;
      const lum = (0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2]) | 0;
      const v = lum < thr ? 0 : 255;
      data[off] = v;
      data[off + 1] = v;
      data[off + 2] = v;
    }
  }
}

/**
 * Convenience: derive enhance options from ProcessingParameters for the
 * PRINT_ENHANCE preset.
 */
export function enhanceOptionsFromIntensity(
  enhanceIntensity: number | undefined,
  binarizeThreshold: number | undefined,
): EnhanceOptions {
  return {
    intensity: enhanceIntensity == null ? 50 : Math.max(0, Math.min(100, enhanceIntensity)),
    binarizeThreshold: binarizeThreshold == null ? 0 : binarizeThreshold | 0,
  };
}
