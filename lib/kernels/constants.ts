/**
 * Shared analysis thresholds — single source of truth.
 *
 * DARK_BG_RATIO_THRESHOLD classifies a page as dark-background when the
 * sampled ratio of pixels with luminance < 60 exceeds this value. Both the
 * analyzer (page classification) and the pixel kernel (isDark fast check)
 * MUST use the same value, otherwise pages in the gap band get contradictory
 * treatment (classified MIXED but binarized anyway).
 */
export const DARK_BG_RATIO_THRESHOLD = 0.45;
