import { describe, it, expect } from 'vitest';
import { analyzeImageData } from '../../lib/optimizer/analysis';
import { processPage, createImageDataFromBuffer } from '../../lib/kernels';
import { ParameterGenerator } from '../../lib/optimizer/parameterGenerator';
import { benchmark } from '../../lib/optimizer/perf/benchmark';
import { jsKernels } from '../../lib/wasm/jsFallback';

// Regression thresholds (MPx/s) — tune if hardware differs
const REGRESSION_THRESHOLDS: Record<string, number> = {
  analyze: 5,
  process: 5,
  rgbToHsvBatch: 3,
  classifyColors: 5,
  dilateMask: 10,
  unsharpMask: 3,
  removeNoise: 1,
  inkCoverage: 30,
  connectedComponents: 10,
};

function createSyntheticImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    data[idx] = 245; data[idx + 1] = 245; data[idx + 2] = 245; data[idx + 3] = 255;
    if (i % 30 === 0) { data[idx] = 20; data[idx + 1] = 20; data[idx + 2] = 20; }
  }
  return new ImageData(data, width, height);
}

function randomMask(w: number, h: number): Uint8Array {
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = Math.random() > 0.9 ? 1 : 0;
  return m;
}

describe('Pipeline Benchmarks', () => {
  it('should benchmark analyze and process stages', () => {
    const width = 800;
    const height = 1000;
    const imageData = createSyntheticImageData(width, height);
    const params = ParameterGenerator.getPresetParameters('LIGHT_HANDWRITTEN');
    const pixels = width * height;

    benchmark.reset();

    benchmark.startStage('analyze');
    const profile = analyzeImageData(imageData, 0);
    benchmark.endStage('analyze', pixels);

    benchmark.startStage('process');
    const result = processPage(imageData.data, imageData.width, imageData.height, params, profile);
    const processed = createImageDataFromBuffer(result.buffer, result.width, result.height);
    benchmark.endStage('process', pixels);

    benchmark.printSummary();

    expect(profile).toBeDefined();
    expect(processed).toBeDefined();
    expect(processed.width).toBe(width);
    expect(processed.height).toBe(height);

    const results = benchmark.getResults();
    expect(results.length).toBe(2);
    expect(results[0].stage).toBe('analyze');
    expect(results[1].stage).toBe('process');
    for (const r of results) {
      const threshold = REGRESSION_THRESHOLDS[r.stage];
      if (threshold && r.megapixelsPerSec !== undefined) {
        expect(r.megapixelsPerSec).toBeGreaterThan(threshold);
      }
    }
  });
});

describe('Kernel Benchmarks (JS fallback)', () => {
  const W = 1000, H = 1000, PIXELS = W * H;
  const rgba = new Uint8ClampedArray(PIXELS * 4);
  for (let i = 0; i < PIXELS; i++) {
    rgba[i * 4] = Math.floor(Math.random() * 256);
    rgba[i * 4 + 1] = Math.floor(Math.random() * 256);
    rgba[i * 4 + 2] = Math.floor(Math.random() * 256);
    rgba[i * 4 + 3] = 255;
  }

  function checkRegression(stage: string, results: any[]) {
    const r = results.find(x => x.stage === stage);
    const threshold = REGRESSION_THRESHOLDS[stage];
    if (r && threshold !== undefined && r.megapixelsPerSec !== undefined) {
      expect(r.megapixelsPerSec).toBeGreaterThan(threshold);
    }
  }

  it('rgbToHsvBatch', () => {
    benchmark.reset();
    benchmark.startStage('rgbToHsvBatch');
    const result = jsKernels.rgbToHsvBatch(rgba, PIXELS);
    benchmark.endStage('rgbToHsvBatch', PIXELS);
    benchmark.printSummary();
    expect(result.length).toBe(PIXELS * 3);
    checkRegression('rgbToHsvBatch', benchmark.getResults());
  });

  it('classifyColors', () => {
    const hsv = jsKernels.rgbToHsvBatch(rgba, PIXELS);
    benchmark.reset();
    benchmark.startStage('classifyColors');
    const result = jsKernels.classifyColors(hsv, PIXELS);
    benchmark.endStage('classifyColors', PIXELS);
    benchmark.printSummary();
    expect(result.length).toBe(PIXELS * 7);
    checkRegression('classifyColors', benchmark.getResults());
  });

  it('dilateMask ks=3', () => {
    const mask = randomMask(W, H);
    benchmark.reset();
    benchmark.startStage('dilateMask');
    jsKernels.dilateMask(mask, W, H, 3);
    benchmark.endStage('dilateMask', PIXELS);
    benchmark.printSummary();
    checkRegression('dilateMask', benchmark.getResults());
  });

  it('unsharpMask', () => {
    const data = new Uint8ClampedArray(rgba);
    benchmark.reset();
    benchmark.startStage('unsharpMask');
    jsKernels.unsharpMask(data, W, H, 0.5);
    benchmark.endStage('unsharpMask', PIXELS);
    benchmark.printSummary();
    checkRegression('unsharpMask', benchmark.getResults());
  });

  it('removeNoise', () => {
    const mask = randomMask(200, 200);
    benchmark.reset();
    benchmark.startStage('removeNoise');
    jsKernels.removeNoise(mask, 200, 200);
    benchmark.endStage('removeNoise', 40000);
    benchmark.printSummary();
    checkRegression('removeNoise', benchmark.getResults());
  });

  it('inkCoverage', () => {
    benchmark.reset();
    benchmark.startStage('inkCoverage');
    const result = jsKernels.inkCoverage(rgba, PIXELS, 240);
    benchmark.endStage('inkCoverage', PIXELS);
    benchmark.printSummary();
    expect(result).toBeGreaterThan(0);
    checkRegression('inkCoverage', benchmark.getResults());
  });

  it('connectedComponents', () => {
    const mask = randomMask(200, 200);
    benchmark.reset();
    benchmark.startStage('connectedComponents');
    const result = jsKernels.connectedComponents(mask, 200, 200);
    benchmark.endStage('connectedComponents', 40000);
    benchmark.printSummary();
    expect(result.length).toBe(40000);
    checkRegression('connectedComponents', benchmark.getResults());
  });
});
