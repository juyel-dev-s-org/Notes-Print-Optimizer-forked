import type { PageProfile, ProcessingParameters } from '../types';
import type { IImageProcessor, ProcessorCapabilities } from './IImageProcessor';
import type { WorkerProcessResult } from '../worker/protocol';
import { workerPool } from '../workerPool';
import { createImageDataFromBuffer } from '../worker/kernels';
import { MainThreadImageProcessor } from './MainThreadImageProcessor';

export class WorkerPoolImageProcessor implements IImageProcessor {
  readonly name = 'worker-pool';
  readonly capabilities: ProcessorCapabilities = {
    supportsWorkers: true,
    supportsConcurrentPages: true,
    maxConcurrentPages: navigator.hardwareConcurrency || 4,
  };
  private fallback = new MainThreadImageProcessor();

  async analyzePage(imageData: ImageData, pageIndex: number): Promise<PageProfile> {
    return this.fallback.analyzePage(imageData, pageIndex);
  }

  async processPage(
    imageData: ImageData,
    pageIndex: number,
    params: ProcessingParameters,
    profile: PageProfile
  ): Promise<WorkerProcessResult> {
    try {
      return await workerPool.processPage(pageIndex, imageData, params, profile);
    } catch {
      return this.fallback.processPage(imageData, pageIndex, params, profile);
    }
  }

  async calculateInkCoverage(imageData: ImageData): Promise<number> {
    return this.fallback.calculateInkCoverage(imageData);
  }
}
