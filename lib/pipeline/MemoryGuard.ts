const MB = 1048576;

export interface MemoryLimits {
  maxHeapMB: number;
  evictThreshold: number;
  gcPressureThreshold: number;
}

function detectLimits(): MemoryLimits {
  const mem = typeof navigator !== 'undefined' ? (navigator as any).deviceMemory : undefined;
  const gb = typeof mem === 'number' ? mem : 4;
  if (gb <= 4) return { maxHeapMB: 512, evictThreshold: 0.75, gcPressureThreshold: 0.85 };
  if (gb <= 8) return { maxHeapMB: 1024, evictThreshold: 0.8, gcPressureThreshold: 0.9 };
  return { maxHeapMB: 2048, evictThreshold: 0.85, gcPressureThreshold: 0.92 };
}

export class MemoryGuard {
  private limits: MemoryLimits;
  private allocatedBytes = 0;
  private highWaterMark = 0;

  constructor() {
    this.limits = detectLimits();
  }

  private getUsedJSHeapMB(): number {
    try {
      const raw = (performance as any).memory?.usedJSHeapSize;
      if (typeof raw === 'number') return raw / MB;
    } catch { /* */ }
    return this.allocatedBytes / MB;
  }

  canAllocate(bytes: number): boolean {
    const currentMB = this.getUsedJSHeapMB();
    return (currentMB + bytes / MB) < this.limits.maxHeapMB * this.limits.evictThreshold;
  }

  trackAllocation(bytes: number): void {
    this.allocatedBytes += bytes;
    if (this.allocatedBytes > this.highWaterMark) this.highWaterMark = this.allocatedBytes;
  }

  trackRelease(bytes: number): void {
    this.allocatedBytes = Math.max(0, this.allocatedBytes - bytes);
  }

  isUnderPressure(): boolean {
    const currentMB = this.getUsedJSHeapMB();
    const ratio = currentMB / this.limits.maxHeapMB;
    if (ratio > this.highWaterMark / MB / this.limits.maxHeapMB) {
      this.highWaterMark = Math.max(this.highWaterMark, currentMB * MB);
    }
    return ratio >= this.limits.gcPressureThreshold;
  }

  getCurrentMB(): number {
    return Math.round(this.getUsedJSHeapMB());
  }

  getHighWaterMarkMB(): number {
    return Math.round(this.highWaterMark / MB);
  }

  getLimits(): MemoryLimits {
    return { ...this.limits };
  }

  reset(): void {
    this.allocatedBytes = 0;
    this.highWaterMark = 0;
  }
}

export const memoryGuard = new MemoryGuard();
