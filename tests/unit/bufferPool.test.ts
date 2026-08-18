/**
 * BufferPool contract tests.
 *
 * Regression: buckets are threshold-keyed, so a bucket may hold buffers
 * smaller than a later acquire() request for the same bucket. acquire() must
 * never return a buffer smaller than the requested size (a pooled 1.1MB
 * buffer served for a 1.7MB mask caused `RangeError: offset is out of
 * bounds` in applyMaskDilation on 1728x972 pages).
 */
import { describe, expect, it } from 'vitest';
import { BufferPool } from '../../lib/optimizer/perf/bufferPool';

describe('bufferPool contract', () => {
  it('acquire() never returns a buffer smaller than requested', () => {
    const pool = new BufferPool(4);
    /* Same '4M' bucket (threshold 4,194,304): release a small buffer first,
       then acquire a much larger one — must NOT receive the small buffer. */
    pool.release(new Uint8Array(1_100_000));
    pool.release(new Uint8Array(3_000_000));

    const a = pool.acquire(2_000_000);
    expect(a.byteLength).toBeGreaterThanOrEqual(2_000_000);
    expect(a.byteLength).toBe(3_000_000); /* largest released first (LIFO) */

    const b = pool.acquire(2_000_000);
    expect(b.byteLength).toBeGreaterThanOrEqual(2_000_000);
  });

  it('acquire() returns usable exact-size buffers on miss', () => {
    const pool = new BufferPool(1);
    const a = pool.acquire(123_456);
    expect(a.byteLength).toBe(123_456);
    a.set(new Uint8Array(123_456).fill(1), 0);
    expect(a[0]).toBe(1);
  });

  it('acquireRaw() never returns a buffer smaller than requested', () => {
    const pool = new BufferPool(4);
    pool.releaseRaw(new ArrayBuffer(900_000));
    const raw = pool.acquireRaw(1_600_000);
    expect(raw.byteLength).toBeGreaterThanOrEqual(1_600_000);
  });

  it('oversized pooled buffer is discarded, not served twice', () => {
    const pool = new BufferPool(4);
    pool.release(new Uint8Array(700_000));
    const a = pool.acquire(2_500_000); /* discards the 700KB buffer */
    expect(a.byteLength).toBe(2_500_000);
    /* the discarded buffer must not come back: next acquire of the same
       bucket should miss (no buffer left) and allocate exact size */
    const b = pool.acquire(2_500_000);
    expect(b.byteLength).toBe(2_500_000);
  });
});