import {
  PageProfile,
  ProcessingParameters,
} from '../types';
import {
  EngineCapabilities,
  EngineDocumentInput,
  EngineDocumentOutput,
  EnginePageProcessResult,
  EngineProcessingOptions,
  EngineProgressCallback,
  EngineVersion,
} from './types';

export interface IProcessingEngine {
  /** Unique engine identifier e.g. 'pw-pixel-v1' */
  readonly id: string;

  /** Semantic engine version e.g. 'v1' */
  readonly version: EngineVersion;

  /** Human-readable engine name e.g. 'PW High-Speed Pixel Engine v1' */
  readonly name: string;

  /** Detailed engine description */
  readonly description: string;

  /** Technical engine capabilities */
  readonly capabilities: EngineCapabilities;

  /**
   * Fast pass 1: Analyze raw ImageData statistics (brightness, contrast, banners, dark slides)
   */
  analyzePage(imageData: ImageData, pageIndex: number): Promise<PageProfile>;

  /**
   * Pass 2: Execute background removal, dark slide inversion, hue remapping & sharpening on a single page
   */
  processPage(
    imageData: ImageData,
    pageIndex: number,
    params: ProcessingParameters,
    profile: PageProfile
  ): Promise<EnginePageProcessResult>;

  /**
   * Standalone full document processing pipeline (PDF extraction -> analysis -> optimization -> IndexedDB caching)
   */
  processDocument(
    input: EngineDocumentInput,
    options?: EngineProcessingOptions,
    onProgress?: EngineProgressCallback
  ): Promise<EngineDocumentOutput>;
}
