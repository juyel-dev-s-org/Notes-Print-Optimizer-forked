import { WorkflowPhase } from '@/components/Header';
import { EngineVersion } from '@/lib/optimizer/engine';
import {
  DocumentProfile,
  GridFormat,
  LayoutConfig,
  OptimizationMetrics,
  ProcessedPage,
  ProcessingProgress,
} from '@/lib/optimizer/types';

interface UploadedPdfItem {
  id: string;
  file: File;
  name: string;
  sizeMB: string;
  arrayBuffer: ArrayBuffer;
}

export interface WorkflowUIProps {
  // Navigation & Core State
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
  onDownloadMerged: () => void;
  onProceedToPhase2: () => void;

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

  // Phase 3: Layout & Print PDF
  layoutConfig: LayoutConfig;
  finalSheetPreviews: string[];
  finalMetrics: OptimizationMetrics | null;
  finalPrintPdfBlob: Blob | null;
  onSelectLayoutFormat: (format: GridFormat) => void;
  onToggleOrientation: () => void;
  onToggleBorders: () => void;
  onTogglePageNumbers: () => void;
  onDownloadFinalPrintPdf: () => void;
  onProceedToPhase4: () => void;

  // Phase 4: Feedback & Completion
  rating: number;
  setRating: (rating: number) => void;
  feedbackText: string;
  setFeedbackText: (text: string) => void;
  feedbackSubmitted: boolean;
  onSendFeedback: () => void;
  onResetWorkflow: () => void;
}
