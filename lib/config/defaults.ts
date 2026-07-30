import type { LayoutConfig } from '../optimizer/types';
import type {
  AppConfig,
  ProcessingConfig,
  MemoryConfig,
  SchedulerConfig,
  WorkerPoolConfig,
  EngineConfig,
} from './schema';

export const defaultProcessingConfig: ProcessingConfig = {
  defaultPreset: 'AUTO_ADAPTIVE',
  outputQuality: 0.88,
  enableWorkers: true,
  executionMode: 'auto',
};

export const defaultLayoutConfig: LayoutConfig = {
  gridFormat: '2x2',
  paperSize: 'A4',
  orientation: 'PORTRAIT',
  outerMarginMm: { top: 2, left: 5, right: 3, bottom: 2 },
  innerMarginMm: 1,
  marginMm: 2,
  spacingMm: 1,
  showSlideBorders: false,
  showPageNumbers: false,
  headerTitle: '',
};

function detectMemoryConfig(): MemoryConfig {
  const mem = typeof navigator !== 'undefined' ? (navigator as any).deviceMemory : undefined;
  const gb = typeof mem === 'number' ? mem : 4;
  if (gb <= 4) return { maxHeapMB: 512, evictThreshold: 0.75, gcPressureThreshold: 0.85 };
  if (gb <= 8) return { maxHeapMB: 1024, evictThreshold: 0.8, gcPressureThreshold: 0.9 };
  return { maxHeapMB: 2048, evictThreshold: 0.85, gcPressureThreshold: 0.92 };
}

export const defaultMemoryConfig: MemoryConfig = detectMemoryConfig();

export const defaultSchedulerConfig: SchedulerConfig = {
  maxConcurrency: 4,
  yieldIntervalMs: 16,
};

export const defaultWorkerPoolConfig: WorkerPoolConfig = {
  defaultTimeoutMs: 30_000,
  healthCheckIntervalMs: 15_000,
  maxRetries: 2,
  pingTimeoutMs: 3_000,
};

export const defaultEngineConfig: EngineConfig = {
  version: 'v2',
  renderScale: 1,
};

export const defaultAppConfig: AppConfig = {
  processing: defaultProcessingConfig,
  layout: defaultLayoutConfig,
  memory: defaultMemoryConfig,
  scheduler: defaultSchedulerConfig,
  workers: defaultWorkerPoolConfig,
  engine: defaultEngineConfig,
};
