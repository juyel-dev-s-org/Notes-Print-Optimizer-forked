/**
 * Enhance Light PDF — types and constants.
 *
 * Tool scope (v1): enhance light-background / faint-ink PDFs (handwritten
 * notebook scans, photographed module pages) so they survive printing and
 * photocopying. Mobile-only UI; the engine itself is platform-agnostic.
 */

import type { UploadedPdfItem } from '@/lib/workflow/types';

/** App-level tool selection (landing tools box). */
export type ToolMode = 'dark-print' | 'enhance';

export type EnhanceStep = 'upload' | 'enhance' | 'export';

export interface EnhanceSettings {
  /** 0-100 — how much faint ink is pushed toward black. */
  darken: number;
  /** 0-100 — histogram stretch strength (removes flat gray). */
  contrast: number;
  /** 0-100 — unsharp strength; 0 disables the sharpen pass. */
  sharpen: number;
  /** Remove page tint/shadow by mapping near-background pixels to pure white. */
  cleanBackground: boolean;
  /** Convert to grayscale before sharpening (mono print output). */
  grayscale: boolean;
}

export const DEFAULT_ENHANCE_SETTINGS: EnhanceSettings = {
  darken: 45,
  contrast: 35,
  sharpen: 25,
  cleanBackground: true,
  grayscale: false,
};

export const ENHANCE_SETTING_RANGE = { darken: [0, 100], contrast: [0, 100], sharpen: [0, 100] } as const;

export interface EnhancePageResult {
  index: number;
  width: number;
  height: number;
  /** JPEG data URL of the enhanced page (used for preview + export). */
  dataUrl: string;
  /** JPEG data URL of the original page (used for before/after preview). */
  originalDataUrl: string;
}

export interface EnhanceProgress {
  current: number;
  total: number;
  phase: string;
}

export interface EnhanceState {
  step: EnhanceStep;
  files: UploadedPdfItem[];
  isProcessing: boolean;
  progress: EnhanceProgress | null;
  settings: EnhanceSettings;
  results: EnhancePageResult[];
  selectedIndex: number;
  pdfBlob: Blob | null;
  fileName: string;
  exportBusy: boolean;
  error: string | null;
}

export const INITIAL_ENHANCE_STATE: EnhanceState = {
  step: 'upload',
  files: [],
  isProcessing: false,
  progress: null,
  settings: DEFAULT_ENHANCE_SETTINGS,
  results: [],
  selectedIndex: 0,
  pdfBlob: null,
  fileName: 'enhanced-print.pdf',
  exportBusy: false,
  error: null,
};

export type EnhanceAction =
  | { type: 'RESET' }
  | { type: 'SET_STEP'; step: EnhanceStep }
  | { type: 'SET_FILES'; files: UploadedPdfItem[]; step: EnhanceStep }
  | { type: 'SET_SETTINGS'; settings: EnhanceSettings }
  | { type: 'SET_SELECTED'; index: number }
  | { type: 'PROCESS_START' }
  | { type: 'PROCESS_PROGRESS'; progress: EnhanceProgress }
  | { type: 'PROCESS_COMPLETE'; results: EnhancePageResult[]; fileName: string }
  | { type: 'PROCESS_ERROR'; error: string }
  | { type: 'EXPORT_START' }
  | { type: 'EXPORT_COMPLETE'; blob: Blob; fileName: string }
  | { type: 'EXPORT_ERROR'; error: string };