export type MetricEventType =
  | 'page:processed'
  | 'page:render'
  | 'plugin:execute'
  | 'plugin:error'
  | 'memory:pressure'
  | 'memory:eviction'
  | 'worker:task'
  | 'worker:crashed'
  | 'pipeline:phase'
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

export interface PluginExecuteEvent extends BaseMetricEvent {
  type: 'plugin:execute';
  pluginId: string;
  pageIndex: number;
}

export interface PluginErrorEvent extends BaseMetricEvent {
  type: 'plugin:error';
  pluginId: string;
  errorMessage: string;
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

export interface PipelinePhaseEvent extends BaseMetricEvent {
  type: 'pipeline:phase';
  phase: string;
  documentId: string;
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
  | PluginExecuteEvent
  | PluginErrorEvent
  | MemoryPressureEvent
  | MemoryEvictionEvent
  | WorkerTaskEvent
  | WorkerCrashedEvent
  | PipelinePhaseEvent
  | PagePhasesEvent
  | DocPhasesEvent;

export type MetricEventListener = (event: MetricEvent) => void;

export interface MetricsSnapshot {
  pagesProcessed: number;
  avgInkSavedPct: number;
  avgProcessingTimeMs: number;
  peakMemoryMB: number;
  workerCrashes: number;
  pluginErrors: number;
  totalElapsedMs: number;
}
