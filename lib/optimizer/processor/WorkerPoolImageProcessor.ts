import type { PageProfile, ProcessingParameters } from '../types';
import type { IImageProcessor, ProcessorCapabilities } from './IImageProcessor';
import type { WorkerProcessResult } from '../../workers/protocol';
import { WorkerManager } from '../../workers/WorkerManager';
import { MainThreadImageProcessor } from './MainThreadImageProcessor';
import '../../workers/init';

const wm = WorkerManager.getInstance();

export class WorkerPoolImageProcessor implements IImageProcessor {
  readonly name = 'worker-pool';
  readonly capabilities: ProcessorCapabilities = {
    supportsWorkers: wm.isWorkerSupported(),
    supportsConcurrentPages: wm.isWorkerSupported(),
    maxConcurrentPages: wm.isWorkerSupported()
      ? (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4)
      : 1,
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
    if (wm.isWorkerSupported()) {
      try {
        const pool = wm.getPool();
        const result = await pool.submitPixelTask({
          pageIndex,
          buffer: imageData.data.slice().buffer,
          width: imageData.width,
          height: imageData.height,
          params: {
            invertMode: params.invertMode,
            bannerCropTopPct: params.bannerCropTopPct,
            bannerCropBottomPct: params.bannerCropBottomPct,
            strokeEnhancement: params.strokeEnhancement,
            sharpenAmount: params.sharpenAmount,
            /* Previously dropped here: the worker re-derived the kernel
               size from strokeEnhancement, silently capping the slider at
               'strong' (5px). Forward the exact value. */
            dilationKernelSize: params.dilationKernelSize,
            autoWhiteBoxFix: params.autoWhiteBoxFix,
          },
          profile: { classification: profile.classification, darkBackgroundRatio: profile.darkBackgroundRatio },
        });
        return {
          pageIndex: result.pageIndex,
          optimizedImageData: new ImageData(new Uint8ClampedArray(result.buffer), result.width, result.height),
          inkCoverageBeforePct: result.inkCoverageBeforePct,
          inkCoverageAfterPct: result.inkCoverageAfterPct,
          whiteBoxRegions: result.whiteBoxRegions,
        };
      } catch {
        // Worker failed — fall through to main thread
      }
    }
    return this.fallback.processPage(imageData, pageIndex, params, profile);
  }

  async calculateInkCoverage(imageData: ImageData): Promise<number> {
    return this.fallback.calculateInkCoverage(imageData);
  }
}
