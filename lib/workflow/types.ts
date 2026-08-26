/**
 * Phase 1 — Workflow State Machine Types
 *
 * Single source of truth for the typed workflow state extracted from
 * app/page.tsx (27 useState hooks). Pure type module: uses `import type`
 * only so it never drags runtime/client dependencies (pdfjs, engines,
 * lucide, motion) into the module graph. Safe to import from Vitest.
 *
 * Zero behavior change: field names and types mirror the existing
 * component state exactly so the later wiring step is mechanical.
 */

import type {
  DocumentProfile,
  LayoutConfig,
  OptimizationMetrics,
  PageProfile,
  ProcessedPage,
  ProcessingParameters,
  ProcessingProgress,
} from '@/lib/optimizer/types';


/**
 * Numeric workflow phase. Mirrors `WorkflowPhase` exported from
 * components/Header.tsx (kept as a local alias here to avoid importing a
 * 'use client' React component into pure logic/tests).
 *  1 = Upload & Merge
 *  2 = Optimize
 *  3 = Choose Layout & Generate
 *  4 = Done & Feedback
 */
export type WorkflowPhase = 1 | 2 | 3 | 4;

/** Human-readable phase names (for logging / future UI mapping). */
export type WorkflowPhaseName = 'UPLOAD' | 'OPTIMIZE' | 'LAYOUT' | 'FEEDBACK';

export const WORKFLOW_PHASE_NAMES: Record<WorkflowPhase, WorkflowPhaseName> = {
  1: 'UPLOAD',
  2: 'OPTIMIZE',
  3: 'LAYOUT',
  4: 'FEEDBACK',
};

/** A user-uploaded PDF item prior to merge. Mirrors local interface in app/page.tsx. */
export interface UploadedPdfItem {
  id: string;
  file: File;
  name: string;
  sizeMB: string;
  arrayBuffer: ArrayBuffer;
}

/** Checkpoint snapshot for the resume-from-last-session prompt. */
export interface ResumeInfo {
  documentId: string;
  totalPages: number;
  completedCount: number;
  lastUpdated: number;
}

/**
 * Toggle state for each processing parameter.
 *
 * - Stroke/Dilation OFF  → raw PDF preserved, NO morphology applied at all.
 * - Stroke/Dilation ON   → manual slider controls stroke thickness.
 * - Sharpen ON → manual slider; OFF → preset default.
 *
 * contrast / denoise / bgWhitening are RESERVED but currently unused by the
 * whiten kernel: its output is pure binary (black/white composite), so a
 * contrast curve, background whitening threshold and a denoise pass have no
 * meaningful effect there (denoise duplicates the built-in CC noise
 * removal). They stay in the state shape so the Enhance-style grayscale
 * pipeline can adopt them later without a type migration. The settings UI
 * deliberately does not render them — exposing a no-op slider is exactly
 * the kind of dishonest UI this project avoids.
 */
export interface ProcessingToggleState {
  strokeDilation: boolean;
  sharpen: boolean;
  contrast: boolean;
  denoise: boolean;
  bgWhitening: boolean;
}

/** All toggles OFF — every parameter uses its preset default. */
export const DEFAULT_PROCESSING_TOGGLES: ProcessingToggleState = {
  strokeDilation: false,
  sharpen: false,
  contrast: false,
  denoise: false,
  bgWhitening: false,
};

/**
 * Complete workflow state. Every field corresponds 1:1 to a useState hook
 * previously declared in app/page.tsx. `masterParams` had no setter in the
 * original component (initialized once); it is retained as state so that
 * RESET_WORKFLOW can preserve it as a user preference.
 */
export interface WorkflowState {
  // Navigation / control
  currentPhase: WorkflowPhase;
  isProcessing: boolean;
  progress: ProcessingProgress | null;
  errorMessage: string | null;

  // Phase 1 — Upload & Merge
  uploadedItems: UploadedPdfItem[];
  mergedPdfBlob: Blob | null;
  mergedPdfBytes: Uint8Array | null;
  /** Arrange-step page thumbnails. Despite the historical name these are
   *  blob: URLs (≤12, 0.3-scale JPEG) created via memoryManager, not data:
   *  URLs — see UploadService.mergeAndPreview. */
  mergedPageDataUrls: string[];

  // Raw page extraction / analysis

  pageProfiles: PageProfile[];
  docProfile: DocumentProfile | null;

  // Phase 2 — Optimize
  processedPages: ProcessedPage[];
  optimized1UpBlob: Blob | null;
  selectedPageIndex: number;
  excludedPages: Set<number>;
  /**
   * Pages the user pinned to their ORIGINAL scan (left tick on thumbnails).
   * A pinned page still participates in layout/export, but the exporter
   * renders it from the merged source PDF instead of the whitened bitmap —
   * no reprocessing, pure source swap. Auto-seeded with LIGHT_SLIDE pages
   * whenever a fresh processing run completes.
   */
  keepOriginalPages: Set<number>;

  // Master parameters (user preferences)
  masterParams: ProcessingParameters;

  // Processing toggle overrides (which params are manually controlled)
  processingToggles: ProcessingToggleState;

  // Single-page preview processing state
  isPreviewProcessing: boolean;

  // Phase 3 — Layout & Generate
  layoutConfig: LayoutConfig;
  finalPrintPdfBlob: Blob | null;
  finalSheetPreviews: string[];
  finalMetrics: OptimizationMetrics | null;
  layoutDirty: boolean;

  // Phase 4 — Done & Feedback
  rating: number;
  feedbackText: string;
  feedbackSubmitted: boolean;

  // Workflow timing diagnostics
  analysisTimeMs: number | undefined;
  optimizationTimeMs: number | undefined;
  layoutTimeMs: number | undefined;
}

/**
 * Discriminated union of all workflow actions. Kept granular so the reducer
 * stays a pure, exhaustive switch and the later wiring maps each existing
 * setter to exactly one action.
 */
export type WorkflowAction =
  // Navigation / control
  | { type: 'SET_PHASE'; phase: WorkflowPhase }
  | { type: 'SET_PROCESSING'; isProcessing: boolean }
  | { type: 'SET_PROGRESS'; progress: ProcessingProgress | null }
  | { type: 'SET_ERROR'; message: string | null }
  // Upload & Merge
  | { type: 'SET_UPLOADED_ITEMS'; items: UploadedPdfItem[] }
  | { type: 'SET_MERGE_RESULT'; blob: Blob | null; bytes: Uint8Array | null; pageDataUrls: string[] }
  // Profiles
  | { type: 'SET_PAGE_PROFILES'; pageProfiles: PageProfile[] }
  | { type: 'SET_DOC_PROFILE'; docProfile: DocumentProfile | null }
  // Optimize
  | { type: 'SET_PROCESSED_PAGES'; pages: ProcessedPage[] }
  | { type: 'SET_OPTIMIZED_1UP_BLOB'; blob: Blob | null }
  | { type: 'SET_SELECTED_PAGE_INDEX'; index: number }
  | { type: 'SET_EXCLUDED_PAGES'; pages: Set<number> }
  | { type: 'TOGGLE_PAGE_EXCLUDED'; pageIndex: number }
  | { type: 'SET_KEEP_ORIGINAL_PAGES'; pages: Set<number> }
  | { type: 'TOGGLE_KEEP_ORIGINAL_PAGE'; pageIndex: number }
  // Master params
  | { type: 'SET_MASTER_PARAMS'; params: ProcessingParameters }
  // Processing toggles
  | { type: 'SET_PROCESSING_TOGGLES'; toggles: ProcessingToggleState }
  // Single-page preview processing
  | { type: 'SET_PREVIEW_PROCESSING'; isPreviewProcessing: boolean }
  | { type: 'UPDATE_SINGLE_PROCESSED_PAGE'; pageIndex: number; page: ProcessedPage }
  // Layout
  | { type: 'SET_LAYOUT_CONFIG'; config: LayoutConfig }
  | { type: 'UPDATE_LAYOUT_CONFIG'; patch: Partial<LayoutConfig> }
  | { type: 'SET_LAYOUT_RESULT'; blob: Blob | null; previews: string[]; metrics: OptimizationMetrics | null }
  | { type: 'SET_LAYOUT_DIRTY'; dirty: boolean }
  // Feedback
  | { type: 'SET_RATING'; rating: number }
  | { type: 'SET_FEEDBACK_TEXT'; text: string }
  | { type: 'SET_FEEDBACK_SUBMITTED'; submitted: boolean }
  // Timing diagnostics
  | {
      type: 'SET_TIMING';
      analysisTimeMs?: number;
      optimizationTimeMs?: number;
      layoutTimeMs?: number;
    }
  // Reset (preserves user preferences: masterParams)
  | { type: 'RESET_WORKFLOW' };
