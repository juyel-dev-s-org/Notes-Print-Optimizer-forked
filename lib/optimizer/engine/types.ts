import {
  DocumentProfile,
  PageProfile,
  PresetMode,
  ProcessedPage,
  ProcessingParameters,
  OptimizationMetrics,
} from '../types';

export type EngineVersion = 'v1' | 'v2' | 'v3' | string;

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
}

interface EngineProgressInfo {
  stage: 'ANALYZING' | 'OPTIMIZING' | 'COMPLETE' | 'ERROR';
  currentPage: number;
  totalPages: number;
  action: string;
  percent: number;
}

export type EngineProgressCallback = (current: number, total: number, action: string) => void;

export interface EnginePageProcessResult {
  pageIndex: number;
  optimizedImageData: ImageData;
  inkCoverageBeforePct: number;
  inkCoverageAfterPct: number;
  processingTimeMs: number;
}

export interface EngineDocumentOutput {
  processedPages: ProcessedPage[];
  docProfile: DocumentProfile;
  engineVersion: string;
  engineId: string;
  totalTimeMs: number;
  metrics?: Partial<OptimizationMetrics>;
}
