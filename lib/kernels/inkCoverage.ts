/**
 * calculateInkCoverage - Sampled ink density measurement.
 *
 * Production optimizations:
 *  - Accepts Uint8ClampedArray | Uint8Array | ArrayBuffer (zero-copy path)
 *  - Pre-computed byte step avoids multiplication in inner loop
 *  - Targets ~50K samples for statistical accuracy with minimal iteration
 */
export function calculateInkCoverage(data: Uint8ClampedArray | Uint8Array | ArrayBuffer): number {
  let arr: Uint8Array;
  if (data instanceof ArrayBuffer) {
    arr = new Uint8Array(data);
  } else {
    arr = data as Uint8Array;
  }

  const totalPixels = arr.length >> 2;
  if (totalPixels === 0) return 0;

  const step = Math.max(1, Math.floor(Math.sqrt(totalPixels / 50000)));
  const byteStep = step * 4;

  let nonWhite = 0;
  let sampled = 0;

  for (let i = 0; i < arr.length; i += byteStep) {
    const lum = 0.299 * arr[i] + 0.587 * arr[i + 1] + 0.114 * arr[i + 2];
    if (lum < 240) nonWhite++;
    sampled++;
  }

  return sampled > 0 ? Number(((nonWhite / sampled) * 100).toFixed(1)) : 0;
}
