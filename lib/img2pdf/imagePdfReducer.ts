/**
 * Image to PDF — pure state machine for combining pictures into one PDF.
 */

export type ImagePdfStep = 'upload' | 'arrange' | 'done';
export type ImagePageMode = 'fit' | 'a4';

export const MAX_IMAGE_FILES = 20;

export interface ImageItem {
  id: string;
  name: string;
  sizeMB: string;
  blob: Blob;
  /** Sniffed kind — 'webp'/unknown goes through a canvas fallback at build time. */
  kind: 'jpeg' | 'png' | 'convert';
}

export interface ImagePdfProgress {
  current: number;
  total: number;
  label: string;
}

export interface ImagePdfState {
  step: ImagePdfStep;
  files: ImageItem[];
  pageMode: ImagePageMode;
  isBusy: boolean;
  progress: ImagePdfProgress | null;
  resultBlob: Blob | null;
  resultPages: number;
  error: string | null;
}

export const INITIAL_IMAGE_PDF_STATE: ImagePdfState = {
  step: 'upload',
  files: [],
  pageMode: 'fit',
  isBusy: false,
  progress: null,
  resultBlob: null,
  resultPages: 0,
  error: null,
};

export type ImagePdfAction =
  | { type: 'RESET' }
  | { type: 'SET_STEP'; step: ImagePdfStep }
  | { type: 'ADD_FILES'; files: ImageItem[] }
  | { type: 'MOVE_FILE'; index: number; direction: 'UP' | 'DOWN' }
  | { type: 'REORDER_FILES'; fromIndex: number; toIndex: number }
  | { type: 'REMOVE_FILE'; index: number }
  | { type: 'SMART_ARRANGE'; files: ImageItem[] }
  | { type: 'SET_PAGE_MODE'; mode: ImagePageMode }
  | { type: 'BUILD_START'; progress: ImagePdfProgress }
  | { type: 'BUILD_PROGRESS'; progress: ImagePdfProgress }
  | { type: 'BUILD_COMPLETE'; blob: Blob; pages: number }
  | { type: 'BUILD_ERROR'; error: string };

export function imagePdfReducer(state: ImagePdfState, action: ImagePdfAction): ImagePdfState {
  switch (action.type) {
    case 'RESET':
      return { ...INITIAL_IMAGE_PDF_STATE };

    case 'SET_STEP':
      return { ...state, step: action.step, error: null };

    case 'ADD_FILES': {
      if (action.files.length === 0) return state;
      const room = MAX_IMAGE_FILES - state.files.length;
      if (room <= 0) {
        return { ...state, error: `Maximum of ${MAX_IMAGE_FILES} images per PDF.` };
      }
      return {
        ...state,
        files: [...state.files, ...action.files.slice(0, room)],
        step: 'arrange',
        resultBlob: null,
        error: action.files.length > room ? `Only ${room} more image${room === 1 ? '' : 's'} added — cap is ${MAX_IMAGE_FILES}.` : null,
      };
    }

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
      if (files.length === 0) return { ...INITIAL_IMAGE_PDF_STATE };
      return { ...state, files, resultBlob: null };
    }

    case 'SMART_ARRANGE':
      return { ...state, files: action.files, resultBlob: null };

    case 'SET_PAGE_MODE':
      return { ...state, pageMode: action.mode };

    case 'BUILD_START':
      return { ...state, isBusy: true, progress: action.progress, error: null, resultBlob: null };

    case 'BUILD_PROGRESS':
      return { ...state, progress: action.progress };

    case 'BUILD_COMPLETE':
      return { ...state, isBusy: false, progress: null, resultBlob: action.blob, resultPages: action.pages, step: 'done' };

    case 'BUILD_ERROR':
      return { ...state, isBusy: false, progress: null, error: action.error };

    default:
      return state;
  }
}
