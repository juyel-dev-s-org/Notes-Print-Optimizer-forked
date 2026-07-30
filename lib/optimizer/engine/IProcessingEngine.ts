import {
  PageProfile,
  ProcessingParameters,
} from '../types';
import {
  EngineCapabilities,
  EngineDocumentInput,
  EngineDocumentOutput,
  EnginePageProcessResult,
  EnginePageOptimizedCallback,
  EngineProcessingOptions,
  EngineProgressCallback,
  EngineVersion,
} from './types';

export interface IProcessingEngine {
  readonly id: string;
  readonly version: EngineVersion;
  readonly name: string;
  readonly description: string;
  readonly capabilities: EngineCapabilities;

  analyzePage(imageData: ImageData, pageIndex: number): Promise<PageProfile>;

  processPage(
    imageData: ImageData,
    pageIndex: number,
    params: ProcessingParameters,
    profile: PageProfile
  ): Promise<EnginePageProcessResult>;

  processDocument(
    input: EngineDocumentInput,
    options?: EngineProcessingOptions,
    onProgress?: EngineProgressCallback,
    onPageOptimized?: EnginePageOptimizedCallback,
  ): Promise<EngineDocumentOutput>;
}
