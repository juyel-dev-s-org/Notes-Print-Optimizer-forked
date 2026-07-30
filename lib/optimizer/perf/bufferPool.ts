class BufferPool {
  private pools: Map<string, { buffer: Uint8Array; size: number }[]> = new Map();
  private maxPerPool = 8;

  acquire(size: number): Uint8Array {
    const key = this.bucketKey(size);
    const pool = this.pools.get(key);
    if (pool && pool.length > 0) return pool.pop()!.buffer;
    return new Uint8Array(size);
  }

  release(buf: Uint8Array): void {
    const key = this.bucketKey(buf.length);
    let pool = this.pools.get(key);
    if (!pool) { pool = []; this.pools.set(key, pool); }
    if (pool.length < this.maxPerPool) pool.push({ buffer: buf, size: buf.length });
  }

  private bucketKey(size: number): string {
    if (size <= 1024) return '1K';
    if (size <= 4096) return '4K';
    if (size <= 16384) return '16K';
    if (size <= 65536) return '64K';
    if (size <= 262144) return '256K';
    if (size <= 1048576) return '1M';
    return 'LARGE';
  }
}

export const bufferPool = new BufferPool();
