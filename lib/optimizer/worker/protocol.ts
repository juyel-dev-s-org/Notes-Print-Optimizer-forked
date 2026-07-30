import type { PageProfile, ProcessingParameters } from '../types';

export type ProcessingParams = {
  invertMode: string;
  bannerCropTopPct: number;
  bannerCropBottomPct: number;
  strokeEnhancement?: string;
  sharpenAmount: number;
};

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
      type: 'PAGE_ERROR';
      pageIndex: number;
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
