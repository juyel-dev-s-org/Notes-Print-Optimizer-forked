import type { WorkflowPhase, ProcessingToggleState } from '@/lib/workflow/types';
import type { EngineVersion } from '@/lib/optimizer/engine/types';
import type { ResumeInfo } from '@/lib/workflow/types';
import type {
  DocumentProfile,
  GridFormat,
  LayoutConfig,
  OptimizationMetrics,
  OuterMarginConfig,
  ProcessedPage,
  ProcessingParameters,
  ProcessingProgress,
} from '@/lib/optimizer/types';

interface UploadedPdfItem {
  id: string;
  file: File;
  name: string;
  sizeMB: string;
  arrayBuffer: ArrayBuffer;
}

export type { ResumeInfo };

export interface WorkflowUIProps {
  currentPhase: WorkflowPhase;
  setCurrentPhase: (phase: WorkflowPhase) => void;
  isProcessing: boolean;
  progress: ProcessingProgress | null;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;

  // Phase 1: Upload & Merge
  uploadedItems: UploadedPdfItem[];
  mergedPdfBlob: Blob | null;
  mergedPdfBytes: Uint8Array | null;
  mergedPageDataUrls: string[];
  selectedEngineVersion: EngineVersion;
  setSelectedEngineVersion: (version: EngineVersion) => void;
  onFilesUpload: (files: File[]) => void;
  onLoadSample: () => void;
  onMoveItem: (index: number, direction: 'UP' | 'DOWN') => void;
  onRemoveItem: (index: number) => void;
  /** Smart PDF rearrangement: drag & drop move from one index to another. */
  onReorderItem: (fromIndex: number, toIndex: number) => void;
  /** Smart PDF rearrangement: one-click rule-based series ordering. */
  onSmartArrange: () => void;
  onDownloadMerged: () => void;
  onProceedToPhase2: () => void;

  // Cancel
  onCancelProcessing?: () => void;

  // Resume
  resumeInfo: ResumeInfo | null;
  onResumeProcessing?: () => void;
  onDismissResume?: () => void;

  // Progressive thumbnails (populated as each page finishes processing)
  progressiveThumbnails?: Map<number, string>;

  // Phase 2: Optimize
  processedPages: ProcessedPage[];
  selectedPageIndex: number;
  setSelectedPageIndex: (idx: number) => void;
  excludedPages: Set<number>;
  docProfile: DocumentProfile | null;
  onToggleExcludePage: (pageIdx: number) => void;
  onToggleExcludeAll: (exclude: boolean) => void;
  onDownloadOptimized1Up: () => void;
  onProceedToPhase3: () => void;

  // Phase 2: Processing Settings (adjustable parameters)
  masterParams: ProcessingParameters;
  onMasterParamsChange: (params: ProcessingParameters) => void;
  onReprocess: () => void;

  // Phase 2: Processing Toggles & Preview
  processingToggles: ProcessingToggleState;
  onProcessingTogglesChange: (toggles: ProcessingToggleState) => void;
  onPreviewReprocess: () => void;
  isPreviewProcessing: boolean;
  onResetSettings: () => void;

  // Phase 3: Layout & Print PDF
  layoutConfig: LayoutConfig;
  layoutDirty: boolean;
  onApplyLayout: () => void;
  finalSheetPreviews: string[];
  finalMetrics: OptimizationMetrics | null;
  finalPrintPdfBlob: Blob | null;
  onSelectLayoutFormat: (format: GridFormat) => void;
  onToggleOrientation: () => void;
  onToggleBorders: () => void;
  onTogglePageNumbers: () => void;
  onUpdateOuterMargins?: (margins: OuterMarginConfig) => void;
  onUpdateInnerMargin?: (innerMarginMm: number) => void;
  onDownloadFinalPrintPdf: () => void;
  onProceedToPhase4: () => void;

  // Diagnostics & Performance Timings
  analysisTimeMs?: number;
  optimizationTimeMs?: number;
  layoutTimeMs?: number;

  // Phase 4: Feedback & Completion
  rating: number;
  setRating: (rating: number) => void;
  feedbackText: string;
  setFeedbackText: (text: string) => void;
  feedbackSubmitted: boolean;
  onSendFeedback: () => void;
  onResetWorkflow: () => void;
}
