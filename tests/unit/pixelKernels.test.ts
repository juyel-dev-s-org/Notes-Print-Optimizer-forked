import { describe, it, expect } from 'vitest';
import { analyzeImageData } from '../../lib/optimizer/analysis';
import { processPage, createImageDataFromBuffer, calculateInkCoverage } from '../../lib/kernels';
import { applyUnsharpMask, applyUnsharpMaskBW } from '../../lib/kernels/sharpen';
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

  describe('applyUnsharpMask', () => {
    it('matches a full-copy mathematical reference (rolling-buffer correctness)', () => {
      const w = 37;
      const h = 23;
      const n = w * h * 4;
      const src = new Uint8ClampedArray(n);
      for (let i = 0; i < n; i++) src[i] = ((i * 7 + (i / 3) | 0) % 256);

      /* Full-copy reference: sharpens from an unmodified snapshot (correct). */
      const reference = (data: Uint8ClampedArray): void => {
        const cp = new Uint8ClampedArray(data);
        const amt = 0.7;
        for (let y = 1; y < h - 1; y++) {
          const ro = y * w * 4, pro = (y - 1) * w * 4, nro = (y + 1) * w * 4;
          for (let x = 1; x < w - 1; x++) {
            const idx = ro + x * 4;
            for (let c = 0; c < 3; c++) {
              const ctr = cp[idx + c];
              const lap = 4 * ctr - cp[pro + x * 4 + c] - cp[nro + x * 4 + c] - cp[idx - 4 + c] - cp[idx + 4 + c];
              const en = ctr + amt * lap;
              data[idx + c] = en < 0 ? 0 : en > 255 ? 255 : (en + 0.5) | 0;
            }
          }
        }
      };

      const a = new Uint8ClampedArray(src);
      const b = new Uint8ClampedArray(src);
      reference(a);
      applyUnsharpMask(b, w, h, 0.7);
      expect(b).toEqual(a);
    });
  });

  describe('applyUnsharpMaskBW', () => {
    it('is byte-identical to the 3-channel version on strictly B/W data', () => {
      const w = 47;
      const h = 31;
      const n = w * h * 4;
      const bw = new Uint8ClampedArray(n);
      for (let i = 0; i < n / 4; i++) {
        const v = (i * 7 + (i / 3) | 0) % 5 === 0 ? 0 : 255;
        bw[i * 4] = v; bw[i * 4 + 1] = v; bw[i * 4 + 2] = v; bw[i * 4 + 3] = 255;
      }

      const a = new Uint8ClampedArray(bw);
      const b = new Uint8ClampedArray(bw);
      applyUnsharpMask(a, w, h, 0.35);
      applyUnsharpMaskBW(b, w, h, 0.35);
      expect(b).toEqual(a);
    });

    it('keeps alpha and boundary pixels untouched', () => {
      const w = 21;
      const h = 17;
      const n = w * h * 4;
      const bw = new Uint8ClampedArray(n);
      for (let i = 0; i < n / 4; i++) {
        const v = i % 3 === 0 ? 0 : 255;
        bw[i * 4] = v; bw[i * 4 + 1] = v; bw[i * 4 + 2] = v;
        bw[i * 4 + 3] = 200;
      }
      const original = new Uint8ClampedArray(bw);
      applyUnsharpMaskBW(bw, w, h, 1.0);
      for (let i = 0; i < n / 4; i++) expect(bw[i * 4 + 3]).toBe(200);
      /* boundary row/col unchanged */
      for (let y = 0; y < h; y++) {
        const top = y * w * 4;
        expect(bw[top]).toBe(original[top]);
        expect(bw[top + (w - 1) * 4]).toBe(original[top + (w - 1) * 4]);
      }
      for (let x = 0; x < w; x++) {
        const row = x * 4;
        expect(bw[row]).toBe(original[row]);
        expect(bw[(h - 1) * w * 4 + row]).toBe(original[(h - 1) * w * 4 + row]);
      }
    });

    it('no-ops on tiny images like the 3-channel version', () => {
      const tiny = new Uint8ClampedArray([10, 10, 10, 255, 250, 250, 250, 255, 10, 10, 10, 255]);
      const a = new Uint8ClampedArray(tiny);
      const b = new Uint8ClampedArray(tiny);
      applyUnsharpMaskBW(a, 3, 1, 0.5);
      applyUnsharpMask(b, 3, 1, 0.5);
      expect(a).toEqual(tiny);
      expect(b).toEqual(a);
    });
  });
});
