import type { PageProfile, ProcessingParameters } from '../types';
import type { SheetDimensions } from '../layoutEngine';

export type ProcessingParams = {
  invertMode: string;
  bannerCropTopPct: number;
  bannerCropBottomPct: number;
  strokeEnhancement?: string;
  sharpenAmount: number;
};

export interface ComposeSheetParams {
  sheetIndex: number;
  totalSheets: number;
  pageBuffers: ArrayBuffer[];
  pageWidths: number[];
  pageHeights: number[];
  dims: SheetDimensions;
  orientation: 'PORTRAIT' | 'LANDSCAPE' | 'AUTO';
  cols: number;
  rows: number;
  marginTop: number;
  marginLeft: number;
  marginRight: number;
  marginBottom: number;
  marginInner: number;
  showSlideBorders: boolean;
  showPageNumbers: boolean;
}

export type WorkerRequest =
  | {
      type: 'PROCESS_PAGE';
      pageIndex: number;
      buffer: ArrayBuffer;
      width: number;
      height: number;
      params: ProcessingParams;
      profile: { classification: string; darkBackgroundRatio: number };
    }
  | { type: 'COMPOSE_SHEET'; params: ComposeSheetParams }
  | { type: 'CANCEL'; pageIndex?: number }
  | { type: 'TERMINATE' };

export type WorkerResponse =
  | {
      type: 'PAGE_PROCESSED';
      pageIndex: number;
      buffer: ArrayBuffer;
      width: number;
      height: number;
      inkCoverageBeforePct: number;
      inkCoverageAfterPct: number;
    }
  | {
      type: 'SHEET_COMPOSED';
      sheetIndex: number;
      buffer: ArrayBuffer;
      width: number;
      height: number;
    }
  | {
      type: 'PAGE_ERROR';
      pageIndex: number;
      error: string;
    }
  | {
      type: 'COMPOSE_ERROR';
      sheetIndex: number;
      error: string;
    };

export interface QueuedTask {
  pageIndex: number;
  buffer: ArrayBuffer;
  width: number;
  height: number;
  params: ProcessingParameters;
  profile: PageProfile;
  resolve: (r: WorkerProcessResult) => void;
  reject: (e: Error) => void;
}

export interface WorkerProcessResult {
  pageIndex: number;
  optimizedImageData: ImageData;
  inkCoverageBeforePct: number;
  inkCoverageAfterPct: number;
}
