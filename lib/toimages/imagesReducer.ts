/**
 * PDF to Images — pure state machine for the conversion tool.
 */

import { sanitizeBaseName } from '../shared/filename';

// Canonical implementation lives in lib/shared; re-exported for compatibility.
export { resolveRange } from '../shared/range';

export type ImagesStep = 'upload' | 'options' | 'done';
export type ImagesFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export const DPI_PRESETS = [
  { id: 'low', label: 'Low', dpi: 72, hint: 'Screens & quick shares' },
  { id: 'balanced', label: 'Balanced', dpi: 150, hint: 'Crisp default for most uses' },
  { id: 'high', label: 'High', dpi: 300, hint: 'Print-grade detail, larger files' },
] as const;

export type DpiPresetId = (typeof DPI_PRESETS)[number]['id'];

export interface ImagesSource {
  name: string;
  baseName: string;
  sizeMB: string;
  bytes: Uint8Array;
}

export interface PageOutput {
  name: string;
  blob: Blob;
  thumbDataUrl: string;
}

export interface ImagesState {
  step: ImagesStep;
  source: ImagesSource | null;
  pageCount: number | null;
  dpi: DpiPresetId;
  format: ImagesFormat;
  quality: number;
  rangeMode: 'all' | 'custom';
  /** Raw input values — parsed by resolveRange(). */
  rangeFrom: string;
  rangeTo: string;
  isBusy: boolean;
  progress: { current: number; total: number } | null;
  results: PageOutput[];
  error: string | null;
}

export const INITIAL_IMAGES_STATE: ImagesState = {
  step: 'upload',
  source: null,
  pageCount: null,
  dpi: 'balanced',
  format: 'image/jpeg',
  quality: 0.92,
  rangeMode: 'all',
  rangeFrom: '',
  rangeTo: '',
  isBusy: false,
  progress: null,
  results: [],
  error: null,
};

export type ImagesAction =
  | { type: 'RESET' }
  | { type: 'SET_STEP'; step: ImagesStep }
  | { type: 'SET_FILE'; source: ImagesSource }
  | { type: 'SET_PAGE_COUNT'; count: number }
  | { type: 'SET_DPI'; dpi: DpiPresetId }
  | { type: 'SET_FORMAT'; format: ImagesFormat }
  | { type: 'SET_QUALITY'; quality: number }
  | { type: 'SET_RANGE_MODE'; mode: 'all' | 'custom' }
  | { type: 'SET_RANGE_FROM'; value: string }
  | { type: 'SET_RANGE_TO'; value: string }
  | { type: 'CONVERT_START'; total: number }
  | { type: 'CONVERT_PROGRESS'; current: number }
  | { type: 'CONVERT_COMPLETE'; results: PageOutput[] }
  | { type: 'CONVERT_ERROR'; error: string };

export function imagesReducer(state: ImagesState, action: ImagesAction): ImagesState {
  switch (action.type) {
    case 'RESET':
      return { ...INITIAL_IMAGES_STATE };

    case 'SET_STEP':
      return { ...state, step: action.step, error: null };

    case 'SET_FILE':
      return {
        ...state,
        source: action.source,
        pageCount: null,
        step: 'options',
        results: [],
        error: null,
      };

    case 'SET_PAGE_COUNT':
      return { ...state, pageCount: action.count };

    case 'SET_DPI':
      return { ...state, dpi: action.dpi };

    case 'SET_FORMAT':
      return { ...state, format: action.format };

    case 'SET_QUALITY':
      return { ...state, quality: action.quality };

    case 'SET_RANGE_MODE':
      return { ...state, rangeMode: action.mode, error: null };

    case 'SET_RANGE_FROM':
      return { ...state, rangeFrom: action.value.replace(/[^0-9]/g, '').slice(0, 4) };

    case 'SET_RANGE_TO':
      return { ...state, rangeTo: action.value.replace(/[^0-9]/g, '').slice(0, 4) };

    case 'CONVERT_START':
      return {
        ...state,
        isBusy: true,
        progress: { current: 0, total: action.total },
        results: [],
        error: null,
      };

    case 'CONVERT_PROGRESS':
      return state.progress
        ? { ...state, progress: { ...state.progress, current: action.current } }
        : state;

    case 'CONVERT_COMPLETE':
      return { ...state, isBusy: false, progress: null, results: action.results, step: 'done' };

    case 'CONVERT_ERROR':
      return { ...state, isBusy: false, progress: null, error: action.error };

    default:
      return state;
  }
}

export { sanitizeBaseName };
