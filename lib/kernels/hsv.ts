export function rgbToHsv(r: number, g: number, b: number, out: [number, number, number]): void {
  const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
  const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) * 60 / delta + 360) % 360;
    else if (max === g) h = (b - r) * 60 / delta + 120;
    else h = (r - g) * 60 / delta + 240;
    if (h < 0) h += 360;
  }
  out[0] = (h * 0.5 + 0.5) | 0;
  out[1] = max === 0 ? 0 : (delta * 255 / max + 0.5) | 0;
  out[2] = max;
}

/** Fast min-channel check for white pixel detection (avoids full HSV) */
export function fastMinChannel(r: number, g: number, b: number): number {
  return r < g ? (r < b ? r : b) : (g < b ? g : b);
}
