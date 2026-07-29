import { describe, it, expect } from 'vitest';
import { ImageProcessingKernels } from '../../lib/optimizer/pixelKernels';
import { ParameterGenerator } from '../../lib/optimizer/parameterGenerator';
import { benchmark } from '../../lib/optimizer/perf/benchmark';

// Helper to create synthetic ImageData
function createSyntheticImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    data[idx] = 245; data[idx + 1] = 245; data[idx + 2] = 245; data[idx + 3] = 255;
    if (i % 30 === 0) { data[idx] = 20; data[idx + 1] = 20; data[idx + 2] = 20; }
  }
  return new ImageData(data, width, height);
}

describe('Pipeline Benchmarks', () => {
  it('should benchmark analyze and process stages', () => {
    const width = 800;
    const height = 1000;
    const imageData = createSyntheticImageData(width, height);
    const params = ParameterGenerator.getPresetParameters('LIGHT_HANDWRITTEN');
    const pixels = width * height;

    benchmark.reset();

    // Benchmark analyze stage
    benchmark.startStage('analyze');
    const profile = ImageProcessingKernels.analyzeImageData(imageData, 0);
    benchmark.endStage('analyze', pixels);

    // Benchmark process stage
    benchmark.startStage('process');
    const processed = ImageProcessingKernels.processImage(imageData, params, profile);
    benchmark.endStage('process', pixels);

    benchmark.printSummary();

    // Basic assertions to ensure benchmark ran correctly
    expect(profile).toBeDefined();
    expect(processed).toBeDefined();
    expect(processed.width).toBe(width);
    expect(processed.height).toBe(height);
    
    const results = benchmark.getResults();
    expect(results.length).toBe(2);
    expect(results[0].stage).toBe('analyze');
    expect(results[1].stage).toBe('process');
  });
});
