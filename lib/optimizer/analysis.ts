/**
 * analyzeImageData - Page profile analyzer.
 *
 * Production optimizations:
 *  - Welford's online algorithm for variance (eliminates Float64Array allocation)
 *  - Single-pass statistics: mean, variance, dark/light ratios in one loop
 *  - Adaptive sampling stride based on page dimensions
 */
import type { PageProfile, PageClassification } from './types';
import { getLuminance } from '../kernels';
import { detectBanners } from '../kernels';
import { DARK_BG_RATIO_THRESHOLD } from '../kernels/constants';

export function analyzeImageData(imageData: ImageData, pageIndex: number): PageProfile {
  const { width, height, data } = imageData;
  const totalPixels = width * height;

  const step = Math.max(1, Math.floor(Math.sqrt(totalPixels / 100000)));

  // Welford's online algorithm (zero allocation for statistics)
  let count = 0;
  let mean = 0;
  let m2 = 0;
  let darkPixelCount = 0;
  let lightPixelCount = 0;

  for (let y = 0; y < height; y += step) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x += step) {
      const idx = rowOffset + x * 4;
      const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);

      count++;
      const delta = lum - mean;
      mean += delta / count;
      const delta2 = lum - mean;
      m2 += delta * delta2;

      if (lum < 60) darkPixelCount++;
      else if (lum > 200) lightPixelCount++;
    }
  }

  const avgBrightness = mean;
  const contrast = count > 1 ? Math.sqrt(m2 / count) : 0;
  const darkBgRatio = darkPixelCount / count;
  const lightBgRatio = lightPixelCount / count;

  const { topBannerPct, bottomBannerPct } = detectBanners(data, width, height);
  const inkDensity = 1 - lightBgRatio;

  let classification: PageClassification;
  if (darkBgRatio > DARK_BG_RATIO_THRESHOLD) {
    classification = 'DARK_SLIDE';
  } else if (contrast > 65) {
    classification = 'DIAGRAM_EQUATION';
  } else if (darkBgRatio < 0.15 && lightBgRatio > 0.65) {
    classification = 'LIGHT_SLIDE';
  } else if (inkDensity > 0.35) {
    classification = 'HANDWRITTEN_NOTES';
  } else {
    classification = 'MIXED';
  }

  return {
    pageIndex,
    width,
    height,
    averageBrightness: Math.round(avgBrightness),
    contrast: Math.round(contrast),
    inkDensity: Number(inkDensity.toFixed(3)),
    darkBackgroundRatio: Number(darkBgRatio.toFixed(3)),
    lightBackgroundRatio: Number(lightBgRatio.toFixed(3)),
    dominantHue: 0,
    hasTopBanner: topBannerPct > 0.03,
    topBannerHeightPct: Number(topBannerPct.toFixed(3)),
    hasBottomBanner: bottomBannerPct > 0.03,
    bottomBannerHeightPct: Number(bottomBannerPct.toFixed(3)),
    estimatedNoise: Math.round(Math.max(0, 100 - contrast)),
    strokeThickness: darkBgRatio > 0.5 ? 2.5 : 1.8,
    classification,
  };
}
