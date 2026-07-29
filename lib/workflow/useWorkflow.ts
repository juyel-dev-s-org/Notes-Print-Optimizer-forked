'use client';

import { useReducer, useCallback, useMemo } from 'react';
import { workflowReducer, initialState } from './workflowReducer';
import type {
  WorkflowAction,
  WorkflowPhase,
  WorkflowState,
} from './types';
import type {
  DocumentProfile,
  GridFormat,
  LayoutConfig,
  OptimizationMetrics,
  OuterMarginConfig,
  PageProfile,
  ProcessedPage,
  ProcessingParameters,
  ProcessingProgress,
} from '../optimizer/types';
import type { EngineVersion } from '../optimizer/engine/types';
import type { UploadedPdfItem } from './types';

export interface WorkflowActions {
  // Navigation / control
  setPhase: (phase: WorkflowPhase) => void;
  setProcessing: (isProcessing: boolean) => void;
  setProgress: (progress: ProcessingProgress | null) => void;
  setError: (message: string | null) => void;

  // Upload & Merge
  setUploadedItems: (items: UploadedPdfItem[]) => void;
  setMergeResult: (
    blob: Blob | null,
    bytes: Uint8Array | null,
    pageDataUrls: string[]
  ) => void;

  // Raw extraction / analysis
  setRawPages: (rawPagesData: ImageData[]) => void;
  setPageProfiles: (pageProfiles: PageProfile[]) => void;
  setDocProfile: (docProfile: DocumentProfile | null) => void;

  // Optimize
  setProcessedPages: (pages: ProcessedPage[]) => void;
  setOptimized1UpBlob: (blob: Blob | null) => void;
  setSelectedPageIndex: (index: number) => void;
  setExcludedPages: (pages: Set<number>) => void;
  togglePageExcluded: (pageIndex: number) => void;

  // Engine / master params
  setEngineVersion: (version: EngineVersion) => void;
  setMasterParams: (params: ProcessingParameters) => void;

  // Layout
  setLayoutConfig: (config: LayoutConfig) => void;
  updateLayoutConfig: (patch: Partial<LayoutConfig>) => void;
  setLayoutResult: (
    blob: Blob | null,
    previews: string[],
    metrics: OptimizationMetrics | null
  ) => void;
  setLayoutDirty: (dirty: boolean) => void;

  // Feedback
  setRating: (rating: number) => void;
  setFeedbackText: (text: string) => void;
  setFeedbackSubmitted: (submitted: boolean) => void;

  // Timing
  setTiming: (timing: {
    analysisTimeMs?: number;
    optimizationTimeMs?: number;
    layoutTimeMs?: number;
  }) => void;

  // Reset
  resetWorkflow: () => void;
}

function dispatchAction(
  dispatch: React.Dispatch<WorkflowAction>,
  action: WorkflowAction
): void {
  dispatch(action);
}

export function useWorkflow(): {
  state: WorkflowState;
  actions: WorkflowActions;
} {
  const [state, dispatch] = useReducer(workflowReducer, initialState);

  const actions: WorkflowActions = useMemo(
    () => ({
      setPhase: useCallback(
        (phase: WorkflowPhase) => dispatch({ type: 'SET_PHASE', phase }),
        [dispatch]
      ),
      setProcessing: useCallback(
        (isProcessing: boolean) =>
          dispatch({ type: 'SET_PROCESSING', isProcessing }),
        [dispatch]
      ),
      setProgress: useCallback(
        (progress: ProcessingProgress | null) =>
          dispatch({ type: 'SET_PROGRESS', progress }),
        [dispatch]
      ),
      setError: useCallback(
        (message: string | null) =>
          dispatch({ type: 'SET_ERROR', message }),
        [dispatch]
      ),

      setUploadedItems: useCallback(
        (items: UploadedPdfItem[]) =>
          dispatch({ type: 'SET_UPLOADED_ITEMS', items }),
        [dispatch]
      ),
      setMergeResult: useCallback(
        (
          blob: Blob | null,
          bytes: Uint8Array | null,
          pageDataUrls: string[]
        ) => dispatch({ type: 'SET_MERGE_RESULT', blob, bytes, pageDataUrls }),
        [dispatch]
      ),

      setRawPages: useCallback(
        (rawPagesData: ImageData[]) =>
          dispatch({ type: 'SET_RAW_PAGES', rawPagesData }),
        [dispatch]
      ),
      setPageProfiles: useCallback(
        (pageProfiles: PageProfile[]) =>
          dispatch({ type: 'SET_PAGE_PROFILES', pageProfiles }),
        [dispatch]
      ),
      setDocProfile: useCallback(
        (docProfile: DocumentProfile | null) =>
          dispatch({ type: 'SET_DOC_PROFILE', docProfile }),
        [dispatch]
      ),

      setProcessedPages: useCallback(
        (pages: ProcessedPage[]) =>
          dispatch({ type: 'SET_PROCESSED_PAGES', pages }),
        [dispatch]
      ),
      setOptimized1UpBlob: useCallback(
        (blob: Blob | null) =>
          dispatch({ type: 'SET_OPTIMIZED_1UP_BLOB', blob }),
        [dispatch]
      ),
      setSelectedPageIndex: useCallback(
        (index: number) =>
          dispatch({ type: 'SET_SELECTED_PAGE_INDEX', index }),
        [dispatch]
      ),
      setExcludedPages: useCallback(
        (pages: Set<number>) =>
          dispatch({ type: 'SET_EXCLUDED_PAGES', pages }),
        [dispatch]
      ),
      togglePageExcluded: useCallback(
        (pageIndex: number) =>
          dispatch({ type: 'TOGGLE_PAGE_EXCLUDED', pageIndex }),
        [dispatch]
      ),

      setEngineVersion: useCallback(
        (version: EngineVersion) =>
          dispatch({ type: 'SET_ENGINE_VERSION', version }),
        [dispatch]
      ),
      setMasterParams: useCallback(
        (params: ProcessingParameters) =>
          dispatch({ type: 'SET_MASTER_PARAMS', params }),
        [dispatch]
      ),

      setLayoutConfig: useCallback(
        (config: LayoutConfig) =>
          dispatch({ type: 'SET_LAYOUT_CONFIG', config }),
        [dispatch]
      ),
      updateLayoutConfig: useCallback(
        (patch: Partial<LayoutConfig>) =>
          dispatch({ type: 'UPDATE_LAYOUT_CONFIG', patch }),
        [dispatch]
      ),
      setLayoutResult: useCallback(
        (
          blob: Blob | null,
          previews: string[],
          metrics: OptimizationMetrics | null
        ) => dispatch({ type: 'SET_LAYOUT_RESULT', blob, previews, metrics }),
        [dispatch]
      ),
      setLayoutDirty: useCallback(
        (dirty: boolean) =>
          dispatch({ type: 'SET_LAYOUT_DIRTY', dirty }),
        [dispatch]
      ),

      setRating: useCallback(
        (rating: number) => dispatch({ type: 'SET_RATING', rating }),
        [dispatch]
      ),
      setFeedbackText: useCallback(
        (text: string) =>
          dispatch({ type: 'SET_FEEDBACK_TEXT', text }),
        [dispatch]
      ),
      setFeedbackSubmitted: useCallback(
        (submitted: boolean) =>
          dispatch({ type: 'SET_FEEDBACK_SUBMITTED', submitted }),
        [dispatch]
      ),

      setTiming: useCallback(
        (timing: {
          analysisTimeMs?: number;
          optimizationTimeMs?: number;
          layoutTimeMs?: number;
        }) => dispatch({ type: 'SET_TIMING', ...timing }),
        [dispatch]
      ),

      resetWorkflow: useCallback(
        () => dispatch({ type: 'RESET_WORKFLOW' }),
        [dispatch]
      ),
    }),
    [dispatch]
  );

  return { state, actions };
}
