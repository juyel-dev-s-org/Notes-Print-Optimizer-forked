/**
 * Protect PDF — types for the on-device AES-256 protection tool.
 *
 * Locks are stored as "user wants this action BLOCKED" booleans; the
 * encryption service inverts them into the PDF permission bits.
 */

export type ProtectStep = 'upload' | 'options' | 'done';

export interface ProtectLocks {
  /** true = printing is locked (allowPrinting:false). */
  printing: boolean;
  /** true = text/image copying is locked. */
  copying: boolean;
  /** true = content modification is locked. */
  modifying: boolean;
}

export const INITIAL_LOCKS: ProtectLocks = { printing: false, copying: false, modifying: false };

export interface ProtectSource {
  name: string;
  baseName: string;
  sizeMB: string;
  bytes: Uint8Array;
}

export interface ProtectProgress {
  pct: number;
  label: string;
}

export interface ProtectState {
  step: ProtectStep;
  source: ProtectSource | null;
  userPassword: string;
  ownerPassword: string;
  locks: ProtectLocks;
  isBusy: boolean;
  progress: ProtectProgress | null;
  resultBlob: Blob | null;
  error: string | null;
}

export const INITIAL_PROTECT_STATE: ProtectState = {
  step: 'upload',
  source: null,
  userPassword: '',
  ownerPassword: '',
  locks: { ...INITIAL_LOCKS },
  isBusy: false,
  progress: null,
  resultBlob: null,
  error: null,
};

export type ProtectAction =
  | { type: 'RESET' }
  | { type: 'SET_STEP'; step: ProtectStep }
  | { type: 'SET_FILE'; source: ProtectSource }
  | { type: 'SET_USER_PASSWORD'; password: string }
  | { type: 'SET_OWNER_PASSWORD'; password: string }
  | { type: 'TOGGLE_LOCK'; key: keyof ProtectLocks }
  | { type: 'PROTECT_START'; progress: ProtectProgress }
  | { type: 'PROTECT_PROGRESS'; progress: ProtectProgress }
  | { type: 'PROTECT_COMPLETE'; blob: Blob }
  | { type: 'PROTECT_ERROR'; error: string };

// Shared implementation lives in lib/shared; re-exported for compatibility.
export { sanitizeBaseName } from '../shared/filename';

export function protectReducer(state: ProtectState, action: ProtectAction): ProtectState {
  switch (action.type) {
    case 'RESET':
      return { ...INITIAL_PROTECT_STATE };

    case 'SET_STEP':
      return { ...state, step: action.step, error: null };

    case 'SET_FILE':
      return {
        ...state,
        source: action.source,
        step: 'options',
        userPassword: '',
        ownerPassword: '',
        locks: { ...INITIAL_LOCKS },
        resultBlob: null,
        error: null,
      };

    case 'SET_USER_PASSWORD':
      return { ...state, userPassword: action.password, error: null };

    case 'SET_OWNER_PASSWORD':
      return { ...state, ownerPassword: action.password };

    case 'TOGGLE_LOCK':
      return { ...state, locks: { ...state.locks, [action.key]: !state.locks[action.key] } };

    case 'PROTECT_START':
      return { ...state, isBusy: true, progress: action.progress, error: null, resultBlob: null };

    case 'PROTECT_PROGRESS':
      return { ...state, progress: action.progress };

    case 'PROTECT_COMPLETE':
      return { ...state, isBusy: false, progress: null, resultBlob: action.blob, step: 'done' };

    case 'PROTECT_ERROR':
      return { ...state, isBusy: false, progress: null, error: action.error };

    default:
      return state;
  }
}
