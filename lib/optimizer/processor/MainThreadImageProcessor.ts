import type { PageProfile, ProcessingParameters } from '../types';
import type { WorkerProcessResult } from '../../workers/protocol';
import type { IImageProcessor, ProcessorCapabilities } from './IImageProcessor';
import { processPage, calculateInkCoverage, createImageDataFromBuffer } from '../../kernels';
import { analyzeImageData } from '../analysis';

export class MainThreadImageProcessor implements IImageProcessor {
  readonly name = 'main-thread';
  readonly capabilities: ProcessorCapabilities = {
    supportsWorkers: false,
    supportsConcurrentPages: false,
    maxConcurrentPages: 1,
  };

  async analyzePage(imageData: ImageData, pageIndex: number): Promise<PageProfile> {
    return analyzeImageData(imageData, pageIndex);
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
