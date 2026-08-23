/**
 * Split PDF — pure state machine for extract-range / burst-every-N modes.
 */

export type SplitStep = 'upload' | 'options' | 'done';
export type SplitMode = 'extract' | 'every' | 'parts';

/** '' name marks the single-extract output — the user names it on Done. */
export interface SplitOutput {
  name: string;
  blob: Blob;
  pages: number;
}

export interface SplitProgress {
  pct: number;
  label: string;
}

export interface SplitSource {
  name: string;
  baseName: string;
  sizeMB: string;
  bytes: Uint8Array;
}

export interface SplitState {
  step: SplitStep;
  source: SplitSource | null;
  pageCount: number | null;
  mode: SplitMode;
  rangeFrom: string;
  rangeTo: string;
  perFile: string;
  partCount: string;
  isBusy: boolean;
  progress: SplitProgress | null;
  kind: 'single' | 'multi';
  outputs: SplitOutput[];
  error: string | null;
}

export const INITIAL_SPLIT_STATE: SplitState = {
  step: 'upload',
  source: null,
  pageCount: null,
  mode: 'extract',
  rangeFrom: '',
  rangeTo: '',
  perFile: '',
  partCount: '',
  isBusy: false,
  progress: null,
  kind: 'single',
  outputs: [],
  error: null,
};

export type SplitAction =
  | { type: 'RESET' }
  | { type: 'SET_STEP'; step: SplitStep }
  | { type: 'SET_FILE'; source: SplitSource }
  | { type: 'SET_PAGE_COUNT'; count: number }
  | { type: 'SET_MODE'; mode: SplitMode }
  | { type: 'SET_RANGE_FROM'; value: string }
  | { type: 'SET_RANGE_TO'; value: string }
  | { type: 'SET_PER_FILE'; value: string }
  | { type: 'SET_PART_COUNT'; value: string }
  | { type: 'RUN_START'; progress: SplitProgress }
  | { type: 'RUN_PROGRESS'; progress: SplitProgress }
  | { type: 'RUN_COMPLETE'; kind: 'single' | 'multi'; outputs: SplitOutput[] }
  | { type: 'RUN_ERROR'; error: string };

const digitsOnly = (value: string, maxLen: number) => value.replace(/[^0-9]/g, '').slice(0, maxLen);

export function splitReducer(state: SplitState, action: SplitAction): SplitState {
  switch (action.type) {
    case 'RESET':
      return { ...INITIAL_SPLIT_STATE };

    case 'SET_STEP':
      return { ...state, step: action.step, error: null };

    case 'SET_FILE':
      return {
        ...state,
        source: action.source,
        pageCount: null,
        step: 'options',
        outputs: [],
        error: null,
      };

    case 'SET_PAGE_COUNT':
      return { ...state, pageCount: action.count };

    case 'SET_MODE':
      return { ...state, mode: action.mode, error: null };

    case 'SET_RANGE_FROM':
      return { ...state, rangeFrom: digitsOnly(action.value, 4) };

    case 'SET_RANGE_TO':
      return { ...state, rangeTo: digitsOnly(action.value, 4) };

    case 'SET_PER_FILE':
      return { ...state, perFile: digitsOnly(action.value, 4) };

    case 'SET_PART_COUNT':
      return { ...state, partCount: digitsOnly(action.value, 3) };

    case 'RUN_START':
      return { ...state, isBusy: true, progress: action.progress, error: null, outputs: [] };

    case 'RUN_PROGRESS':
      return { ...state, progress: action.progress };

    case 'RUN_COMPLETE':
      return {
        ...state,
        isBusy: false,
        progress: null,
        kind: action.kind,
        outputs: action.outputs,
        step: 'done',
      };

    case 'RUN_ERROR':
      return { ...state, isBusy: false, progress: null, error: action.error };

    default:
      return state;
  }
}

/** Zero-padded part file name, e.g. "notes-part03.pdf". */
export function buildPartName(base: string, index: number): string {
  return `${base}-part${String(index + 1).padStart(2, '0')}.pdf`;
}
