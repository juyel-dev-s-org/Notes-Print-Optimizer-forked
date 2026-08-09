import type { PageProfile } from '../optimizer/types';

export type WorkerType = 'pixel' | 'compose' | 'render';

export interface PixelTask {
  taskId: string;
  pageIndex: number;
  buffer: ArrayBuffer;
  width: number;
  height: number;
  params: {
    invertMode: string;
    bannerCropTopPct: number;
    bannerCropBottomPct: number;
    strokeEnhancement?: string;
    sharpenAmount: number;
  };
  profile: { classification: string; darkBackgroundRatio: number };
}

export interface ComposeTask {
  taskId: string;
  sheetIndex: number;
  totalSheets: number;
  pageBuffers: ArrayBuffer[];
  pageWidths: number[];
  pageHeights: number[];
  cols: number;
  rows: number;
  dims: { widthPx: number; heightPx: number };
  marginTop: number;
  marginLeft: number;
  marginRight: number;
  marginBottom: number;
  marginInner: number;
  showSlideBorders: boolean;
  showPageNumbers: boolean;
}

export type WorkerRequest =
  | { type: 'PROCESS_PIXEL'; task: PixelTask }
  | { type: 'COMPOSE_SHEET'; task: ComposeTask }
  | { type: 'PING' }
  | { type: 'CANCEL'; taskId?: string }
  | { type: 'GET_BUFFER_STATS' }
  | { type: 'TERMINATE' };

export type WorkerResponse =
  | { type: 'PIXEL_PROCESSED'; taskId: string; pageIndex: number; buffer: ArrayBuffer; width: number; height: number; inkBefore: number; inkAfter: number }
  | { type: 'SHEET_COMPOSED'; taskId: string; sheetIndex: number; buffer: ArrayBuffer; width: number; height: number }
  | { type: 'PONG' }
  | { type: 'BUFFER_STATS'; bufferedCount: number; maxBuffered: number }
  | { type: 'ERROR'; taskId: string; error: string };

export interface TaskEntry<T = any> {
  taskId: string;
  type: WorkerRequest['type'];
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
  startTime: number;
  timeout: number;
  retriesLeft: number;
}

export interface WorkerInfo {
  worker: Worker;
  type: WorkerType;
  busy: boolean;
  taskId: string | null;
  healthy: boolean;
  lastPong: number;
}

export interface WorkerProcessResult {
  pageIndex: number;
  optimizedImageData: ImageData;
  inkCoverageBeforePct: number;
  inkCoverageAfterPct: number;
}

export function generateTaskId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
