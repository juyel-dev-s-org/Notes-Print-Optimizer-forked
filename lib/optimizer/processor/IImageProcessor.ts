import type {
  PageProfile,
  ProcessingParameters,
} from '../types';
import type { WorkerProcessResult } from '../worker/protocol';

export interface ProcessorCapabilities {
  supportsWorkers: boolean;
  supportsConcurrentPages: boolean;
  maxConcurrentPages: number;
}

export interface IImageProcessor {
  readonly name: string;
  readonly capabilities: ProcessorCapabilities;

  analyzePage(
    imageData: ImageData,
    pageIndex: number
  ): Promise<PageProfile>;

  processPage(
    imageData: ImageData,
    pageIndex: number,
    params: ProcessingParameters,
    profile: PageProfile
  ): Promise<WorkerProcessResult>;

  calculateInkCoverage(imageData: ImageData): Promise<number>;
}
