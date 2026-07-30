let ccLabels: Int32Array | null = null;
let ccQueue: Int32Array | null = null;
let ccCapacity = 0;

export function ensureCC(size: number): void {
  if (ccCapacity < size) {
    ccLabels = new Int32Array(size);
    ccQueue = new Int32Array(size);
    ccCapacity = size;
  } else {
    ccLabels!.fill(0, 0, size);
  }
}

export function getCCLabels(): Int32Array {
  return ccLabels!;
}

export function getCCQueue(): Int32Array {
  return ccQueue!;
}
