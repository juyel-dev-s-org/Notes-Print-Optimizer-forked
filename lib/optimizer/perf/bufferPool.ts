/**
 * BufferPool - Tiered memory pool with page-sized buckets.
 *
 * Production optimizations:
 *  - Added 4MB/8MB/16MB buckets for page ImageData reuse (eliminates GC pressure)
 *  - Shrink capability for memory-constrained devices
 *  - Hit/miss tracking for diagnostics
 *  - Pool budget cap prevents unbounded memory retention
 */

interface PoolBucket {
  buffers: ArrayBuffer[];
  maxCount: number;
}

const BUCKET_SPECS: Array<{ threshold: number; key: string; maxCount: number }> = [
  { threshold: 1024, key: '1K', maxCount: 16 },
  { threshold: 4096, key: '4K', maxCount: 12 },
  { threshold: 16384, key: '16K', maxCount: 8 },
  { threshold: 65536, key: '64K', maxCount: 6 },
  { threshold: 262144, key: '256K', maxCount: 4 },
  { threshold: 1048576, key: '1M', maxCount: 4 },
  { threshold: 4194304, key: '4M', maxCount: 3 },
  { threshold: 8388608, key: '8M', maxCount: 2 },
  { threshold: 16777216, key: '16M', maxCount: 2 },
  { threshold: Infinity, key: 'LARGE', maxCount: 1 },
];

export class BufferPool {
  private pools: Map<string, PoolBucket> = new Map();
  private totalPooledBytes = 0;
  private maxPooledBytes: number;
  private hitCount = 0;
  private missCount = 0;

  constructor(maxPooledMB = 64) {
    this.maxPooledBytes = maxPooledMB * 1048576;
    for (const spec of BUCKET_SPECS) {
      this.pools.set(spec.key, { buffers: [], maxCount: spec.maxCount });
    }
  }

  acquire(size: number): Uint8Array {
    const key = this.bucketKey(size);
    const bucket = this.pools.get(key);
    if (bucket && bucket.buffers.length > 0) {
      const buf = bucket.buffers.pop()!;
      if (buf.byteLength >= size) {
        this.totalPooledBytes -= buf.byteLength;
        this.hitCount++;
        return new Uint8Array(buf);
      }
      /* Pooled buffer smaller than requested (buckets are threshold-keyed, so
         a bucket can hold buffers of any size below its threshold) — discard
         it and allocate fresh; returning it would corrupt callers. */
      this.totalPooledBytes -= buf.byteLength;
    }
    this.missCount++;
    return new Uint8Array(size);
  }

  acquireRaw(size: number): ArrayBuffer {
    const key = this.bucketKey(size);
    const bucket = this.pools.get(key);
    if (bucket && bucket.buffers.length > 0) {
      const buf = bucket.buffers.pop()!;
      if (buf.byteLength >= size) {
        this.totalPooledBytes -= buf.byteLength;
        this.hitCount++;
        return buf;
      }
      this.totalPooledBytes -= buf.byteLength;
    }
    this.missCount++;
    return new ArrayBuffer(size);
  }

  release(buf: Uint8Array): void {
    this.releaseRaw(buf.buffer as ArrayBuffer, buf.byteLength);
  }

  releaseRaw(buf: ArrayBuffer, byteLength?: number): void {
    const size = byteLength ?? buf.byteLength;
    if (this.totalPooledBytes + size > this.maxPooledBytes) return;
    const key = this.bucketKey(size);
    const bucket = this.pools.get(key);
    if (!bucket || bucket.buffers.length >= bucket.maxCount) return;
    bucket.buffers.push(buf);
    this.totalPooledBytes += size;
  }

  /** Shrink pool by releasing buffers above target size (for memory pressure). */
  shrink(targetMB = 16): void {
    const targetBytes = targetMB * 1048576;
    const keys = [...this.pools.keys()].reverse();
    for (const key of keys) {
      if (this.totalPooledBytes <= targetBytes) break;
      const bucket = this.pools.get(key)!;
      while (bucket.buffers.length > 0 && this.totalPooledBytes > targetBytes) {
        const buf = bucket.buffers.pop()!;
        this.totalPooledBytes -= buf.byteLength;
      }
    }
  }

  /** Release ALL pooled buffers (disposal or critical pressure). */
  drain(): void {
    for (const bucket of this.pools.values()) {
      bucket.buffers.length = 0;
    }
    this.totalPooledBytes = 0;
  }

  getStats() {
    return {
      totalPooledMB: Number((this.totalPooledBytes / 1048576).toFixed(2)),
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: this.hitCount + this.missCount > 0
        ? Number((this.hitCount / (this.hitCount + this.missCount)).toFixed(3))
        : 0,
      buckets: Object.fromEntries(
        [...this.pools.entries()].map(([k, v]) => [k, v.buffers.length])
      ),
    };
  }

  private bucketKey(size: number): string {
    for (const spec of BUCKET_SPECS) {
      if (size <= spec.threshold) return spec.key;
    }
    return 'LARGE';
  }
}

export const bufferPool = new BufferPool();
