/**
 * enhanceReducer — pure state machine for the Enhance tool.
 * Kept free of side effects so every transition is unit-testable.
 */

import { INITIAL_ENHANCE_STATE, type EnhanceAction, type EnhanceState } from './types';

export function buildEnhanceFileName(sources: { name: string }[]): string {
  if (sources.length === 1) {
    const base = sources[0].name.replace(/\.pdf$/i, '');
    return `${base}-enhanced.pdf`;
  }
  return 'enhanced-print.pdf';
}

export function enhanceReducer(state: EnhanceState, action: EnhanceAction): EnhanceState {
  switch (action.type) {
    case 'RESET':
      return { ...INITIAL_ENHANCE_STATE };

    case 'SET_STEP':
      return { ...state, step: action.step, error: null };

    case 'SET_FILES':
      return {
        ...state,
        files: action.files,
        step: action.step,
        results: [],
        selectedIndex: 0,
        pdfBlob: null,
        error: null,
      };

    case 'SET_SETTINGS':
      return { ...state, settings: action.settings, pdfBlob: null };

    case 'SET_SELECTED':
      return { ...state, selectedIndex: action.index, pdfBlob: null };

    case 'PROCESS_START':
      return { ...state, isProcessing: true, progress: { current: 0, total: 1, phase: 'Preparing…' }, error: null, pdfBlob: null };

    case 'PROCESS_PROGRESS':
      return { ...state, progress: action.progress };

    case 'PROCESS_COMPLETE':
      return {
        ...state,
        isProcessing: false,
        progress: null,
        results: action.results,
        selectedIndex: 0,
        fileName: action.fileName,
        step: 'enhance',
      };

    case 'PROCESS_ERROR':
      return { ...state, isProcessing: false, progress: null, error: action.error };

    case 'PROCESS_CANCEL':
      return { ...state, isProcessing: false, progress: null, error: null };

    case 'EXPORT_START':
      return { ...state, exportBusy: true, error: null };

    case 'EXPORT_COMPLETE':
      return { ...state, exportBusy: false, pdfBlob: action.blob, fileName: action.fileName, step: 'export' };

    case 'EXPORT_ERROR':
      return { ...state, exportBusy: false, error: action.error };

    default:
      return state;
  }
}