/**
 * High-Performance Image Processing Kernel
 * Optimized Uint8ClampedArray pixel loops, zero-copy buffer operations,
 * smart hue remapping for Physics Wallah notes, adaptive contrast,
 * unsharp mask, and banner cropping.
 */

import { PageProfile, PageClassification, ProcessingParameters } from './types';

export class ImageProcessingKernels {
  /**
   * Fast luminance calculation from RGB
   */
  public static getLuminance(r: number, g: number, b: number): number {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  /**
   * Analyze image statistics: brightness, contrast, ink density, dark ratio, banner regions
   */
  public static analyzeImageData(
    imageData: ImageData,
    pageIndex: number
  ): PageProfile {
    const { width, height, data } = imageData;
    const totalPixels = width * height;
    let sumLuminance = 0;
    let darkPixelCount = 0;
    let lightPixelCount = 0;

    // Subsampling for fast analysis on large high-res pages
    const step = Math.max(1, Math.floor(Math.sqrt(totalPixels / 100000)));
    let sampledCount = 0;

    const luminances: number[] = [];

    // Analyze whole image
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        sumLuminance += lum;
        luminances.push(lum);
        sampledCount++;

        if (lum < 60) darkPixelCount++;
        if (lum > 200) lightPixelCount++;
      }
    }

    const avgBrightness = sumLuminance / sampledCount;

    // Calculate variance / contrast
    let sumVariance = 0;
    for (let i = 0; i < luminances.length; i++) {
      const diff = luminances[i] - avgBrightness;
      sumVariance += diff * diff;
    }
    const contrast = Math.sqrt(sumVariance / sampledCount);

    const darkBackgroundRatio = darkPixelCount / sampledCount;
    const lightBackgroundRatio = lightPixelCount / sampledCount;

    // Detect top & bottom banner bands (PW notes usually have header/footer bars)
    const { topBannerPct, bottomBannerPct } = this.detectBanners(
      data,
      width,
      height
    );

    // Ink density: ratio of non-white pixels
    const inkDensity = 1 - lightBackgroundRatio;

    // Classify page
    let classification: PageClassification = 'LIGHT_SLIDE';
    if (darkBackgroundRatio > 0.45) {
      classification = 'DARK_SLIDE';
    } else if (contrast > 65) {
      classification = 'DIAGRAM_EQUATION';
    } else if (darkBackgroundRatio < 0.15 && lightBackgroundRatio > 0.65) {
      classification = 'LIGHT_SLIDE';
    } else if (inkDensity > 0.35) {
      classification = 'HANDWRITTEN_NOTES';
    } else {
      classification = 'MIXED';
    }

    return {
      pageIndex,
      width,
      height,
      averageBrightness: Math.round(avgBrightness),
      contrast: Math.round(contrast),
      inkDensity: Number(inkDensity.toFixed(3)),
      darkBackgroundRatio: Number(darkBackgroundRatio.toFixed(3)),
      lightBackgroundRatio: Number(lightBackgroundRatio.toFixed(3)),
      dominantHue: 0,
      hasTopBanner: topBannerPct > 0.03,
      topBannerHeightPct: Number(topBannerPct.toFixed(3)),
      hasBottomBanner: bottomBannerPct > 0.03,
      bottomBannerHeightPct: Number(bottomBannerPct.toFixed(3)),
      estimatedNoise: Math.round(Math.max(0, 100 - contrast)),
      strokeThickness: darkBackgroundRatio > 0.5 ? 2.5 : 1.8,
      classification,
    };
  }

  /**
   * Detect top and bottom solid banner height percentages
   */
  private static detectBanners(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): { topBannerPct: number; bottomBannerPct: number } {
    let topBannerRows = 0;
    let bottomBannerRows = 0;

    const rowCheckStep = 4;
    const sampleWidthStep = Math.max(1, Math.floor(width / 50));

    // Top banner scan
    for (let y = 0; y < Math.floor(height * 0.25); y += rowCheckStep) {
      let rowVar = 0;
      let firstPixelLum = -1;
      let isUniformRow = true;

      for (let x = 0; x < width; x += sampleWidthStep) {
        const idx = (y * width + x) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (firstPixelLum === -1) {
          firstPixelLum = lum;
        } else if (Math.abs(lum - firstPixelLum) > 35) {
          isUniformRow = false;
          break;
        }
      }

      if (isUniformRow && firstPixelLum < 120) {
        topBannerRows = y + rowCheckStep;
      } else if (y > 10) {
        break;
      }
    }

    // Bottom banner scan
    for (let y = height - 1; y > Math.floor(height * 0.75); y -= rowCheckStep) {
      let firstPixelLum = -1;
      let isUniformRow = true;

      for (let x = 0; x < width; x += sampleWidthStep) {
        const idx = (y * width + x) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (firstPixelLum === -1) {
          firstPixelLum = lum;
        } else if (Math.abs(lum - firstPixelLum) > 35) {
          isUniformRow = false;
          break;
        }
      }

      if (isUniformRow) {
        bottomBannerRows = height - y;
      } else if (height - y > 10) {
        break;
      }
    }

    return {
      topBannerPct: topBannerRows / height,
      bottomBannerPct: bottomBannerRows / height,
    };
  }

  /**
   * Convert RGB to HSV (H: 0-179, S: 0-255, V: 0-255) to match OpenCV
   */
  private static rgbToHsv(r: number, g: number, b: number): [number, number, number] {
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    const vNorm = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    const delta = vNorm - min;

    let hNorm = 0;
    if (delta === 0) {
      hNorm = 0;
    } else if (vNorm === rNorm) {
      hNorm = 60 * (((gNorm - bNorm) / delta) % 6);
    } else if (vNorm === gNorm) {
      hNorm = 60 * (((bNorm - rNorm) / delta) + 2);
    } else if (vNorm === bNorm) {
      hNorm = 60 * (((rNorm - gNorm) / delta) + 4);
    }

    if (hNorm < 0) hNorm += 360;

    const sNorm = vNorm === 0 ? 0 : delta / vNorm;

    return [
      Math.round(hNorm / 2),
      Math.round(sNorm * 255),
      Math.round(vNorm * 255),
    ];
  }

  /**
   * Apply Morphological Dilation (Stroke Enhancement)
   */
  private static stripDecorativeFills(mask: Uint8Array, width: number, height: number): void {
    const totalPixels = width * height;
    const labels = new Int32Array(totalPixels);
    let currentLabel = 1;

    const statsMinX: number[] = [0];
    const statsMinY: number[] = [0];
    const statsMaxX: number[] = [0];
    const statsMaxY: number[] = [0];
    const statsArea: number[] = [0];

    const queue = new Int32Array(totalPixels);
    let head = 0;
    let tail = 0;

    for (let i = 0; i < totalPixels; i++) {
      if (mask[i] === 1 && labels[i] === 0) {
        const label = currentLabel++;
        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;
        let area = 0;

        queue[tail++] = i;
        labels[i] = label;

        while (head < tail) {
          const curr = queue[head++];
          const cx = curr % width;
          const cy = Math.floor(curr / width);

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;
          area++;

          // 8-way connectivity
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = cx + dx;
              const ny = cy + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nIdx = ny * width + nx;
                if (mask[nIdx] === 1 && labels[nIdx] === 0) {
                  labels[nIdx] = label;
                  queue[tail++] = nIdx;
                }
              }
            }
          }
        }

        statsMinX.push(minX);
        statsMinY.push(minY);
        statsMaxX.push(maxX);
        statsMaxY.push(maxY);
        statsArea.push(area);
      }
    }

    const dropLabels = new Uint8Array(currentLabel);

    for (let label = 1; label < currentLabel; label++) {
      const compWidth = statsMaxX[label] - statsMinX[label] + 1;
      const compHeight = statsMaxY[label] - statsMinY[label] + 1;
      
      const aspect = compWidth / Math.max(compHeight, 1);
      const widthFrac = compWidth / width;
      const yFrac = statsMinY[label] / height;
      
      if (statsArea[label] >= 200 && aspect > 2.2 && widthFrac > 0.20 && yFrac < 0.15) {
         const isSolid = statsArea[label] > (compWidth * compHeight * 0.3);
         if (isSolid) {
            dropLabels[label] = 1;
         }
      }
    }

    for (let i = 0; i < totalPixels; i++) {
       const label = labels[i];
       if (label > 0 && dropLabels[label] === 1) {
          mask[i] = 0;
       }
    }
  }

  private static removeNoise(mask: Uint8Array, width: number, height: number): void {
    const totalPixels = width * height;
    const labels = new Int32Array(totalPixels);
    let currentLabel = 1;
    const statsArea: number[] = [0];

    const queue = new Int32Array(totalPixels);
    let head = 0;
    let tail = 0;

    for (let i = 0; i < totalPixels; i++) {
      if (mask[i] === 1 && labels[i] === 0) {
        const label = currentLabel++;
        let area = 0;

        queue[tail++] = i;
        labels[i] = label;

        while (head < tail) {
          const curr = queue[head++];
          const cx = curr % width;
          const cy = Math.floor(curr / width);
          area++;

          // 8-way connectivity
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = cx + dx;
              const ny = cy + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nIdx = ny * width + nx;
                if (mask[nIdx] === 1 && labels[nIdx] === 0) {
                  labels[nIdx] = label;
                  queue[tail++] = nIdx;
                }
              }
            }
          }
        }
        statsArea.push(area);
      }
    }

    const minArea = Math.max(6, Math.floor((width * height) / 600000));
    for (let i = 0; i < totalPixels; i++) {
       const label = labels[i];
       if (label > 0 && statsArea[label] < minArea) {
          mask[i] = 0;
       }
    }
  }

  private static applyMaskDilation(mask: Uint8Array, width: number, height: number, kernelSize: number): void {
    const copy = new Uint8Array(mask);
    const offset = Math.floor(kernelSize / 2);

    let kernel: number[][] = [];
    if (kernelSize === 3) {
      kernel = [
        [0, 1, 0],
        [1, 1, 1],
        [0, 1, 0]
      ];
    } else if (kernelSize === 5) {
      kernel = [
        [0, 0, 1, 0, 0],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [0, 0, 1, 0, 0]
      ];
    } else {
      kernel = Array(kernelSize).fill(0).map(() => Array(kernelSize).fill(1));
    }

    for (let y = offset; y < height - offset; y++) {
      for (let x = offset; x < width - offset; x++) {
        if (copy[y * width + x] === 1) {
          for (let ky = -offset; ky <= offset; ky++) {
            for (let kx = -offset; kx <= offset; kx++) {
              if (kernel[ky + offset][kx + offset] === 1) {
                mask[(y + ky) * width + (x + kx)] = 1;
              }
            }
          }
        }
      }
    }
  }

  /**
   * Process Image Data: Crop, Invert, Smart Hue Map, Whitening, Contrast & Sharpening
   * Directly ports the PW Notes Colab Python algorithm for pure printout readiness.
   */
  public static processImage(
    srcImageData: ImageData,
    params: ProcessingParameters,
    profile: PageProfile
  ): ImageData {
    const srcWidth = srcImageData.width;
    const srcHeight = srcImageData.height;

    // 1. Calculate Crop Box
    const cropTopPx = Math.floor(srcHeight * (params.bannerCropTopPct / 100));
    const cropBottomPx = Math.floor(srcHeight * (params.bannerCropBottomPct / 100));

    const dstWidth = srcWidth;
    const dstHeight = Math.max(10, srcHeight - cropTopPx - cropBottomPx);

    const dstData = new Uint8ClampedArray(dstWidth * dstHeight * 4);
    const srcData = srcImageData.data;

    const convertColors = params.invertMode === 'smart';
    const isDarkSlide = profile.classification === 'DARK_SLIDE' || profile.darkBackgroundRatio > 0.4;
    const shouldProcess = params.invertMode !== 'none' || isDarkSlide;

    if (!shouldProcess) {
      // Just copy cropped area if no processing needed
      for (let y = 0; y < dstHeight; y++) {
        const srcY = y + cropTopPx;
        for (let x = 0; x < dstWidth; x++) {
          const srcIdx = (srcY * srcWidth + x) * 4;
          const dstIdx = (y * dstWidth + x) * 4;
          dstData[dstIdx] = srcData[srcIdx];
          dstData[dstIdx+1] = srcData[srcIdx+1];
          dstData[dstIdx+2] = srcData[srcIdx+2];
          dstData[dstIdx+3] = 255;
        }
      }
      return new ImageData(dstData, dstWidth, dstHeight);
    }

    const totalPixels = dstWidth * dstHeight;
    const finalMask = new Uint8Array(totalPixels);
    const tempMask = new Uint8Array(totalPixels);

    const evaluateColor = (condition: (h: number, s: number, v: number) => boolean) => {
      tempMask.fill(0);
      let anyFound = false;
      for (let y = 0; y < dstHeight; y++) {
        const srcY = y + cropTopPx;
        for (let x = 0; x < dstWidth; x++) {
          const srcIdx = (srcY * srcWidth + x) * 4;
          const r = srcData[srcIdx];
          const g = srcData[srcIdx + 1];
          const b = srcData[srcIdx + 2];
          const [h, s, v] = this.rgbToHsv(r, g, b);
          const isBgMask = v < 70;
          if (!isBgMask && condition(h, s, v)) {
            tempMask[y * dstWidth + x] = 1;
            anyFound = true;
          }
        }
      }
      if (anyFound) {
        this.stripDecorativeFills(tempMask, dstWidth, dstHeight);
        for (let i = 0; i < totalPixels; i++) {
          if (tempMask[i] === 1) finalMask[i] = 1;
        }
      }
    };

    if (convertColors) {
        evaluateColor((h, s, v) => s < 55 && v > 155); // White
        evaluateColor((h, s, v) => h >= 15 && h <= 35 && s > 80 && v > 100); // Yellow
        evaluateColor((h, s, v) => h >= 36 && h <= 85 && s > 55 && v > 75); // Green
        evaluateColor((h, s, v) => h >= 86 && h <= 105 && s > 55 && v > 75); // Cyan
        evaluateColor((h, s, v) => h >= 106 && h <= 135 && s > 55 && v > 65); // Blue
        evaluateColor((h, s, v) => h >= 136 && h <= 175 && s > 55 && v > 75); // Pink/Magenta
        evaluateColor((h, s, v) => (h >= 0 && h <= 15 && s > 75 && v > 95) || (h >= 175 && s > 75 && v > 95)); // Red
    } else {
        evaluateColor((h, s, v) => v >= 70); // Everything not dark
    }

    // 5. Stroke Enhancement
    if (params.strokeEnhancement !== 'none') {
      const kSize = params.strokeEnhancement === 'strong' ? 5 : 3;
      this.applyMaskDilation(finalMask, dstWidth, dstHeight, kSize);
    }

    // 6. Noise Removal
    this.removeNoise(finalMask, dstWidth, dstHeight);

    // Apply Mask to Image
    for (let i = 0; i < totalPixels; i++) {
        const dstIdx = i * 4;
        if (finalMask[i] === 1) {
            dstData[dstIdx] = 0;
            dstData[dstIdx + 1] = 0;
            dstData[dstIdx + 2] = 0;
            dstData[dstIdx + 3] = 255;
        } else {
            dstData[dstIdx] = 255;
            dstData[dstIdx + 1] = 255;
            dstData[dstIdx + 2] = 255;
            dstData[dstIdx + 3] = 255;
        }
    }

    // 7. Selective Sharpening
    if (params.sharpenAmount > 0) {
      this.applyUnsharpMask(dstData, dstWidth, dstHeight, params.sharpenAmount / 100);
    }

    return new ImageData(dstData, dstWidth, dstHeight);
  }

  /**
   * Fast Unsharp Mask Kernel (Laplacian Convolution)
   */
  private static applyUnsharpMask(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    amount: number
  ): void {
    const copy = new Uint8ClampedArray(data);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;

        for (let c = 0; c < 3; c++) {
          const center = copy[idx + c];
          const top = copy[((y - 1) * width + x) * 4 + c];
          const bottom = copy[((y + 1) * width + x) * 4 + c];
          const left = copy[(y * width + (x - 1)) * 4 + c];
          const right = copy[(y * width + (x + 1)) * 4 + c];

          const laplacian = 4 * center - top - bottom - left - right;
          const enhanced = center + amount * laplacian;

          data[idx + c] = Math.min(255, Math.max(0, Math.round(enhanced)));
        }
      }
    }
  }

  /**
   * Calculate Ink Coverage Percentage (for Ink Savings Calculator)
   */
  public static calculateInkCoverage(imageData: ImageData): number {
    const { width, height, data } = imageData;
    const totalPixels = width * height;
    let nonWhitePixels = 0;

    const step = Math.max(1, Math.floor(Math.sqrt(totalPixels / 50000)));
    let sampled = 0;

    for (let i = 0; i < data.length; i += 4 * step) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // If luminance is less than 240, treat as ink
      if (lum < 240) {
        nonWhitePixels++;
      }
      sampled++;
    }

    return Number(((nonWhitePixels / sampled) * 100).toFixed(1));
  }
}
