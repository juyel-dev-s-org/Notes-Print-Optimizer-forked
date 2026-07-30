import { getLuminance } from './luminance';

export function detectBanners(data: Uint8ClampedArray, width: number, height: number) {
  let topRows = 0, bottomRows = 0;
  const rStep = 4, wStep = Math.max(1, Math.floor(width / 50));
  for (let y = 0; y < Math.floor(height * 0.25); y += rStep) {
    let first = -1, uniform = true;
    for (let x = 0; x < width; x += wStep) {
      const idx = (y * width + x) * 4;
      const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
      if (first === -1) first = lum; else if (Math.abs(lum - first) > 35) { uniform = false; break; }
    }
    if (uniform && first < 120) topRows = y + rStep; else if (y > 10) break;
  }
  for (let y = height - 1; y > Math.floor(height * 0.75); y -= rStep) {
    let first = -1, uniform = true;
    for (let x = 0; x < width; x += wStep) {
      const idx = (y * width + x) * 4;
      const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
      if (first === -1) first = lum; else if (Math.abs(lum - first) > 35) { uniform = false; break; }
    }
    if (uniform) bottomRows = height - y; else if (height - y > 10) break;
  }
  return { topBannerPct: topRows / height, bottomBannerPct: bottomRows / height };
}
