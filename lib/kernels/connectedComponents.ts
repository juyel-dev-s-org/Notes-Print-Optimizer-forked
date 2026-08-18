/**
 * Connected Components - Pre-allocated BFS buffers.
 *
 * Production optimizations:
 *  - Added shrink() to release oversized buffers under memory pressure
 *  - Buffers grow monotonically but can be explicitly shrunk
 *  - Prevents permanent memory retention after processing large pages
 */
let ccLabels: Int32Array | null = null;
let ccQueue: Int32Array | null = null;
let ccMinX: Int32Array | null = null;
let ccMinY: Int32Array | null = null;
let ccMaxX: Int32Array | null = null;
let ccMaxY: Int32Array | null = null;
let ccArea: Int32Array | null = null;
let ccDrop: Uint8Array | null = null;
let ccCapacity = 0;

export function ensureCC(size: number): void {
  if (ccCapacity < size) {
    ccLabels = new Int32Array(size);
    ccQueue = new Int32Array(size);
    ccMinX = new Int32Array(size);
    ccMinY = new Int32Array(size);
    ccMaxX = new Int32Array(size);
    ccMaxY = new Int32Array(size);
    ccArea = new Int32Array(size);
    ccDrop = new Uint8Array(size);
    ccCapacity = size;
  } else {
    ccLabels!.fill(0, 0, size);
  }
}

export function getCCLabels(): Int32Array { return ccLabels!; }
export function getCCQueue(): Int32Array { return ccQueue!; }
export function getCCMinX(): Int32Array { return ccMinX!; }
export function getCCMinY(): Int32Array { return ccMinY!; }
export function getCCMaxX(): Int32Array { return ccMaxX!; }
export function getCCMaxY(): Int32Array { return ccMaxY!; }
export function getCCArea(): Int32Array { return ccArea!; }
export function getCCDrop(): Uint8Array { return ccDrop!; }

/** Shrink CC buffers if they exceed threshold (call under memory pressure). */
export function shrinkCC(maxCapacity = 1048576): void {
  if (ccCapacity > maxCapacity) {
    ccLabels = new Int32Array(maxCapacity);
    ccQueue = new Int32Array(maxCapacity);
    ccMinX = new Int32Array(maxCapacity);
    ccMinY = new Int32Array(maxCapacity);
    ccMaxX = new Int32Array(maxCapacity);
    ccMaxY = new Int32Array(maxCapacity);
    ccArea = new Int32Array(maxCapacity);
    ccDrop = new Uint8Array(maxCapacity);
    ccCapacity = maxCapacity;
  }
}

/** Release CC buffers entirely (for disposal). */
export function releaseCC(): void {
  ccLabels = null;
  ccQueue = null;
  ccMinX = null;
  ccMinY = null;
  ccMaxX = null;
  ccMaxY = null;
  ccArea = null;
  ccDrop = null;
  ccCapacity = 0;
}

