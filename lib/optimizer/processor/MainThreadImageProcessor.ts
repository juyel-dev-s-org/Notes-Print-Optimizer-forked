import type { PageProfile, ProcessingParameters } from '../types';
import type { WorkerProcessResult } from '../../workers/protocol';
import type { IImageProcessor, ProcessorCapabilities } from './IImageProcessor';
import { calculateInkCoverage, createImageDataFromBuffer } from '../../kernels';
import { processPageWithWhiteBoxHeal } from '../../kernels/whiteBox';
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
    /* Same heal wrapper as the worker — identical output either path. */
    const healed = processPageWithWhiteBoxHeal(imageData.data, imageData.width, imageData.height, params, profile);
    const optimizedImageData = createImageDataFromBuffer(healed.buffer, healed.width, healed.height);
    const ib = calculateInkCoverage(imageData.data);
    const ia = calculateInkCoverage(new Uint8ClampedArray(healed.buffer));
    return {
      pageIndex,
      optimizedImageData,
      inkCoverageBeforePct: ib,
      inkCoverageAfterPct: ia,
      whiteBoxRegions: healed.whiteBoxRegions,
    };
  }

  async calculateInkCoverage(imageData: ImageData): Promise<number> {
    return calculateInkCoverage(imageData.data);
  }
}
