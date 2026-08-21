export type MetricEventType =
  | 'page:processed'
  | 'page:render'
  | 'memory:pressure'
  | 'memory:eviction'
  | 'worker:task'
  | 'worker:crashed'
  | 'page:phases'
  | 'doc:phases';

export interface BaseMetricEvent {
  type: MetricEventType;
  timestamp: number;
  durationMs?: number;
}

export interface PageProcessedEvent extends BaseMetricEvent {
  type: 'page:processed';
  pageIndex: number;
  inkBeforePct: number;
  inkAfterPct: number;
}

export interface MemoryPressureEvent extends BaseMetricEvent {
  type: 'memory:pressure';
  usedMB: number;
  limitMB: number;
}

export interface MemoryEvictionEvent extends BaseMetricEvent {
  type: 'memory:eviction';
  evictedPages: number;
  freedMB: number;
}

export interface WorkerTaskEvent extends BaseMetricEvent {
  type: 'worker:task';
  taskType: string;
  durationMs: number;
}

export interface WorkerCrashedEvent extends BaseMetricEvent {
  type: 'worker:crashed';
  workerType: string;
}

/** Phase-0: per-page timing breakdown (milliseconds). */
export interface PagePhasesEvent extends BaseMetricEvent {
  type: 'page:phases';
  pageIndex: number;
  renderMs: number;
  analyzeMs: number;
  processMs: number;
  thumbnailMs: number;
  persistMs: number;
}

/** Phase-0: document-level aggregated timing breakdown. */
export interface DocPhasesEvent extends BaseMetricEvent {
  type: 'doc:phases';
  totalPages: number;
  pagesPerSecond: number;
  renderMs: number;
  analyzeMs: number;
  processMs: number;
  thumbnailMs: number;
  persistMs: number;
}

export type MetricEvent =
  | PageProcessedEvent
  | MemoryPressureEvent
  | MemoryEvictionEvent
  | WorkerTaskEvent
  | WorkerCrashedEvent
  | PagePhasesEvent
  | DocPhasesEvent;

export type MetricEventListener = (event: MetricEvent) => void;

export interface MetricsSnapshot {
  pagesProcessed: number;
  avgInkSavedPct: number;
  avgProcessingTimeMs: number;
  peakMemoryMB: number;
  workerCrashes: number;
  totalElapsedMs: number;
}
