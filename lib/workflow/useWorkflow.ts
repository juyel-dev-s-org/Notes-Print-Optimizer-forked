'use client';

import { useReducer, useMemo } from 'react';
import { workflowReducer, initialState } from './workflowReducer';
import type {
  ProcessingToggleState,
  WorkflowPhase,
  WorkflowState,
} from './types';
import type {
  DocumentProfile,
  LayoutConfig,
  OptimizationMetrics,
  PageProfile,
  ProcessedPage,
  ProcessingParameters,
  ProcessingProgress,
} from '../optimizer/types';
import type { UploadedPdfItem } from './types';

export interface WorkflowActions {
  setPhase: (phase: WorkflowPhase) => void;
  setProcessing: (isProcessing: boolean) => void;
  setProgress: (progress: ProcessingProgress | null) => void;
  setError: (message: string | null) => void;
  setUploadedItems: (items: UploadedPdfItem[]) => void;
  setMergeResult: (
    blob: Blob | null,
    bytes: Uint8Array | null,
    pageDataUrls: string[]
  ) => void;
  setPageProfiles: (pageProfiles: PageProfile[]) => void;
  setDocProfile: (docProfile: DocumentProfile | null) => void;
  setProcessedPages: (pages: ProcessedPage[]) => void;
  setOptimized1UpBlob: (blob: Blob | null) => void;
  setSelectedPageIndex: (index: number) => void;
  setExcludedPages: (pages: Set<number>) => void;
  togglePageExcluded: (pageIndex: number) => void;
  setMasterParams: (params: ProcessingParameters) => void;
  setProcessingToggles: (toggles: ProcessingToggleState) => void;
  setPreviewProcessing: (isPreviewProcessing: boolean) => void;
  updateSingleProcessedPage: (pageIndex: number, page: ProcessedPage) => void;
  setLayoutConfig: (config: LayoutConfig) => void;
  updateLayoutConfig: (patch: Partial<LayoutConfig>) => void;
  setLayoutResult: (
    blob: Blob | null,
    previews: string[],
    metrics: OptimizationMetrics | null
  ) => void;
  setLayoutDirty: (dirty: boolean) => void;
  setRating: (rating: number) => void;
  setFeedbackText: (text: string) => void;
  setFeedbackSubmitted: (submitted: boolean) => void;
  setTiming: (timing: {
    analysisTimeMs?: number;
    optimizationTimeMs?: number;
    layoutTimeMs?: number;
  }) => void;
  resetWorkflow: () => void;
}

export function useWorkflow(): {
  state: WorkflowState;
  actions: WorkflowActions;
} {
  const [state, dispatch] = useReducer(workflowReducer, initialState);

  const actions: WorkflowActions = useMemo(
    () => ({
      setPhase: (phase) => dispatch({ type: 'SET_PHASE', phase }),
      setProcessing: (isProcessing) =>
        dispatch({ type: 'SET_PROCESSING', isProcessing }),
      setProgress: (progress) =>
        dispatch({ type: 'SET_PROGRESS', progress }),
      setError: (message) => dispatch({ type: 'SET_ERROR', message }),
      setUploadedItems: (items) =>
        dispatch({ type: 'SET_UPLOADED_ITEMS', items }),
      setMergeResult: (blob, bytes, pageDataUrls) =>
        dispatch({ type: 'SET_MERGE_RESULT', blob, bytes, pageDataUrls }),
      setPageProfiles: (pageProfiles) =>
        dispatch({ type: 'SET_PAGE_PROFILES', pageProfiles }),
      setDocProfile: (docProfile) =>
        dispatch({ type: 'SET_DOC_PROFILE', docProfile }),
      setProcessedPages: (pages) =>
        dispatch({ type: 'SET_PROCESSED_PAGES', pages }),
      setOptimized1UpBlob: (blob) =>
        dispatch({ type: 'SET_OPTIMIZED_1UP_BLOB', blob }),
      setSelectedPageIndex: (index) =>
        dispatch({ type: 'SET_SELECTED_PAGE_INDEX', index }),
      setExcludedPages: (pages) =>
        dispatch({ type: 'SET_EXCLUDED_PAGES', pages }),
      togglePageExcluded: (pageIndex) =>
        dispatch({ type: 'TOGGLE_PAGE_EXCLUDED', pageIndex }),
      setMasterParams: (params) =>
        dispatch({ type: 'SET_MASTER_PARAMS', params }),
      setProcessingToggles: (toggles) =>
        dispatch({ type: 'SET_PROCESSING_TOGGLES', toggles }),
      setPreviewProcessing: (isPreviewProcessing) =>
        dispatch({ type: 'SET_PREVIEW_PROCESSING', isPreviewProcessing }),
      updateSingleProcessedPage: (pageIndex, page) =>
        dispatch({ type: 'UPDATE_SINGLE_PROCESSED_PAGE', pageIndex, page }),
      setLayoutConfig: (config) =>
        dispatch({ type: 'SET_LAYOUT_CONFIG', config }),
      updateLayoutConfig: (patch) =>
        dispatch({ type: 'UPDATE_LAYOUT_CONFIG', patch }),
      setLayoutResult: (blob, previews, metrics) =>
        dispatch({ type: 'SET_LAYOUT_RESULT', blob, previews, metrics }),
      setLayoutDirty: (dirty) =>
        dispatch({ type: 'SET_LAYOUT_DIRTY', dirty }),
      setRating: (rating) => dispatch({ type: 'SET_RATING', rating }),
      setFeedbackText: (text) =>
        dispatch({ type: 'SET_FEEDBACK_TEXT', text }),
      setFeedbackSubmitted: (submitted) =>
        dispatch({ type: 'SET_FEEDBACK_SUBMITTED', submitted }),
      setTiming: (timing) => dispatch({ type: 'SET_TIMING', ...timing }),
      resetWorkflow: () => dispatch({ type: 'RESET_WORKFLOW' }),
    }),
    [dispatch]
  );

  return { state, actions };
}
