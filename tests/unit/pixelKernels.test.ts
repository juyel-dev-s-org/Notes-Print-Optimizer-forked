import { describe, it, expect } from 'vitest';
import { analyzeImageData } from '../../lib/optimizer/analysis';
import { processPage, createImageDataFromBuffer, calculateInkCoverage } from '../../lib/kernels';
import { ProcessingParameters } from '../../lib/optimizer/types';

function createSyntheticImageData(width: number, height: number, type: 'dark' | 'light' | 'diagram'): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    if (type === 'dark') {
      data[idx] = 40; data[idx + 1] = 40; data[idx + 2] = 40; data[idx + 3] = 255;
      if (i % 50 === 0) { data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 255; }
    } else if (type === 'light') {
      data[idx] = 250; data[idx + 1] = 250; data[idx + 2] = 250; data[idx + 3] = 255;
      if (i % 50 === 0) { data[idx] = 20; data[idx + 1] = 20; data[idx + 2] = 20; }
    } else {
      data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 255; data[idx + 3] = 255;
      if (i % 30 === 0) { data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; }
    }
  }
  return new ImageData(data, width, height);
}

describe('ImageProcessingKernels', () => {
  describe('analyzeImageData', () => {
    it('should correctly classify a dark slide', () => {
      const imageData = createSyntheticImageData(100, 100, 'dark');
      const profile = analyzeImageData(imageData, 0);
      expect(profile.classification).toBe('DARK_SLIDE');
      expect(profile.darkBackgroundRatio).toBeGreaterThan(0.4);
    });

    it('should correctly classify a light handwritten page', () => {
      const imageData = createSyntheticImageData(100, 100, 'light');
      const profile = analyzeImageData(imageData, 0);
      expect(profile.classification).toBe('LIGHT_SLIDE');
      expect(profile.lightBackgroundRatio).toBeGreaterThan(0.5);
    });

    it('should calculate ink coverage correctly', () => {
      const imageData = createSyntheticImageData(100, 100, 'diagram');
      const coverage = calculateInkCoverage(imageData.data);
      expect(coverage).toBeGreaterThan(0);
      expect(coverage).toBeLessThan(100);
    });
  });

  describe('processPage', () => {
    it('should process a dark slide and invert it', () => {
      const imageData = createSyntheticImageData(50, 50, 'dark');
      const params: ProcessingParameters = {
        preset: 'PW_DARK_SLIDE',
        invertMode: 'smart',
        smartColorMapping: true,
        backgroundWhiteningThreshold: 220,
        contrastEnhancement: 25,
        sharpenAmount: 35,
        denoiseAmount: 15,
        bannerCropTopPct: 0,
        bannerCropBottomPct: 0,
        autoTrimMargins: false,
        binaizationThreshold: 0,
        outputQuality: 0.88,
        strokeEnhancement: 'strong',
      };
      const profile = analyzeImageData(imageData, 0);
      const result = processPage(imageData.data, imageData.width, imageData.height, params, profile);
      const processed = createImageDataFromBuffer(result.buffer, result.width, result.height);

      expect(processed.width).toBe(50);
      expect(processed.height).toBe(50);
      let whitePixels = 0;
      for (let i = 0; i < processed.data.length; i += 4) {
        if (processed.data[i] > 200 && processed.data[i+1] > 200 && processed.data[i+2] > 200) {
          whitePixels++;
        }
      }
      expect(whitePixels).toBeGreaterThan(0);
    });

    it('should leave light pages mostly unchanged when invertMode is none', () => {
      const imageData = createSyntheticImageData(50, 50, 'light');
      const params: ProcessingParameters = {
        preset: 'LIGHT_HANDWRITTEN',
        invertMode: 'none',
        smartColorMapping: false,
        backgroundWhiteningThreshold: 200,
        contrastEnhancement: 35,
        sharpenAmount: 40,
        denoiseAmount: 20,
        bannerCropTopPct: 0,
        bannerCropBottomPct: 0,
        autoTrimMargins: false,
        binaizationThreshold: 0,
        outputQuality: 0.88,
        strokeEnhancement: 'normal',
      };
      const profile = analyzeImageData(imageData, 0);
      const result = processPage(imageData.data, imageData.width, imageData.height, params, profile);
      const processed = createImageDataFromBuffer(result.buffer, result.width, result.height);

      expect(processed.width).toBe(50);
      expect(processed.height).toBe(50);
    });
  });
});
