// tests/validators/outputValidator.ts
import { calculateInkCoverage } from '../../lib/kernels';
import { ProcessingParameters } from '../../lib/optimizer/types';

export interface ValidationResult {
  passed: boolean;
  inkCoverageDiff: number;
  brightnessDiff: number;
  message: string;
}

/**
 * Validates that processed image output matches expected characteristics within tolerance.
 * Tolerance is ±5% for ink coverage and brightness metrics.
 */
export function validateOutput(
  originalImageData: ImageData,
  processedImageData: ImageData,
  params: ProcessingParameters,
  expectedInkCoveragePct: number,
  tolerancePct: number = 5.0
): ValidationResult {
  const originalCoverage = calculateInkCoverage(originalImageData.data);
  const processedCoverage = calculateInkCoverage(processedImageData.data);
  
  const inkCoverageDiff = Math.abs(processedCoverage - expectedInkCoveragePct);
  
  // Calculate average brightness of processed image
  let sumBrightness = 0;
  const step = Math.max(1, Math.floor(processedImageData.data.length / 4 / 1000));
  let count = 0;
  for (let i = 0; i < processedImageData.data.length; i += 4 * step) {
    sumBrightness += 0.299 * processedImageData.data[i] + 0.587 * processedImageData.data[i + 1] + 0.114 * processedImageData.data[i + 2];
    count++;
  }
  const avgBrightness = sumBrightness / count;
  const brightnessDiff = Math.abs(avgBrightness - (params.invertMode === 'smart' ? 240 : 250)); // Expected brightness after processing

  const passed = inkCoverageDiff <= tolerancePct;

  return {
    passed,
    inkCoverageDiff,
    brightnessDiff,
    message: passed 
      ? `Validation passed. Ink coverage: ${processedCoverage.toFixed(1)}% (expected ~${expectedInkCoveragePct}%, diff: ${inkCoverageDiff.toFixed(1)}%)`
      : `Validation failed. Ink coverage diff: ${inkCoverageDiff.toFixed(1)}% exceeds tolerance of ${tolerancePct}%`,
  };
}
