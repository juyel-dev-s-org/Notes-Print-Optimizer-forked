export type WorkerType = 'pixel' | 'compose' | 'render';

export interface PixelTask {
  taskId: string;
  pageIndex: number;
  buffer: ArrayBuffer;
  width: number;
  height: number;
  params: {
    invertMode: 'smart' | 'simple' | 'none';
    bannerCropTopPct: number;
    bannerCropBottomPct: number;
    strokeEnhancement?: 'none' | 'normal' | 'strong';
    sharpenAmount: number;
    /** Exact kernel size (was previously re-derived in the worker,
     *  silently capping the slider at 'strong'). */
    dilationKernelSize?: number;
    /** Auto white-box heal flag (kernels/whiteBox). */
    autoWhiteBoxFix?: boolean;
  };
  profile: { classification: 'DARK_SLIDE' | 'LIGHT_SLIDE' | 'HANDWRITTEN_NOTES' | 'SCREENSHOT_HEAVY' | 'DIAGRAM_EQUATION' | 'MIXED'; darkBackgroundRatio: number };
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
  footerHeight: number;
  footerFontSize: number;
  footerBaseline: number;
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
  | { type: 'PIXEL_PROCESSED'; taskId: string; pageIndex: number; buffer: ArrayBuffer; width: number; height: number; inkBefore: number; inkAfter: number; whiteBoxRegions?: Array<{ x: number; y: number; width: number; height: number }> }
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
  timerId?: ReturnType<typeof setTimeout> | null;
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
  /** White boxes restored from the original (dark pages, autoWhiteBoxFix). */
  whiteBoxRegions?: Array<{ x: number; y: number; width: number; height: number }>;
}

export function generateTaskId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
