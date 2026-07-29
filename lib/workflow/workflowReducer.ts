import { ParameterGenerator } from '../optimizer/parameterGenerator';
import type {
  LayoutConfig,
} from '../optimizer/types';
import type { EngineVersion } from '../optimizer/engine/types';
import type {
  WorkflowAction,
  WorkflowState,
} from './types';

export const initialLayoutConfig: LayoutConfig = {
  gridFormat: '2x2',
  paperSize: 'A4',
  orientation: 'PORTRAIT',
  outerMarginMm: { top: 2, left: 5, right: 3, bottom: 2 },
  innerMarginMm: 1,
  marginMm: 2,
  spacingMm: 1,
  showSlideBorders: false,
  showPageNumbers: false,
  headerTitle: '',
};

export const initialState: WorkflowState = {
  currentPhase: 1,
  isProcessing: false,
  progress: null,
  errorMessage: null,

  uploadedItems: [],
  mergedPdfBlob: null,
  mergedPdfBytes: null,
  mergedPageDataUrls: [],

  rawPagesData: [],
  pageProfiles: [],
  docProfile: null,

  processedPages: [],
  optimized1UpBlob: null,
  selectedPageIndex: 0,
  excludedPages: new Set<number>(),

  selectedEngineVersion: 'v1' as EngineVersion,
  masterParams: ParameterGenerator.getPresetParameters('AUTO_ADAPTIVE'),

  layoutConfig: { ...initialLayoutConfig },
  finalPrintPdfBlob: null,
  finalSheetPreviews: [],
  finalMetrics: null,
  layoutDirty: false,

  rating: 5,
  feedbackText: '',
  feedbackSubmitted: false,

  analysisTimeMs: undefined,
  optimizationTimeMs: undefined,
  layoutTimeMs: undefined,
};

function resetTransientState(): Omit<
  WorkflowState,
  'selectedEngineVersion' | 'masterParams'
> {
  return {
    currentPhase: 1,
    isProcessing: false,
    progress: null,
    errorMessage: null,

    uploadedItems: [],
    mergedPdfBlob: null,
    mergedPdfBytes: null,
    mergedPageDataUrls: [],

    rawPagesData: [],
    pageProfiles: [],
    docProfile: null,

    processedPages: [],
    optimized1UpBlob: null,
    selectedPageIndex: 0,
    excludedPages: new Set<number>(),

    layoutConfig: { ...initialLayoutConfig },
    finalPrintPdfBlob: null,
    finalSheetPreviews: [],
    finalMetrics: null,
    layoutDirty: false,

    rating: 5,
    feedbackText: '',
    feedbackSubmitted: false,

    analysisTimeMs: undefined,
    optimizationTimeMs: undefined,
    layoutTimeMs: undefined,
  };
}

export function workflowReducer(
  state: WorkflowState,
  action: WorkflowAction
): WorkflowState {
  switch (action.type) {
    // Navigation / control
    case 'SET_PHASE':
      return { ...state, currentPhase: action.phase };

    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.isProcessing };

    case 'SET_PROGRESS':
      return { ...state, progress: action.progress };

    case 'SET_ERROR':
      return { ...state, errorMessage: action.message };

    // Upload & Merge
    case 'SET_UPLOADED_ITEMS':
      return { ...state, uploadedItems: action.items };

    case 'SET_MERGE_RESULT':
      return {
        ...state,
        mergedPdfBlob: action.blob,
        mergedPdfBytes: action.bytes,
        mergedPageDataUrls: action.pageDataUrls,
      };

    // Raw extraction / analysis
    case 'SET_RAW_PAGES':
      return { ...state, rawPagesData: action.rawPagesData };

    case 'SET_PAGE_PROFILES':
      return { ...state, pageProfiles: action.pageProfiles };

    case 'SET_DOC_PROFILE':
      return { ...state, docProfile: action.docProfile };

    // Optimize
    case 'SET_PROCESSED_PAGES':
      return { ...state, processedPages: action.pages };

    case 'SET_OPTIMIZED_1UP_BLOB':
      return { ...state, optimized1UpBlob: action.blob };

    case 'SET_SELECTED_PAGE_INDEX':
      return { ...state, selectedPageIndex: action.index };

    case 'SET_EXCLUDED_PAGES':
      return { ...state, excludedPages: action.pages };

    case 'TOGGLE_PAGE_EXCLUDED': {
      const next = new Set(state.excludedPages);
      if (next.has(action.pageIndex)) {
        next.delete(action.pageIndex);
      } else {
        next.add(action.pageIndex);
      }
      return { ...state, excludedPages: next };
    }

    // Engine / master params
    case 'SET_ENGINE_VERSION':
      return { ...state, selectedEngineVersion: action.version };

    case 'SET_MASTER_PARAMS':
      return { ...state, masterParams: action.params };

    // Layout
    case 'SET_LAYOUT_CONFIG':
      return { ...state, layoutConfig: action.config };

    case 'UPDATE_LAYOUT_CONFIG':
      return { ...state, layoutConfig: { ...state.layoutConfig, ...action.patch } };

    case 'SET_LAYOUT_RESULT':
      return {
        ...state,
        finalPrintPdfBlob: action.blob,
        finalSheetPreviews: action.previews,
        finalMetrics: action.metrics,
      };

    case 'SET_LAYOUT_DIRTY':
      return { ...state, layoutDirty: action.dirty };

    // Feedback
    case 'SET_RATING':
      return { ...state, rating: action.rating };

    case 'SET_FEEDBACK_TEXT':
      return { ...state, feedbackText: action.text };

    case 'SET_FEEDBACK_SUBMITTED':
      return { ...state, feedbackSubmitted: action.submitted };

    // Timing diagnostics
    case 'SET_TIMING':
      return {
        ...state,
        ...(action.analysisTimeMs !== undefined && { analysisTimeMs: action.analysisTimeMs }),
        ...(action.optimizationTimeMs !== undefined && { optimizationTimeMs: action.optimizationTimeMs }),
        ...(action.layoutTimeMs !== undefined && { layoutTimeMs: action.layoutTimeMs }),
      };

    // Reset — preserves user preferences
    case 'RESET_WORKFLOW':
      return {
        ...resetTransientState(),
        selectedEngineVersion: state.selectedEngineVersion,
        masterParams: state.masterParams,
      };

    default:
      return state;
  }
}
