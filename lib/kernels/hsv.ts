export function rgbToHsv(r: number, g: number, b: number, out: [number, number, number]): void {
  const rN = r * 0.00392156862745098, gN = g * 0.00392156862745098, bN = b * 0.00392156862745098;
  const vN = rN > gN ? (rN > bN ? rN : bN) : (gN > bN ? gN : bN);
  const mn = rN < gN ? (rN < bN ? rN : bN) : (gN < bN ? gN : bN);
  const delta = vN - mn;
  let hN = 0;
  if (delta !== 0) {
    if (vN === rN) hN = 60 * (((gN - bN) / delta) % 6);
    else if (vN === gN) hN = 60 * ((bN - rN) / delta + 2);
    else hN = 60 * ((rN - gN) / delta + 4);
    if (hN < 0) hN += 360;
  }
  out[0] = (hN * 0.5 + 0.5) | 0;
  out[1] = (vN === 0 ? 0 : (delta / vN) * 255 + 0.5) | 0;
  out[2] = (vN * 255 + 0.5) | 0;
}
