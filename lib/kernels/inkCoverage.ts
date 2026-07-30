export function calculateInkCoverage(data: Uint8ClampedArray | Uint8Array): number {
  const tp = data.length / 4;
  let nw = 0; const st = Math.max(1, Math.floor(Math.sqrt(tp / 50000))); let sm = 0;
  for (let i = 0; i < data.length; i += 4 * st) {
    if (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] < 240) nw++; sm++; }
  return Number(((nw / sm) * 100).toFixed(1));
}
