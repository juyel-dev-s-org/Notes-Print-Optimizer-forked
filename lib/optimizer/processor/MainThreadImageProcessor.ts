import type { PageClassification, PageProfile, ProcessingParameters } from '../types';
import type { WorkerProcessResult } from '../worker/protocol';
import type { IImageProcessor, ProcessorCapabilities } from './IImageProcessor';
import { processPage, calculateInkCoverage, createImageDataFromBuffer } from '../worker/kernels';
import { getLuminance } from '../worker/kernels';
import { rgbToHsv } from '../worker/kernels';
import { stripDecorativeFills } from '../worker/kernels';
import { removeNoise, applyMaskDilation, applyUnsharpMask } from '../worker/kernels';

function detectBanners(data: Uint8ClampedArray, width: number, height: number) {
  let topRows = 0, bottomRows = 0;
  const rStep = 4, wStep = Math.max(1, Math.floor(width / 50));
  for (let y = 0; y < Math.floor(height * 0.25); y += rStep) {
    let first = -1, uniform = true;
    for (let x = 0; x < width; x += wStep) {
      const idx = (y * width + x) * 4;
      const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
      if (first === -1) first = lum; else if (Math.abs(lum - first) > 35) { uniform = false; break; }
    }
    if (uniform && first < 120) topRows = y + rStep; else if (y > 10) break;
  }
  for (let y = height - 1; y > Math.floor(height * 0.75); y -= rStep) {
    let first = -1, uniform = true;
    for (let x = 0; x < width; x += wStep) {
      const idx = (y * width + x) * 4;
      const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
      if (first === -1) first = lum; else if (Math.abs(lum - first) > 35) { uniform = false; break; }
    }
    if (uniform) bottomRows = height - y; else if (height - y > 10) break;
  }
  return { topBannerPct: topRows / height, bottomBannerPct: bottomRows / height };
}

export class MainThreadImageProcessor implements IImageProcessor {
  readonly name = 'main-thread';
  readonly capabilities: ProcessorCapabilities = {
    supportsWorkers: false,
    supportsConcurrentPages: false,
    maxConcurrentPages: 1,
  };

  async analyzePage(imageData: ImageData, pageIndex: number): Promise<PageProfile> {
    const { width, height, data } = imageData;
    const totalPixels = width * height;
    let sumLuminance = 0, darkPixelCount = 0, lightPixelCount = 0;
    const step = Math.max(1, Math.floor(Math.sqrt(totalPixels / 100000)));
    let sampledCount = 0;
    const luminances = new Float64Array(Math.ceil(height / step) * Math.ceil(width / step));
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

  async processPage(
    imageData: ImageData,
    pageIndex: number,
    params: ProcessingParameters,
    profile: PageProfile
  ): Promise<WorkerProcessResult> {
    const result = processPage(imageData.data, imageData.width, imageData.height, params, profile);
    const optimizedImageData = createImageDataFromBuffer(result.buffer, result.width, result.height);
    const ib = calculateInkCoverage(imageData.data);
    const ia = calculateInkCoverage(new Uint8ClampedArray(result.buffer));
    return {
      pageIndex,
      optimizedImageData,
      inkCoverageBeforePct: ib,
      inkCoverageAfterPct: ia,
    };
  }

  async calculateInkCoverage(imageData: ImageData): Promise<number> {
    return calculateInkCoverage(imageData.data);
  }
}
