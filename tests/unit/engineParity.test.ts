import { describe, it, expect } from 'vitest';
import { ProcessingEngineV1 } from '../../lib/optimizer/engine/v1/ProcessingEngineV1';
import { ProcessingEngineV2 } from '../../lib/optimizer/engine/v2/ProcessingEngineV2';
import { MainThreadImageProcessor } from '../../lib/optimizer/processor/MainThreadImageProcessor';

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

describe('ProcessingEngineV1 vs V2 Parity', () => {
  const v1 = new ProcessingEngineV1(new MainThreadImageProcessor());
  const v2 = new ProcessingEngineV2();

  describe('analyzePage', () => {
    it('should produce identical profiles for dark slides', async () => {
      const img = createSyntheticImageData(100, 100, 'dark');
      const [p1, p2] = await Promise.all([v1.analyzePage(img, 0), v2.analyzePage(img, 0)]);
      expect(p1.classification).toBe(p2.classification);
      expect(p1.averageBrightness).toBe(p2.averageBrightness);
      expect(p1.contrast).toBe(p2.contrast);
      expect(p1.darkBackgroundRatio).toBe(p2.darkBackgroundRatio);
    });

    it('should produce identical profiles for light slides', async () => {
      const img = createSyntheticImageData(100, 100, 'light');
      const [p1, p2] = await Promise.all([v1.analyzePage(img, 0), v2.analyzePage(img, 0)]);
      expect(p1.classification).toBe(p2.classification);
      expect(p1.averageBrightness).toBe(p2.averageBrightness);
      expect(p1.lightBackgroundRatio).toBe(p2.lightBackgroundRatio);
    });

    it('should produce identical profiles for diagrams', async () => {
      const img = createSyntheticImageData(100, 100, 'diagram');
      const [p1, p2] = await Promise.all([v1.analyzePage(img, 0), v2.analyzePage(img, 0)]);
      expect(p1.classification).toBe(p2.classification);
      expect(p1.contrast).toBe(p2.contrast);
    });
  });

  describe('processPage', () => {
    it('should produce identical pixel output for dark slides', async () => {
      const img = createSyntheticImageData(50, 50, 'dark');
      const profile = await v1.analyzePage(img, 0);
      const [r1, r2] = await Promise.all([
        v1.processPage(img, 0, {
          preset: 'PW_DARK_SLIDE', invertMode: 'smart', smartColorMapping: true,
          backgroundWhiteningThreshold: 220, contrastEnhancement: 25, sharpenAmount: 35,
          denoiseAmount: 15, bannerCropTopPct: 0, bannerCropBottomPct: 0,
          autoTrimMargins: false, binaizationThreshold: 0, outputQuality: 0.88,
          strokeEnhancement: 'strong',
        }, profile),
        v2.processPage(img, 0, {
          preset: 'PW_DARK_SLIDE', invertMode: 'smart', smartColorMapping: true,
          backgroundWhiteningThreshold: 220, contrastEnhancement: 25, sharpenAmount: 35,
          denoiseAmount: 15, bannerCropTopPct: 0, bannerCropBottomPct: 0,
          autoTrimMargins: false, binaizationThreshold: 0, outputQuality: 0.88,
          strokeEnhancement: 'strong',
        }, profile),
      ]);

      expect(r1.optimizedImageData.width).toBe(r2.optimizedImageData.width);
      expect(r1.optimizedImageData.height).toBe(r2.optimizedImageData.height);
      expect(r1.inkCoverageBeforePct).toBe(r2.inkCoverageBeforePct);
      expect(r1.inkCoverageAfterPct).toBe(r2.inkCoverageAfterPct);

      let diffPx = 0;
      for (let i = 0; i < r1.optimizedImageData.data.length; i++) {
        if (r1.optimizedImageData.data[i] !== r2.optimizedImageData.data[i]) diffPx++;
      }
      expect(diffPx).toBe(0);
    });

    it('should produce identical pixel output for light slides', async () => {
      const img = createSyntheticImageData(50, 50, 'light');
      const profile = await v1.analyzePage(img, 0);
      const [r1, r2] = await Promise.all([
        v1.processPage(img, 0, {
          preset: 'LIGHT_HANDWRITTEN', invertMode: 'none', smartColorMapping: false,
          backgroundWhiteningThreshold: 200, contrastEnhancement: 35, sharpenAmount: 40,
          denoiseAmount: 20, bannerCropTopPct: 0, bannerCropBottomPct: 0,
          autoTrimMargins: false, binaizationThreshold: 0, outputQuality: 0.88,
          strokeEnhancement: 'normal',
        }, profile),
        v2.processPage(img, 0, {
          preset: 'LIGHT_HANDWRITTEN', invertMode: 'none', smartColorMapping: false,
          backgroundWhiteningThreshold: 200, contrastEnhancement: 35, sharpenAmount: 40,
          denoiseAmount: 20, bannerCropTopPct: 0, bannerCropBottomPct: 0,
          autoTrimMargins: false, binaizationThreshold: 0, outputQuality: 0.88,
          strokeEnhancement: 'normal',
        }, profile),
      ]);

      expect(r1.optimizedImageData.width).toBe(r2.optimizedImageData.width);
      expect(r1.optimizedImageData.height).toBe(r2.optimizedImageData.height);

      let diffPx = 0;
      for (let i = 0; i < r1.optimizedImageData.data.length; i++) {
        if (r1.optimizedImageData.data[i] !== r2.optimizedImageData.data[i]) diffPx++;
      }
      expect(diffPx).toBe(0);
    });
  });
});
