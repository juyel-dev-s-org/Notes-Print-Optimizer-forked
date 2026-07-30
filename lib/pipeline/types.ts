export interface DeviceProfile {
  cores: number;
  memoryGB: number;
  isMobile: boolean;
  isTablet: boolean;
  supportsWASM: boolean;
  supportsOffscreenCanvas: boolean;
  maxRenderDim: number;
}

export interface ScheduleProfile {
  renderConcurrency: number;
  processConcurrency: number;
  composeConcurrency: number;
  maxPagesInFlight: number;
  renderAhead: number;
  idbWriteBatchSize: number;
  yieldIntervalMs: number;
  targetDPI: number;
  maxRenderDim: number;
}

export function computeScheduleProfile(device: DeviceProfile): ScheduleProfile {
  if (device.isMobile || device.memoryGB <= 4) {
    return {
      renderConcurrency: 1, processConcurrency: 1, composeConcurrency: 1,
      maxPagesInFlight: 2, renderAhead: 1, idbWriteBatchSize: 2,
      yieldIntervalMs: 32, targetDPI: 150, maxRenderDim: 1600,
    };
  }
  if (device.isTablet || device.memoryGB <= 8) {
    return {
      renderConcurrency: 1, processConcurrency: 2, composeConcurrency: 1,
      maxPagesInFlight: 4, renderAhead: 2, idbWriteBatchSize: 4,
      yieldIntervalMs: 16, targetDPI: 200, maxRenderDim: 2000,
    };
  }
  return {
    renderConcurrency: 2,
    processConcurrency: Math.min(device.cores - 2, 6),
    composeConcurrency: 2, maxPagesInFlight: 8, renderAhead: 3,
    idbWriteBatchSize: 8, yieldIntervalMs: 16, targetDPI: 250, maxRenderDim: 2400,
  };
}
