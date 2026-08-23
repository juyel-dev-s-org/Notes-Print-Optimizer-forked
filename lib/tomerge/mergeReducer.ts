/**
 * Merge PDFs — pure state machine for the combine tool.
 * Queue mutations mirror the enhance arrange stage so FileSequencePanel
 * plugs in unchanged; merging itself is delegated to MergeService.
 */

import type { UploadedPdfItem } from '../workflow/types';

export type MergeStep = 'upload' | 'arrange' | 'done';

export const MAX_MERGE_FILES = 10;

export interface MergeProgress {
  current: number;
  total: number;
  label: string;
}

export interface MergeState {
  step: MergeStep;
  files: UploadedPdfItem[];
  isBusy: boolean;
  progress: MergeProgress | null;
  resultBlob: Blob | null;
  resultPages: number;
  error: string | null;
}

export const INITIAL_MERGE_STATE: MergeState = {
  step: 'upload',
  files: [],
  isBusy: false,
  progress: null,
  resultBlob: null,
  resultPages: 0,
  error: null,
};

export type MergeAction =
  | { type: 'RESET' }
  | { type: 'SET_STEP'; step: MergeStep }
  | { type: 'SET_FILES'; files: UploadedPdfItem[] }
  | { type: 'MOVE_FILE'; index: number; direction: 'UP' | 'DOWN' }
  | { type: 'REORDER_FILES'; fromIndex: number; toIndex: number }
  | { type: 'REMOVE_FILE'; index: number }
  | { type: 'SMART_ARRANGE'; files: UploadedPdfItem[] }
  | { type: 'MERGE_START' }
  | { type: 'MERGE_PROGRESS'; progress: MergeProgress }
  | { type: 'MERGE_COMPLETE'; blob: Blob; pages: number }
  | { type: 'MERGE_ERROR'; error: string };

export function mergeReducer(state: MergeState, action: MergeAction): MergeState {
  switch (action.type) {
    case 'RESET':
      return { ...INITIAL_MERGE_STATE };

    case 'SET_STEP':
      return { ...state, step: action.step, error: null };

    case 'SET_FILES':
      return { ...state, files: action.files, step: 'arrange', resultBlob: null, error: null };

    case 'MOVE_FILE': {
      const target = action.direction === 'UP' ? action.index - 1 : action.index + 1;
      if (action.index < 0 || action.index >= state.files.length) return state;
      if (target < 0 || target >= state.files.length) return state;
      const files = [...state.files];
      [files[action.index], files[target]] = [files[target], files[action.index]];
      return { ...state, files, resultBlob: null };
    }

    case 'REORDER_FILES': {
      const { fromIndex, toIndex } = action;
      if (fromIndex === toIndex) return state;
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= state.files.length || toIndex >= state.files.length) return state;
      const files = [...state.files];
      const [moved] = files.splice(fromIndex, 1);
      files.splice(toIndex, 0, moved);
      return { ...state, files, resultBlob: null };
    }

    case 'REMOVE_FILE': {
      const files = state.files.filter((_, i) => i !== action.index);
      if (files.length === 0) return { ...INITIAL_MERGE_STATE };
      return { ...state, files, resultBlob: null };
    }

    case 'SMART_ARRANGE':
      return { ...state, files: action.files, resultBlob: null };

    case 'MERGE_START':
      return { ...state, isBusy: true, progress: { current: 0, total: state.files.length, label: 'Preparing…' }, error: null, resultBlob: null };

    case 'MERGE_PROGRESS':
      return { ...state, progress: action.progress };

    case 'MERGE_COMPLETE':
      return { ...state, isBusy: false, progress: null, resultBlob: action.blob, resultPages: action.pages, step: 'done' };

    case 'MERGE_ERROR':
      return { ...state, isBusy: false, progress: null, error: action.error };

    default:
      return state;
  }
}
