import {
  DocumentProfile,
  PresetMode,
  ProcessedPage,
  ProcessingParameters,
  OptimizationMetrics,
} from '../types';

export type EngineVersion = 'v2';

export interface EngineCapabilities {
  supportsWebWorkers: boolean;
  supportsSmartColorRemap: boolean;
  supportsAutoBannerCrop: boolean;
  maxConcurrentPages: number;
  engineDescription: string;
}

export interface EngineDocumentInput {
  pdfBuffer: ArrayBuffer;
  pdfId: string;
  presetMode?: PresetMode;
  customParams?: Partial<ProcessingParameters>;
}

export interface EngineProcessingOptions {
  renderScale?: number;
  enableWorkers?: boolean;
  presetMode?: PresetMode;
  executionMode?: 'auto' | 'parallel' | 'sequential' | 'hybrid';
  signal?: AbortSignal;
}

export type EngineProgressCallback = (current: number, total: number, action: string) => void;

export type EnginePageOptimizedCallback = (pageIndex: number, thumbnailUrl: string, inkBeforePct: number, inkAfterPct: number) => void;

export interface EnginePageProcessResult {
  pageIndex: number;
  optimizedImageData: ImageData;
  inkCoverageBeforePct: number;
  inkCoverageAfterPct: number;
  processingTimeMs: number;
  /** White boxes restored from the original render (see kernels/whiteBox). */
  whiteBoxRegions?: Array<{ x: number; y: number; width: number; height: number }>;
}

export interface EngineDocumentOutput {
  processedPages: ProcessedPage[];
  docProfile: DocumentProfile;
  engineVersion: EngineVersion;
  engineId: string;
  totalTimeMs: number;
  metrics?: Partial<OptimizationMetrics>;
}
