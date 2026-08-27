/**
 * whiteBox - Auto white-box detection & healing for dark pages.
 *
 * SCENARIO
 * Dark lecture pages often contain large white rectangles (sticky notes,
 * Q&A boxes, embedded charts). The whiten kernel inverts the whole page,
 * turning those boxes into solid black ink bombs. This module detects such
 * boxes on the ORIGINAL render and pastes the untouched original pixels
 * back over the whitened result — a region-level source swap.
 *
 * PIPELINE POSITION
 * Runs inside the pixel worker (and the main-thread fallback) around
 * processPage(): detect on src -> kernel process -> composite regions.
 * Everything downstream (thumbnail, IndexedDB persist, before/after
 * preview, N-up export) inherits the healed bitmap with zero extra work.
 *
 * COORDINATE SYSTEM (CRITICAL)
 * All regions (auto + manual) are stored in **CROPPED coordinates** —
 * i.e., coordinates relative to the post-banner-crop page render.
 * The kernel processes cropped pages (top/bottom banner crop removed).
 * Manual regions from the editor are drawn on the cropped canvas,
 * so they are naturally in cropped coordinates.
 * Export MUST pass the correct `cropTopPx` to `compositeWhiteBoxRegions`
 * so the regions align with the cropped processed pages.
 * For pages without banner crop, `cropTopPx = 0`.
 *
 * ALGORITHM (detect)
 *  1. Downsample to a block grid (~200-400 blocks wide) averaging
 *     luminance + saturation per block — cheap and JPEG-noise tolerant.
 *  2. BFS 4-connected components over "white blocks".
 *  3. Accept a component as a box when: area fraction, bounding-box fill
 *     ratio and min width/height all pass (tuned via WHITE_BOX_TUNING).
 *  4. Merge overlapping boxes, pad, clamp, cap count, scale to full res.
 *
 * PERFORMANCE
 * Pure JS on typed arrays at block resolution (~100k cells worst case):
 * low single-digit ms per dark page. The functions are intentionally
 * signature-stable so a Rust/WASM detector can replace the internals later
 * without touching callers (wasm-pack is currently blocked on dev machines
 * by Application Control policy — revisit if that lifts AND profiling
 * ever shows detection >5% of page time).
 *
 * GOLDEN TESTS NOTE
 * pdfGolden exercises processPage() directly, so kernel math goldens are
 * unaffected by this layer; the detector has its own synthetic tests.
 */
import { processPage, type KernelProcessResult } from './processPage';
import { DARK_BG_RATIO_THRESHOLD } from './constants';
import type { PageProfile, ProcessingParameters } from '../optimizer/types';

/** The parameter subset the heal pipeline actually reads. Accepts full
 *  ProcessingParameters structurally, so both the worker task payload and
 *  the engine's params object flow in unchanged. */
export type WhiteBoxHealParams = Pick<
  ProcessingParameters,
  'invertMode' | 'bannerCropTopPct' | 'bannerCropBottomPct' | 'strokeEnhancement' | 'sharpenAmount' | 'dilationKernelSize' | 'autoWhiteBoxFix'
>;

/** A restored rectangle in CROPPED full-res coordinates (pixels) —
 *  x/y relative to the post-banner-crop render (what the editor canvas shows).
 *  For pages without banner crop this equals full-page coords. */
export interface WhiteBoxRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Shape of the restored area. Defaults to 'rect' when omitted (back-compat). */
  shape?: 'rect' | 'ellipse';
}

/**
 * Single tuning surface. Values are deliberately conservative: a missed
 * box costs one manual left-tick (P0 fallback), a false positive alters a
 * page the user did not ask to touch.
 */
export const WHITE_BOX_TUNING = {
  /** Block grid target width (downsample factor derives from this). */
  targetGridWidth: 240,
  /** Block is "white" when avg luminance >= this and avg sat <= this. */
  blockLuminanceMin: 195,
  blockSaturationMax: 60,
  /** Component acceptance: area fraction of the page. */
  minAreaFrac: 0.035,
  maxAreaFrac: 0.8,
  /** area / bounding-box area — boxes are solid, clouds are not. */
  minFillRatio: 0.5,
  /** Minimum box footprint (fraction of page dims). */
  minWidthFrac: 0.12,
  minHeightFrac: 0.09,
  /** Padding around an accepted box (fraction of min page dim). */
  padFrac: 0.015,
  /** Safety cap per page. */
  maxRegions: 6,
} as const;

/**
 * Calculate the top crop in pixels from the *kernel* crop param.
 * This is the sole source of truth for banner crop — `processPage`
 * uses `params.bannerCropTopPct` (profile detection is not applied to
 * the kernel today; all presets emit 0). `pageHeight` must be the
 * FULL (pre-crop) height. For manual export we pass `origFull.height`;
 * for the heal path we pass the original `srcData` height.
 * The helper keeps the `(profile, params, height)` signature for
 * back-compat but deliberately ignores `profile.topBannerHeightPct`
 * (fraction 0.05 vs percent 5) which previously yielded `0` for all pages.
 */
export function getCropTopPx(
  profile: Pick<PageProfile, 'topBannerHeightPct'>,
  params: Pick<ProcessingParameters, 'bannerCropTopPct'>,
  pageHeight: number
): number {
  const bannerPct = params.bannerCropTopPct ?? 0;
  if (bannerPct !== 0) return Math.floor(pageHeight * (bannerPct / 100));
  // Legacy fallback: if params is 0 but profile carries a fraction (0.05 = 5%),
  // interpret correctly — this branch is effectively dead today (presets 0).
  const prof = (profile as unknown as { topBannerHeightPct?: number })?.topBannerHeightPct;
  if (typeof prof === 'number' && prof > 0 && prof < 1) return Math.floor(pageHeight * prof);
  if (typeof prof === 'number' && prof >= 1) return Math.floor(pageHeight * (prof / 100));
  return 0;
}

/** Convenience: crop from params alone (preferred for new callers). */
export function getCropTopPxFromParams(
  params: Pick<ProcessingParameters, 'bannerCropTopPct'>,
  fullHeight: number
): number {
  return Math.floor(fullHeight * ((params.bannerCropTopPct ?? 0) / 100));
}

interface BlockComponent {
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/* Pooled BFS buffers (module scope — worker processes pages sequentially,
   so there is no reentrancy). Grown on demand, never shrunk mid-session. */
let gridLabels = new Int32Array(0);
let gridQueue = new Int32Array(0);

function ensureGridCapacity(cells: number): void {
  if (gridLabels.length < cells) {
    gridLabels = new Int32Array(cells);
    gridQueue = new Int32Array(cells);
  }
}

/** Is this page a candidate for healing at all? */
export function shouldHealWhiteBoxes(
  params: WhiteBoxHealParams,
  profile: Pick<PageProfile, 'classification' | 'darkBackgroundRatio'>,
): boolean {
  if (params.autoWhiteBoxFix === false) return false;
  return (
    profile.classification === 'DARK_SLIDE' ||
    profile.darkBackgroundRatio > DARK_BG_RATIO_THRESHOLD
  );
}

/**
 * Detect white-box regions on a full-res RGBA source render.
 * Only meaningful on dark pages (see shouldHealWhiteBoxes).
 */
export function detectWhiteBoxRegions(
  src: Uint8ClampedArray,
  w: number,
  h: number,
): WhiteBoxRegion[] {
  const t = WHITE_BOX_TUNING;
  const factor = Math.max(2, Math.min(6, Math.round(Math.min(w, h) / t.targetGridWidth)));
  const gw = Math.max(1, Math.floor(w / factor));
  const gh = Math.max(1, Math.floor(h / factor));
  const cells = gw * gh;
  ensureGridCapacity(cells);
  gridLabels.fill(0, 0, cells);

  /* Pass 1: per-block average luminance + saturation. Accumulate into the
     labels array (as lum sum, scaled) to avoid a second buffer. */
  for (let by = 0; by < gh; by++) {
    const y0 = by * factor;
    const y1 = Math.min(h, y0 + factor);
    for (let bx = 0; bx < gw; bx++) {
      const x0 = bx * factor;
      const x1 = Math.min(w, x0 + factor);
      let lumSum = 0;
      let satSum = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        let idx = (y * w + x0) * 4;
        for (let x = x0; x < x1; x++) {
          const r = src[idx], g = src[idx + 1], b = src[idx + 2];
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          lumSum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
          satSum += maxC - minC;
          n++;
          idx += 4;
        }
      }
      const isWhite =
        n > 0 &&
        lumSum / n >= t.blockLuminanceMin &&
        satSum / n <= t.blockSaturationMax;
      gridLabels[by * gw + bx] = isWhite ? 1 : 0;
    }
  }

  /* Pass 2: BFS components over white blocks (labels reused: 0=unvisited
     non-white, 1=unvisited white, 2+=component id). */
  const comps: BlockComponent[] = [];
  for (let start = 0; start < cells; start++) {
    if (gridLabels[start] !== 1) continue;
    const id = comps.length + 2;
    let head = 0;
    let tail = 0;
    gridQueue[tail++] = start;
    gridLabels[start] = id;
    let area = 0, minX = gw, minY = gh, maxX = -1, maxY = -1;
    while (head < tail) {
      const cur = gridQueue[head++];
      const cx = cur % gw;
      const cy = (cur / gw) | 0;
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;
      area++;
      if (cx > 0 && gridLabels[cur - 1] === 1) { gridLabels[cur - 1] = id; gridQueue[tail++] = cur - 1; }
      if (cx < gw - 1 && gridLabels[cur + 1] === 1) { gridLabels[cur + 1] = id; gridQueue[tail++] = cur + 1; }
      if (cy > 0 && gridLabels[cur - gw] === 1) { gridLabels[cur - gw] = id; gridQueue[tail++] = cur - gw; }
      if (cy < gh - 1 && gridLabels[cur + gw] === 1) { gridLabels[cur + gw] = id; gridQueue[tail++] = cur + gw; }
    }
    comps.push({ area, minX, minY, maxX, maxY });
  }

  /* Pass 3: acceptance filters, in block units. */
  const totalCells = cells;
  const accepted: { x: number; y: number; w: number; h: number; area: number }[] = [];
  for (const c of comps) {
    const areaFrac = c.area / totalCells;
    if (areaFrac < t.minAreaFrac || areaFrac > t.maxAreaFrac) continue;
    const bw = c.maxX - c.minX + 1;
    const bh = c.maxY - c.minY + 1;
    if (c.area / (bw * bh) < t.minFillRatio) continue;
    if (bw / gw < t.minWidthFrac || bh / gh < t.minHeightFrac) continue;
    accepted.push({ x: c.minX, y: c.minY, w: bw, h: bh, area: c.area });
  }

  if (accepted.length === 0) return [];

  /* Merge boxes that overlap or nearly touch (a note with a dark seam). */
  accepted.sort((a, b) => b.area - a.area);
  const merged: typeof accepted = [];
  for (const box of accepted) {
    let absorbed = false;
    for (const m of merged) {
      const gap = 2; /* blocks of allowed proximity */
      const overlaps =
        box.x < m.x + m.w + gap && box.x + box.w + gap > m.x &&
        box.y < m.y + m.h + gap && box.y + box.h + gap > m.y;
      if (overlaps) {
        const nx = Math.min(m.x, box.x);
        const ny = Math.min(m.y, box.y);
        m.w = Math.max(m.x + m.w, box.x + box.w) - nx;
        m.h = Math.max(m.y + m.h, box.y + box.h) - ny;
        m.x = nx;
        m.y = ny;
        absorbed = true;
        break;
      }
    }
    if (!absorbed && merged.length < t.maxRegions) merged.push({ ...box });
  }

  /* Scale to full res, pad, clamp. */
  const pad = Math.round(t.padFrac * Math.min(w, h));
  const regions: WhiteBoxRegion[] = [];
  for (const m of merged) {
    const x = Math.max(0, m.x * factor - pad);
    const y = Math.max(0, m.y * factor - pad);
    const x1 = Math.min(w, (m.x + m.w) * factor + pad);
    const y1 = Math.min(h, (m.y + m.h) * factor + pad);
    if (x1 - x > 0 && y1 - y > 0) regions.push({ x, y, width: x1 - x, height: y1 - y });
  }
  return regions;
}

/**
 * Paste original pixels back over the processed result, region by region.
 * Row-blocked memcpy for rects; per-pixel ellipse test for circular
 * selections.
 *
 * COORDS: `regions` are in **CROPPED** coordinates (xy relative to the
 * post-crop dst). `cropTopPx` is the top banner crop in FULL-res pixels
 * and is used ONLY to offset the `src` (full-page) read: `srcRow = y + cropTopPx`.
 * When there is no banner crop `cropTopPx=0` and the copy is 1:1.
 */
export function compositeWhiteBoxRegions(
  dst: Uint8ClampedArray,
  src: Uint8ClampedArray,
  srcWidth: number,
  dstHeight: number,
  regions: WhiteBoxRegion[],
  cropTopPx: number = 0,
): void {
  for (const r of regions) {
    // Cropped coords: dst y is r.y directly, src y is r.y + cropTopPx
    const y0 = Math.max(0, r.y);
    const y1 = Math.min(dstHeight, r.y + r.height);
    const x0 = Math.max(0, r.x);
    const x1 = Math.min(srcWidth, r.x + r.width);
    if (y1 <= y0 || x1 <= x0) continue;
    const isEllipse = r.shape === 'ellipse';
    if (!isEllipse) {
      // Fast path: rectangular memcpy per row.
      const rowBytes = (x1 - x0) * 4;
      for (let y = y0; y < y1; y++) {
        const srcRow = (y + cropTopPx) * srcWidth;
        // Guard src bounds (full src is taller than dst when cropped)
        if (srcRow < 0 || srcRow * 4 + x1 * 4 > src.length) continue;
        dst.set(
          src.subarray((srcRow + x0) * 4, (srcRow + x0) * 4 + rowBytes),
          (y * srcWidth + x0) * 4,
        );
      }
    } else {
      // Ellipse: only pixels inside ((x-cx)/rx)^2 + ((y-cy)/ry)^2 <= 1
      // are copied. Bounding-box iteration keeps it bounded.
      const cx = x0 + (x1 - x0) / 2;
      const cy = y0 + (y1 - y0) / 2;
      const rx = (x1 - x0) / 2;
      const ry = (y1 - y0) / 2;
      if (rx <= 0 || ry <= 0) continue;
      const ry2 = ry * ry;
      for (let y = y0; y < y1; y++) {
        const dy = y - cy;
        const dy2_ry2 = (dy * dy) / ry2;
        if (dy2_ry2 > 1) continue;
        // Solve for horizontal chord at this scanline
        const dx = rx * Math.sqrt(1 - dy2_ry2);
        const lx = Math.max(x0, Math.ceil(cx - dx));
        const rxBound = Math.min(x1, Math.floor(cx + dx) + 1);
        if (rxBound <= lx) continue;
        const srcRow = (y + cropTopPx) * srcWidth;
        if (srcRow < 0 || srcRow * 4 + rxBound * 4 > src.length) continue;
        const rowBytes = (rxBound - lx) * 4;
        dst.set(
          src.subarray((srcRow + lx) * 4, (srcRow + lx) * 4 + rowBytes),
          (y * srcWidth + lx) * 4,
        );
      }
    }
  }
}

/**
 * Full heal pipeline for one page: kernel process + white-box restore.
 * Used by the pixel worker AND the main-thread fallback so behavior is
 * byte-identical regardless of which processor handled the page.
 * Returns the kernel result plus detected regions (for UI badges and the
 * future manual region editor).
 */
export function processPageWithWhiteBoxHeal(
  srcData: Uint8ClampedArray,
  width: number,
  height: number,
  params: WhiteBoxHealParams,
  profile: Pick<PageProfile, 'classification' | 'darkBackgroundRatio'>,
): KernelProcessResult & { whiteBoxRegions: WhiteBoxRegion[] } {
  const rawRegions = shouldHealWhiteBoxes(params, profile)
    ? detectWhiteBoxRegions(srcData, width, height)
    : [];
  const result = processPage(srcData, width, height, params, profile);
  if (rawRegions.length === 0) return { ...result, whiteBoxRegions: [] };

  // Convert FULL-page detections to CROPPED coords for storage + composite.
  // The kernel cropped `cropTopPx` rows from the top (and bottom), so
  // regions must be shifted up and clipped to `result.height`.
  const cropTopPx = Math.floor(height * ((params.bannerCropTopPct ?? 0) / 100));
  const cropped: WhiteBoxRegion[] = [];
  for (const r of rawRegions) {
    let y = r.y - cropTopPx;
    let h = r.height;
    if (y < 0) { h += y; y = 0; }
    if (y + h > result.height) h = result.height - y;
    if (h <= 0 || r.width <= 0) continue;
    const x = r.x;
    let w = r.width;
    if (x + w > width) w = width - x;
    if (w <= 0) continue;
    cropped.push({ ...r, x, y, width: w, height: h });
  }
  if (cropped.length > 0) {
    compositeWhiteBoxRegions(
      new Uint8ClampedArray(result.buffer),
      srcData,
      width,
      result.height,
      cropped,
      cropTopPx,
    );
  }
  return { ...result, whiteBoxRegions: cropped };
}
