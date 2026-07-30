import { describe, it, expect } from 'vitest';
import { MainThreadImageProcessor } from '../../lib/optimizer/processor/MainThreadImageProcessor';
import { WorkerPoolImageProcessor } from '../../lib/optimizer/processor/WorkerPoolImageProcessor';
import type { ProcessingParameters } from '../../lib/optimizer/types';

function createSyntheticImage(width: number, height: number, type: 'dark' | 'light' | 'diagram'): ImageData {
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

const testParams: ProcessingParameters = {
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

describe('Processor Parity', () => {
  const mainThread = new MainThreadImageProcessor();
  const workerPool = new WorkerPoolImageProcessor();

  it('should produce identical analyzePage results for dark slides', async () => {
    const img = createSyntheticImage(50, 50, 'dark');
    const [p1, p2] = await Promise.all([
      mainThread.analyzePage(img, 0),
      workerPool.analyzePage(img, 0),
    ]);
    expect(p1).toEqual(p2);
  });

  it('should produce identical analyzePage results for light slides', async () => {
    const img = createSyntheticImage(50, 50, 'light');
    const [p1, p2] = await Promise.all([
      mainThread.analyzePage(img, 0),
      workerPool.analyzePage(img, 0),
    ]);
    expect(p1).toEqual(p2);
  });

  it('should produce identical analyzePage results for diagrams', async () => {
    const img = createSyntheticImage(50, 50, 'diagram');
    const [p1, p2] = await Promise.all([
      mainThread.analyzePage(img, 0),
      workerPool.analyzePage(img, 0),
    ]);
    expect(p1).toEqual(p2);
  });

  it('should produce identical processPage pixel output', async () => {
    const img = createSyntheticImage(50, 50, 'dark');
    const profile = await mainThread.analyzePage(img, 0);
    const [r1, r2] = await Promise.all([
      mainThread.processPage(img, 0, testParams, profile),
      workerPool.processPage(img, 0, testParams, profile),
    ]);
    expect(r1.pageIndex).toBe(r2.pageIndex);
    expect(r1.inkCoverageBeforePct).toBe(r2.inkCoverageBeforePct);
    expect(r1.inkCoverageAfterPct).toBe(r2.inkCoverageAfterPct);
    expect(Array.from(r1.optimizedImageData.data)).toEqual(Array.from(r2.optimizedImageData.data));
  });

  it('should produce identical calculateInkCoverage results', async () => {
    const img = createSyntheticImage(50, 50, 'light');
    const [c1, c2] = await Promise.all([
      mainThread.calculateInkCoverage(img),
      workerPool.calculateInkCoverage(img),
    ]);
    expect(c1).toBe(c2);
  });
});
