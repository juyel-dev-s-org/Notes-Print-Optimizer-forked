/**
 * Web Worker Engine & Task Queue Manager
 * Offloads heavy pixel kernel math (smart hue remapping, binarization, dilation, unsharp mask)
 * off the main UI thread into Web Workers for zero-jank 60FPS UI performance.
 */

import { PageProfile, ProcessingParameters } from './types';
import { ImageProcessingKernels } from './wasmEngine';
import { memoryManager } from './memoryManager';

interface WorkerProcessTask {
  pageIndex: number;
  imageData: ImageData;
  params: ProcessingParameters;
  profile: PageProfile;
}

interface WorkerProcessResult {
  pageIndex: number;
  optimizedImageData: ImageData;
  inkCoverageBeforePct: number;
  inkCoverageAfterPct: number;
}

class WorkerPool {
  private workerBlobUrl: string | null = null;

  /**
   * Inline Web Worker code containing identical pixel processing kernels
   */
  private getWorkerScript(): string {
    return `
      function getLuminance(r, g, b) {
        return 0.299 * r + 0.587 * g + 0.114 * b;
      }

      // HSV Conversion
      function rgbToHsv(r, g, b) {
        var rNorm = r / 255;
        var gNorm = g / 255;
        var bNorm = b / 255;
        var vNorm = Math.max(rNorm, gNorm, bNorm);
        var min = Math.min(rNorm, gNorm, bNorm);
        var delta = vNorm - min;
        var hNorm = 0;
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
        var sNorm = vNorm === 0 ? 0 : delta / vNorm;
        return [Math.round(hNorm / 2), Math.round(sNorm * 255), Math.round(vNorm * 255)];
      }

      function stripDecorativeFills(mask, width, height) {
        var totalPixels = width * height;
        var labels = new Int32Array(totalPixels);
        var currentLabel = 1;
        var statsMinX = [0], statsMinY = [0], statsMaxX = [0], statsMaxY = [0], statsArea = [0];
        var queue = new Int32Array(totalPixels);
        var head = 0, tail = 0;

        for (var i = 0; i < totalPixels; i++) {
          if (mask[i] === 1 && labels[i] === 0) {
            var label = currentLabel++;
            var minX = width, minY = height, maxX = -1, maxY = -1, area = 0;
            queue[tail++] = i;
            labels[i] = label;

            while (head < tail) {
              var curr = queue[head++];
              var cx = curr % width;
              var cy = Math.floor(curr / width);
              if (cx < minX) minX = cx;
              if (cx > maxX) maxX = cx;
              if (cy < minY) minY = cy;
              if (cy > maxY) maxY = cy;
              area++;

              for (var dy = -1; dy <= 1; dy++) {
                for (var dx = -1; dx <= 1; dx++) {
                  if (dx === 0 && dy === 0) continue;
                  var nx = cx + dx, ny = cy + dy;
                  if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    var nIdx = ny * width + nx;
                    if (mask[nIdx] === 1 && labels[nIdx] === 0) {
                      labels[nIdx] = label;
                      queue[tail++] = nIdx;
                    }
                  }
                }
              }
            }
            statsMinX.push(minX); statsMinY.push(minY);
            statsMaxX.push(maxX); statsMaxY.push(maxY);
            statsArea.push(area);
          }
        }

        var dropLabels = new Uint8Array(currentLabel);
        for (var label = 1; label < currentLabel; label++) {
          var compWidth = statsMaxX[label] - statsMinX[label] + 1;
          var compHeight = statsMaxY[label] - statsMinY[label] + 1;
          var aspect = compWidth / Math.max(compHeight, 1);
          var widthFrac = compWidth / width;
          var yFrac = statsMinY[label] / height;

          if (statsArea[label] >= 200 && aspect > 2.2 && widthFrac > 0.20 && yFrac < 0.15) {
            if (statsArea[label] > (compWidth * compHeight * 0.3)) {
              dropLabels[label] = 1;
            }
          }
        }

        for (var i = 0; i < totalPixels; i++) {
          var lbl = labels[i];
          if (lbl > 0 && dropLabels[lbl] === 1) mask[i] = 0;
        }
      }

      function removeNoise(mask, width, height) {
        var totalPixels = width * height;
        var labels = new Int32Array(totalPixels);
        var currentLabel = 1;
        var statsArea = [0];
        var queue = new Int32Array(totalPixels);
        var head = 0, tail = 0;

        for (var i = 0; i < totalPixels; i++) {
          if (mask[i] === 1 && labels[i] === 0) {
            var label = currentLabel++;
            var area = 0;
            queue[tail++] = i;
            labels[i] = label;

            while (head < tail) {
              var curr = queue[head++];
              var cx = curr % width;
              var cy = Math.floor(curr / width);
              area++;

              for (var dy = -1; dy <= 1; dy++) {
                for (var dx = -1; dx <= 1; dx++) {
                  if (dx === 0 && dy === 0) continue;
                  var nx = cx + dx, ny = cy + dy;
                  if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    var nIdx = ny * width + nx;
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

        var minArea = Math.max(6, Math.floor((width * height) / 600000));
        for (var i = 0; i < totalPixels; i++) {
          var lbl = labels[i];
          if (lbl > 0 && statsArea[lbl] < minArea) mask[i] = 0;
        }
      }

      function applyMaskDilation(mask, width, height, kernelSize) {
        var copy = new Uint8Array(mask);
        var offset = Math.floor(kernelSize / 2);
        var kernel = [];
        if (kernelSize === 3) {
          kernel = [[0, 1, 0], [1, 1, 1], [0, 1, 0]];
        } else if (kernelSize === 5) {
          kernel = [[0, 0, 1, 0, 0], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [0, 0, 1, 0, 0]];
        } else {
          for (var r = 0; r < kernelSize; r++) {
            var row = [];
            for (var c = 0; c < kernelSize; c++) row.push(1);
            kernel.push(row);
          }
        }

        for (var y = offset; y < height - offset; y++) {
          for (var x = offset; x < width - offset; x++) {
            if (copy[y * width + x] === 1) {
              for (var ky = -offset; ky <= offset; ky++) {
                for (var kx = -offset; kx <= offset; kx++) {
                  if (kernel[ky + offset][kx + offset] === 1) {
                    mask[(y + ky) * width + (x + kx)] = 1;
                  }
                }
              }
            }
          }
        }
      }

      function applyUnsharpMask(data, width, height, amount) {
        var copy = new Uint8ClampedArray(data);
        for (var y = 1; y < height - 1; y++) {
          for (var x = 1; x < width - 1; x++) {
            var idx = (y * width + x) * 4;
            for (var c = 0; c < 3; c++) {
              var center = copy[idx + c];
              var top = copy[((y - 1) * width + x) * 4 + c];
              var bottom = copy[((y + 1) * width + x) * 4 + c];
              var left = copy[(y * width + (x - 1)) * 4 + c];
              var right = copy[(y * width + (x + 1)) * 4 + c];

              var laplacian = 4 * center - top - bottom - left - right;
              var enhanced = center + amount * laplacian;
              data[idx + c] = Math.min(255, Math.max(0, Math.round(enhanced)));
            }
          }
        }
      }

      function calculateInkCoverage(data) {
        var totalPixels = data.length / 4;
        var nonWhitePixels = 0;
        var step = Math.max(1, Math.floor(Math.sqrt(totalPixels / 50000)));
        var sampled = 0;
        for (var i = 0; i < data.length; i += 4 * step) {
          var r = data[i], g = data[i + 1], b = data[i + 2];
          var lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum < 240) nonWhitePixels++;
          sampled++;
        }
        return Number(((nonWhitePixels / sampled) * 100).toFixed(1));
      }

      self.onmessage = function (e) {
        var msg = e.data;
        if (msg.type === 'PROCESS_PAGE') {
          var pageIndex = msg.pageIndex;
          var srcWidth = msg.width;
          var srcHeight = msg.height;
          var srcData = new Uint8ClampedArray(msg.buffer);
          var params = msg.params;
          var profile = msg.profile;

          var inkBefore = calculateInkCoverage(srcData);

          var cropTopPx = Math.floor(srcHeight * (params.bannerCropTopPct / 100));
          var cropBottomPx = Math.floor(srcHeight * (params.bannerCropBottomPct / 100));

          var dstWidth = srcWidth;
          var dstHeight = Math.max(10, srcHeight - cropTopPx - cropBottomPx);

          var dstData = new Uint8ClampedArray(dstWidth * dstHeight * 4);

          var convertColors = params.invertMode === 'smart';
          var isDarkSlide = profile.classification === 'DARK_SLIDE' || profile.darkBackgroundRatio > 0.4;
          var shouldProcess = params.invertMode !== 'none' || isDarkSlide;

          if (!shouldProcess) {
            for (var y = 0; y < dstHeight; y++) {
              var srcY = y + cropTopPx;
              for (var x = 0; x < dstWidth; x++) {
                var srcIdx = (srcY * srcWidth + x) * 4;
                var dstIdx = (y * dstWidth + x) * 4;
                dstData[dstIdx] = srcData[srcIdx];
                dstData[dstIdx + 1] = srcData[srcIdx + 1];
                dstData[dstIdx + 2] = srcData[srcIdx + 2];
                dstData[dstIdx + 3] = 255;
              }
            }
          } else {
            var totalPixels = dstWidth * dstHeight;
            var finalMask = new Uint8Array(totalPixels);
            var tempMask = new Uint8Array(totalPixels);

            function evaluateColor(condition) {
              tempMask.fill(0);
              var anyFound = false;
              for (var y = 0; y < dstHeight; y++) {
                var srcY = y + cropTopPx;
                for (var x = 0; x < dstWidth; x++) {
                  var srcIdx = (srcY * srcWidth + x) * 4;
                  var r = srcData[srcIdx];
                  var g = srcData[srcIdx + 1];
                  var b = srcData[srcIdx + 2];
                  var hsv = rgbToHsv(r, g, b);
                  var isBgMask = hsv[2] < 70;
                  if (!isBgMask && condition(hsv[0], hsv[1], hsv[2])) {
                    tempMask[y * dstWidth + x] = 1;
                    anyFound = true;
                  }
                }
              }
              if (anyFound) {
                stripDecorativeFills(tempMask, dstWidth, dstHeight);
                for (var i = 0; i < totalPixels; i++) {
                  if (tempMask[i] === 1) finalMask[i] = 1;
                }
              }
            }

            if (convertColors) {
              evaluateColor(function(h, s, v) { return s < 55 && v > 155; });
              evaluateColor(function(h, s, v) { return h >= 15 && h <= 35 && s > 80 && v > 100; });
              evaluateColor(function(h, s, v) { return h >= 36 && h <= 85 && s > 55 && v > 75; });
              evaluateColor(function(h, s, v) { return h >= 86 && h <= 105 && s > 55 && v > 75; });
              evaluateColor(function(h, s, v) { return h >= 106 && h <= 135 && s > 55 && v > 65; });
              evaluateColor(function(h, s, v) { return h >= 136 && h <= 175 && s > 55 && v > 75; });
              evaluateColor(function(h, s, v) { return (h >= 0 && h <= 15 && s > 75 && v > 95) || (h >= 175 && s > 75 && v > 95); });
            } else {
              evaluateColor(function(h, s, v) { return v >= 70; });
            }

            if (params.strokeEnhancement !== 'none') {
              var kSize = params.strokeEnhancement === 'strong' ? 5 : 3;
              applyMaskDilation(finalMask, dstWidth, dstHeight, kSize);
            }

            removeNoise(finalMask, dstWidth, dstHeight);

            for (var i = 0; i < totalPixels; i++) {
              var dstIdx = i * 4;
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

            if (params.sharpenAmount > 0) {
              applyUnsharpMask(dstData, dstWidth, dstHeight, params.sharpenAmount / 100);
            }
          }

          var inkAfter = calculateInkCoverage(dstData);

          self.postMessage(
            {
              type: 'PAGE_PROCESSED',
              pageIndex: pageIndex,
              width: dstWidth,
              height: dstHeight,
              buffer: dstData.buffer,
              inkCoverageBeforePct: inkBefore,
              inkCoverageAfterPct: inkAfter,
            },
            [dstData.buffer]
          );
        }
      };
    `;
  }

  private getWorkerBlobUrl(): string {
    if (!this.workerBlobUrl) {
      const blob = new Blob([this.getWorkerScript()], { type: 'application/javascript' });
      this.workerBlobUrl = URL.createObjectURL(blob);
    }
    return this.workerBlobUrl;
  }

  /**
   * Process a single page image via Web Worker off the main thread
   */
  public async processPageInWorker(
    pageIndex: number,
    imageData: ImageData,
    params: ProcessingParameters,
    profile: PageProfile
  ): Promise<WorkerProcessResult> {
    if (typeof window === 'undefined' || !window.Worker) {
      // Fallback if workers unavailable
      const inkBefore = ImageProcessingKernels.calculateInkCoverage(imageData);
      const optImageData = ImageProcessingKernels.processImage(imageData, params, profile);
      const inkAfter = ImageProcessingKernels.calculateInkCoverage(optImageData);
      return { pageIndex, optimizedImageData: optImageData, inkCoverageBeforePct: inkBefore, inkCoverageAfterPct: inkAfter };
    }

    return new Promise((resolve, reject) => {
      try {
        const workerUrl = this.getWorkerBlobUrl();
        const worker = new Worker(workerUrl);

        const buffer = imageData.data.buffer.slice(0);

        worker.onmessage = (e: MessageEvent) => {
          const msg = e.data;
          if (msg.type === 'PAGE_PROCESSED') {
            const dstArray = new Uint8ClampedArray(msg.buffer);
            const optImageData = new ImageData(dstArray, msg.width, msg.height);
            worker.terminate();
            resolve({
              pageIndex: msg.pageIndex,
              optimizedImageData: optImageData,
              inkCoverageBeforePct: msg.inkCoverageBeforePct,
              inkCoverageAfterPct: msg.inkCoverageAfterPct,
            });
          }
        };

        worker.onerror = (err) => {
          worker.terminate();
          // Fallback to main thread
          const inkBefore = ImageProcessingKernels.calculateInkCoverage(imageData);
          const optImageData = ImageProcessingKernels.processImage(imageData, params, profile);
          const inkAfter = ImageProcessingKernels.calculateInkCoverage(optImageData);
          resolve({ pageIndex, optimizedImageData: optImageData, inkCoverageBeforePct: inkBefore, inkCoverageAfterPct: inkAfter });
        };

        worker.postMessage(
          {
            type: 'PROCESS_PAGE',
            pageIndex,
            width: imageData.width,
            height: imageData.height,
            buffer,
            params,
            profile,
          },
          [buffer]
        );
      } catch (e) {
        // Fallback to main thread
        const inkBefore = ImageProcessingKernels.calculateInkCoverage(imageData);
        const optImageData = ImageProcessingKernels.processImage(imageData, params, profile);
        const inkAfter = ImageProcessingKernels.calculateInkCoverage(optImageData);
        resolve({ pageIndex, optimizedImageData: optImageData, inkCoverageBeforePct: inkBefore, inkCoverageAfterPct: inkAfter });
      }
    });
  }
}

export const workerPool = new WorkerPool();
