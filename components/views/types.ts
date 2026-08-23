import type { WorkflowPhase, ProcessingToggleState } from '@/lib/workflow/types';
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
import type { UploadedPdfItem } from '@/lib/workflow/types';
import type { ToolMode } from '@/lib/enhance/types';

export type { UploadedPdfItem };

/** Core workflow state extracted from useWorkflow */
export interface WorkflowState {
  currentPhase: WorkflowPhase;
  isProcessing: boolean;
  progress: ProcessingProgress | null;
  errorMessage: string | null;
  uploadedItems: UploadedPdfItem[];
  mergedPdfBlob: Blob | null;
  mergedPdfBytes: Uint8Array | null;
  mergedPageDataUrls: string[];
  processedPages: ProcessedPage[];
  selectedPageIndex: number;
  excludedPages: Set<number>;
  docProfile: DocumentProfile | null;
  masterParams: ProcessingParameters;
  processingToggles: ProcessingToggleState;
  isPreviewProcessing: boolean;
  layoutConfig: LayoutConfig;
  layoutDirty: boolean;
  finalSheetPreviews: string[];
  finalMetrics: OptimizationMetrics | null;
  finalPrintPdfBlob: Blob | null;
  analysisTimeMs?: number;
  optimizationTimeMs?: number;
  layoutTimeMs?: number;
  rating: number;
  feedbackText: string;
  feedbackSubmitted: boolean;
  progressiveThumbnails?: Map<number, string>;
}

/** All workflow actions grouped by domain */
export interface WorkflowActions {
  setPhase: (phase: WorkflowPhase) => void;
  setError: (msg: string | null) => void;
  setSelectedPageIndex: (idx: number) => void;
  setMasterParams: (params: ProcessingParameters) => void;
  setProcessingToggles: (toggles: ProcessingToggleState) => void;
  setExcludedPages: (pages: Set<number>) => void;
  setRating: (rating: number) => void;
  setFeedbackText: (text: string) => void;
}

/** All handler functions from usePageHandlers */
export interface WorkflowHandlers {
  handleFilesUpload: (files: File[]) => void;
  handleMoveItem: (index: number, direction: 'UP' | 'DOWN') => void;
  handleRemoveItem: (index: number) => void;
  handleReorderItem: (fromIndex: number, toIndex: number) => void;
  handleSmartArrange: () => void;
  handleDownloadMerged: () => void;
  handleProceedToPhase2: () => void;
  handleToggleExcludePage: (pageIdx: number) => void;
  handleDownloadOptimized1Up: () => void;
  handleProceedToPhase3: () => void;
  handleReprocess: () => void;
  handlePreviewReprocess: () => void;
  handleResetSettings: () => void;
  handleApplyLayout: () => void;
  handleSelectLayoutFormat: (format: GridFormat) => void;
  handleToggleOrientation: () => void;
  handleToggleBorders: () => void;
  handleTogglePageNumbers: () => void;
  handleUpdateOuterMargins?: (margins: OuterMarginConfig) => void;
  handleUpdateInnerMargin?: (innerMarginMm: number) => void;
  handleDownloadFinalPrintPdf: (customBase?: string) => void;
  handleProceedToPhase4: () => void;
  handleSendFeedback: () => void;
  handleResetWorkflow: () => void;
  handleCancelProcessing: () => void;
  compilePhase3PrintLayout?: (config: LayoutConfig, overrideExcludedPages?: Set<number>) => Promise<void>;
}

/** Consolidated props for PlatformUIOrchestrator */
export interface WorkflowUIProps {
  state: WorkflowState;
  actions: WorkflowActions;
  handlers: WorkflowHandlers;
  /** Active tool selection — null means landing (no tool chosen yet) */
  toolMode?: ToolMode | null;
  onToolModeChange?: (mode: ToolMode | null) => void;
  /** Inside the N-Up stage reached from the enhance tool — hides pipeline chrome. */
  enhanceHandoffActive?: boolean;
  /** Escape hatch back to the enhance workbench from the handoff stage. */
  onBackToEnhance?: () => void;
}
