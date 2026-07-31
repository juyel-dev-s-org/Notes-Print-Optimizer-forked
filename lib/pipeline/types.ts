/**
 * Pipeline types and device-adaptive scheduling profiles.
 */
export interface DeviceProfile { cores: number; memoryGB: number; isMobile: boolean; isTablet: boolean; supportsWASM: boolean; supportsOffscreenCanvas: boolean; maxRenderDim: number; }
export interface ScheduleProfile { renderConcurrency: number; processConcurrency: number; composeConcurrency: number; maxPagesInFlight: number; renderAhead: number; idbWriteBatchSize: number; yieldIntervalMs: number; targetDPI: number; maxRenderDim: number; }

export function computeScheduleProfile(device: DeviceProfile): ScheduleProfile {
  if (device.isMobile || device.memoryGB <= 4) {
    return { renderConcurrency: 1, processConcurrency: 1, composeConcurrency: 1, maxPagesInFlight: 2, renderAhead: 1, idbWriteBatchSize: 2, yieldIntervalMs: 32, targetDPI: 150, maxRenderDim: Math.min(device.maxRenderDim, 1600) };
  }
  if (device.isTablet || device.memoryGB <= 8) {
    return { renderConcurrency: 1, processConcurrency: 2, composeConcurrency: 1, maxPagesInFlight: 4, renderAhead: 2, idbWriteBatchSize: 4, yieldIntervalMs: 16, targetDPI: 200, maxRenderDim: Math.min(device.maxRenderDim, 2000) };
  }
  const processConcurrency = Math.max(2, Math.min(device.cores - 2, 6));
  return { renderConcurrency: 2, processConcurrency, composeConcurrency: 2, maxPagesInFlight: Math.min(8, processConcurrency + 2), renderAhead: 3, idbWriteBatchSize: 8, yieldIntervalMs: 16, targetDPI: 250, maxRenderDim: device.maxRenderDim };
}

export function detectDeviceProfile(): DeviceProfile {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  return { cores: nav?.hardwareConcurrency || 4, memoryGB: (nav as any)?.deviceMemory || 4, isMobile: typeof window !== 'undefined' ? /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(nav?.userAgent || '') : false, isTablet: typeof window !== 'undefined' ? /iPad|Android(?!.*Mobile)/i.test(nav?.userAgent || '') : false, supportsWASM: typeof WebAssembly !== 'undefined', supportsOffscreenCanvas: typeof OffscreenCanvas !== 'undefined', maxRenderDim: 2400 };
}
