import type { PageProfile, PageClassification } from './types';
import { getLuminance } from '../kernels';
import { detectBanners } from '../kernels';

export function analyzeImageData(imageData: ImageData, pageIndex: number): PageProfile {
  const { width, height, data } = imageData;
  const totalPixels = width * height;
  let sumLuminance = 0, darkPixelCount = 0, lightPixelCount = 0;
  const step = Math.max(1, Math.floor(Math.sqrt(totalPixels / 100000)));
  let sampledCount = 0;
  const maxSamples = Math.ceil(height / step) * Math.ceil(width / step);
  const luminances = new Float64Array(Math.max(1, maxSamples));
  let lumIdx = 0;
  for (let y = 0; y < height; y += step) {
    const ro = y * width * 4;
    for (let x = 0; x < width; x += step) {
      const idx = ro + x * 4;
      const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
      sumLuminance += lum; luminances[lumIdx++] = lum; sampledCount++;
      if (lum < 60) darkPixelCount++;
      if (lum > 200) lightPixelCount++;
    }
  }
  const avgBrightness = sumLuminance / sampledCount;
  let sumVar = 0;
  for (let i = 0; i < lumIdx; i++) { const d = luminances[i] - avgBrightness; sumVar += d * d; }
  const contrast = Math.sqrt(sumVar / sampledCount);
  const darkBgRatio = darkPixelCount / sampledCount;
  const lightBgRatio = lightPixelCount / sampledCount;
  const { topBannerPct, bottomBannerPct } = detectBanners(data, width, height);
  const inkDensity = 1 - lightBgRatio;
  let classification: PageClassification = 'LIGHT_SLIDE';
  if (darkBgRatio > 0.45) classification = 'DARK_SLIDE';
  else if (contrast > 65) classification = 'DIAGRAM_EQUATION';
  else if (darkBgRatio < 0.15 && lightBgRatio > 0.65) classification = 'LIGHT_SLIDE';
  else if (inkDensity > 0.35) classification = 'HANDWRITTEN_NOTES';
  else classification = 'MIXED';
  return {
    pageIndex, width, height,
    averageBrightness: Math.round(avgBrightness), contrast: Math.round(contrast),
    inkDensity: Number(inkDensity.toFixed(3)),
    darkBackgroundRatio: Number(darkBgRatio.toFixed(3)),
    lightBackgroundRatio: Number(lightBgRatio.toFixed(3)),
    dominantHue: 0,
    hasTopBanner: topBannerPct > 0.03, topBannerHeightPct: Number(topBannerPct.toFixed(3)),
    hasBottomBanner: bottomBannerPct > 0.03, bottomBannerHeightPct: Number(bottomBannerPct.toFixed(3)),
    estimatedNoise: Math.round(Math.max(0, 100 - contrast)),
    strokeThickness: darkBgRatio > 0.5 ? 2.5 : 1.8, classification,
  };
}
