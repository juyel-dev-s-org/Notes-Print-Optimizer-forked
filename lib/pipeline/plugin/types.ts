import type { ChannelId } from './channels';
import type { MetricsBus } from '../../metrics/MetricsBus';

export type PluginId = string;

export interface PluginManifest {
  readonly id: PluginId;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly dependsOn?: PluginId[];
  readonly inputChannel: ChannelId;
  readonly outputChannel: ChannelId;
  readonly executionTarget: 'main' | 'worker' | 'wasm' | 'auto';
  readonly priority?: number;
  readonly optional: boolean;
  readonly resourceHint?: {
    estimatedMemoryMB?: number;
    isGPUBound?: boolean;
    isCPUBound?: boolean;
  };
}

export interface PluginContext {
  readonly documentId: string;
  readonly pageIndex: number;
  readonly totalPages: number;
  readonly signal: AbortSignal;
  readonly metricsBus?: MetricsBus;
  progress(fraction: number, message?: string): void;
  log(level: 'debug' | 'info' | 'warn' | 'error', msg: string): void;
}

export interface PluginResult<T = unknown> {
  readonly data: T;
  readonly metrics: PluginMetrics;
  readonly warnings?: string[];
  readonly cacheable?: boolean;
  readonly cacheKey?: string;
}

export interface PluginMetrics {
  readonly durationMs: number;
  readonly inputBytes: number;
  readonly outputBytes: number;
  readonly pixelsProcessed?: number;
  readonly wasmUsed?: boolean;
}

export interface IPlugin<I = unknown, O = unknown> {
  readonly manifest: PluginManifest;
  init?(ctx: PluginContext): Promise<void>;
  execute(input: I, ctx: PluginContext): Promise<PluginResult<O>>;
  executeBatch?(inputs: I[], ctx: PluginContext): Promise<PluginResult<O>[]>;
  isHealthy?(): boolean;
  dispose?(): Promise<void>;
}

export interface PluginRegistration {
  plugin: IPlugin;
  enabled: boolean;
  config?: Record<string, unknown>;
}
