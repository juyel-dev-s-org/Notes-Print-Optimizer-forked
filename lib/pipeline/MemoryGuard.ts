/**
 * MemoryGuard - Adaptive memory pressure management with multi-level detection.
 */
const MB = 1048576;
export type PressureLevel = 'normal' | 'elevated' | 'critical';
export interface MemoryLimits { maxHeapMB: number; evictThreshold: number; gcPressureThreshold: number; criticalThreshold: number; }
export type EvictionCallback = (level: PressureLevel, currentMB: number) => void;

interface NavigatorWithDeviceMemory extends Navigator { deviceMemory?: number }

function detectLimits(): MemoryLimits {
  const mem = typeof navigator !== 'undefined' ? (navigator as NavigatorWithDeviceMemory).deviceMemory : undefined;
  const gb = typeof mem === 'number' ? mem : 4;
  if (gb <= 4) return { maxHeapMB: 512, evictThreshold: 0.70, gcPressureThreshold: 0.80, criticalThreshold: 0.92 };
  if (gb <= 8) return { maxHeapMB: 1024, evictThreshold: 0.75, gcPressureThreshold: 0.85, criticalThreshold: 0.93 };
  return { maxHeapMB: 2048, evictThreshold: 0.80, gcPressureThreshold: 0.88, criticalThreshold: 0.95 };
}

export class MemoryGuard {
  private limits: MemoryLimits;
  private allocatedBytes = 0;
  private highWaterMark = 0;
  private evictionCallbacks: Set<EvictionCallback> = new Set();
  private lastPressureLevel: PressureLevel = 'normal';
  private pressureCheckCount = 0;
  private lastCheckTime = 0;
  private readonly checkThrottleMs = 50;

  constructor() { this.limits = detectLimits(); }
  onEviction(cb: EvictionCallback): () => void { this.evictionCallbacks.add(cb); return () => this.evictionCallbacks.delete(cb); }
  private getUsedJSHeapMB(): number { try { const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory; if (typeof mem?.usedJSHeapSize === 'number') return mem.usedJSHeapSize / MB; } catch { /* */ } return this.allocatedBytes / MB; }
  canAllocate(bytes: number): boolean { return (this.getUsedJSHeapMB() + bytes / MB) < this.limits.maxHeapMB * this.limits.evictThreshold; }
  trackAllocation(bytes: number): void { this.allocatedBytes += bytes; if (this.allocatedBytes > this.highWaterMark) this.highWaterMark = this.allocatedBytes; }
  trackRelease(bytes: number): void { this.allocatedBytes = Math.max(0, this.allocatedBytes - bytes); }

  getPressureLevel(): PressureLevel {
    const now = Date.now();
    if (now - this.lastCheckTime < this.checkThrottleMs) return this.lastPressureLevel;
    this.lastCheckTime = now; this.pressureCheckCount++;
    const ratio = this.getUsedJSHeapMB() / this.limits.maxHeapMB;
    let level: PressureLevel;
    if (ratio >= this.limits.criticalThreshold) level = 'critical';
    else if (ratio >= this.limits.gcPressureThreshold) level = 'elevated';
    else level = 'normal';
    if (level !== 'normal' && level !== this.lastPressureLevel) { for (const cb of this.evictionCallbacks) { try { cb(level, this.getUsedJSHeapMB()); } catch { /* */ } } }
    this.lastPressureLevel = level;
    return level;
  }

  isUnderPressure(): boolean { return this.getPressureLevel() !== 'normal'; }
  isCritical(): boolean { return this.getPressureLevel() === 'critical'; }
  getCurrentMB(): number { return Math.round(this.getUsedJSHeapMB()); }
  getHighWaterMarkMB(): number { return Math.round(this.highWaterMark / MB); }
  getLimits(): MemoryLimits { return { ...this.limits }; }
  getStats() { return { currentMB: this.getCurrentMB(), highWaterMarkMB: this.getHighWaterMarkMB(), level: this.lastPressureLevel, checks: this.pressureCheckCount }; }
  reset(): void { this.allocatedBytes = 0; this.highWaterMark = 0; this.lastPressureLevel = 'normal'; this.pressureCheckCount = 0; }
}

export const memoryGuard = new MemoryGuard();
