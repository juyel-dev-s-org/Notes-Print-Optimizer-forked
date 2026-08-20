import type { AppConfig } from './schema';

const VALID_PRESETS = new Set(['AUTO_ADAPTIVE', 'PW_DARK_SLIDE', 'LIGHT_HANDWRITTEN', 'INK_SAVER_EXTREME', 'DIAGRAM_HIGH_CONTRAST']);
const VALID_EXECUTION_MODES = new Set(['auto', 'parallel', 'sequential', 'hybrid']);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateAppConfig(config: AppConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!VALID_PRESETS.has(config.processing.defaultPreset)) {
    errors.push(`processing.defaultPreset must be one of: ${[...VALID_PRESETS].join(', ')}`);
  }
  if (!VALID_EXECUTION_MODES.has(config.processing.executionMode)) {
    errors.push(`processing.executionMode must be one of: ${[...VALID_EXECUTION_MODES].join(', ')}`);
  }
  if (config.processing.outputQuality < 0.5 || config.processing.outputQuality > 1) {
    errors.push('processing.outputQuality must be between 0.5 and 1.0');
  }

  if (config.memory.maxHeapMB < 128) {
    errors.push('memory.maxHeapMB must be at least 128');
  }
  if (config.memory.evictThreshold <= 0 || config.memory.evictThreshold >= 1) {
    errors.push('memory.evictThreshold must be between 0 and 1 (exclusive)');
  }
  if (config.memory.gcPressureThreshold <= 0 || config.memory.gcPressureThreshold >= 1) {
    errors.push('memory.gcPressureThreshold must be between 0 and 1 (exclusive)');
  }
  if (config.memory.evictThreshold >= config.memory.gcPressureThreshold) {
    errors.push('memory.evictThreshold must be less than memory.gcPressureThreshold');
  }

  if (config.scheduler.maxConcurrency < 1) {
    errors.push('scheduler.maxConcurrency must be at least 1');
  }
  if (config.scheduler.yieldIntervalMs < 0) {
    errors.push('scheduler.yieldIntervalMs must be >= 0');
  }

  if (config.workers.healthCheckIntervalMs < 1000) {
    errors.push('workers.healthCheckIntervalMs must be at least 1000');
  }
  if (config.workers.pingTimeoutMs < 500) {
    errors.push('workers.pingTimeoutMs must be at least 500');
  }
  if (config.workers.pingTimeoutMs >= config.workers.healthCheckIntervalMs) {
    errors.push('workers.pingTimeoutMs must be less than workers.healthCheckIntervalMs');
  }
  if (config.workers.defaultTimeoutMs < 1000) {
    errors.push('workers.defaultTimeoutMs must be at least 1000');
  }
  if (config.workers.maxRetries < 0) {
    errors.push('workers.maxRetries must be >= 0');
  }

  if (config.engine.renderScale <= 0 || config.engine.renderScale > 4) {
    errors.push('engine.renderScale must be between >0 and <=4');
  }

  if (!config.processing.enableWorkers && config.processing.executionMode === 'parallel') {
    warnings.push('processing.executionMode is "parallel" but workers are disabled — falling back to sequential');
  }

  return { valid: errors.length === 0, errors, warnings };
}
