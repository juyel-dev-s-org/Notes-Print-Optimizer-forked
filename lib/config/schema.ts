import type { ProcessingParameters, LayoutConfig } from '../optimizer/types';
import type { EngineVersion } from '../optimizer/engine/types';

export type { LayoutConfig };

export interface ProcessingConfig {
  defaultPreset: ProcessingParameters['preset'];
  outputQuality: number;
  enableWorkers: boolean;
  executionMode: 'auto' | 'parallel' | 'sequential' | 'hybrid';
}

export interface MemoryConfig {
  maxHeapMB: number;
  evictThreshold: number;
  gcPressureThreshold: number;
}

export interface SchedulerConfig {
  maxConcurrency: number;
  yieldIntervalMs: number;
}

export interface WorkerPoolConfig {
  defaultTimeoutMs: number;
  healthCheckIntervalMs: number;
  maxRetries: number;
  pingTimeoutMs: number;
}

export interface EngineConfig {
  version: EngineVersion;
  renderScale: number;
}

export interface AppConfig {
  processing: ProcessingConfig;
  layout: LayoutConfig;
  memory: MemoryConfig;
  scheduler: SchedulerConfig;
  workers: WorkerPoolConfig;
  engine: EngineConfig;
}
