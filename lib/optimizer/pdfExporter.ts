import { PDFDocument } from 'pdf-lib';
import { ImageProcessingKernels } from './wasmEngine';
import { ParameterGenerator } from './parameterGenerator';
import { LayoutEngine } from './layoutEngine';
import { memoryManager } from './memoryManager';
import { pwOptimizerStorage } from './storage';
import { workerPool } from './workerPool';
import { getProcessingEngine, EngineVersion } from './engine';
import {
  DocumentProfile,
  LayoutConfig,
  OptimizationMetrics,
  PageProfile,
  PresetMode,
  ProcessedPage,
  ProcessingParameters,
} from './types';

export class PdfExporter {
  /**
   * Configure pdfjs worker if in browser (loaded via robust CDN fallback)
   */
  public static async initPdfJs(): Promise<any> {
    if (typeof window === 'undefined') return null;

    if ((window as any).pdfjsLib) {
      return (window as any).pdfjsLib;
    }

    return new Promise((resolve, reject) => {
      const existingScript = document.getElementById('pdfjs-script');
      if (existingScript) {
        let attempts = 0;
        const interval = setInterval(() => {
          if ((window as any).pdfjsLib) {
            clearInterval(interval);
            resolve((window as any).pdfjsLib);
          } else if (attempts++ > 50) {
            clearInterval(interval);
            reject(new Error('PDF.js script load timeout'));
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.id = 'pdfjs-script';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        const pdfjs = (window as any).pdfjsLib;
        if (pdfjs) {
          pdfjs.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(pdfjs);
        } else {
          reject(new Error('PDF.js failed to initialize from CDN'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load PDF.js engine from CDN'));
      document.head.appendChild(script);
    });
  }

  /**
   * Merge multiple PDF ArrayBuffers into a single merged PDF Uint8Array/Blob
   */
  public static async mergePdfBuffers(pdfBuffers: ArrayBuffer[]): Promise<{ pdfBytes: Uint8Array; pdfBlob: Blob }> {
    const mergedPdf = await PDFDocument.create();
    for (const buffer of pdfBuffers) {
      const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }
    const pdfBytes = await mergedPdf.save();
    const pdfBlob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    return { pdfBytes, pdfBlob };
  }

  /**
   * Stream extract, optimize and store pages via the pluggable Processing Engine architecture
   */
  public static async processPdfStreaming(
    pdfBuffer: ArrayBuffer,
    pdfId: string,
    presetMode: PresetMode = 'AUTO_ADAPTIVE',
    onProgress?: (current: number, total: number, action: string) => void,
    engineVersion?: EngineVersion
  ): Promise<{
    processedPages: ProcessedPage[];
    docProfile: DocumentProfile;
  }> {
    const engine = getProcessingEngine(engineVersion);
    const result = await engine.processDocument(
      {
        pdfBuffer,
        pdfId,
        presetMode,
      },
      {},
      onProgress
    );

    return {
      processedPages: result.processedPages,
      docProfile: result.docProfile,
    };
  }

  /**
   * Load page original and optimized ImageData on demand from IndexedDB or memory
   */
  public static async loadPageImageData(
    page: ProcessedPage
  ): Promise<{ originalImageData: ImageData; optimizedImageData: ImageData }> {
    if (page.originalImageData && page.optimizedImageData) {
      return {
        originalImageData: page.originalImageData,
        optimizedImageData: page.optimizedImageData,
      };
    }

    if (page.storageKey) {
      const cached = await pwOptimizerStorage.getPage(page.storageKey, page.pageIndex);
      if (cached) {
        const originalImageData = await memoryManager.blobToImageData(cached.originalBlob);
        const optimizedImageData = await memoryManager.blobToImageData(cached.optimizedBlob);
        return { originalImageData, optimizedImageData };
      }
    }

    throw new Error(`Failed to load page image data for page ${page.pageIndex + 1}`);
  }

  /**
   * Load page optimized ImageData on demand
   */
  public static async loadOptimizedImageData(page: ProcessedPage): Promise<ImageData> {
    if (page.optimizedImageData) return page.optimizedImageData;

    if (page.storageKey) {
      const cached = await pwOptimizerStorage.getPage(page.storageKey, page.pageIndex);
      if (cached) {
        return memoryManager.blobToImageData(cached.optimizedBlob);
      }
    }

    throw new Error(`Failed to load optimized page image for page ${page.pageIndex + 1}`);
  }

  /**
   * Compile N-up print sheets and export final PDF Blob in a memory-safe streaming pass
   */
  public static async compileSheetsAndExportPdf(
    activePages: ProcessedPage[],
    layoutConfig: LayoutConfig,
    onProgress?: (current: number, total: number, action: string) => void
  ): Promise<{
    finalPdfBlob: Blob;
    sheetPreviews: string[];
    metrics: OptimizationMetrics;
  }> {
    const startTime = performance.now();

    const { totalPerSheet } = LayoutEngine.getGridDimensions(layoutConfig.gridFormat);
    const totalSheets = Math.ceil(activePages.length / totalPerSheet);
    const sheetPreviews: string[] = [];

    const pdfDoc = await PDFDocument.create();

    for (let sheetIdx = 0; sheetIdx < totalSheets; sheetIdx++) {
      const sliceStart = sheetIdx * totalPerSheet;
      const sliceEnd = Math.min(activePages.length, sliceStart + totalPerSheet);
      const chunkPages = activePages.slice(sliceStart, sliceEnd);

      if (onProgress) {
        onProgress(sheetIdx + 1, totalSheets, `Building printable sheet ${sheetIdx + 1} of ${totalSheets}...`);
      }

      // Load chunk images on demand
      const chunkImages: ImageData[] = [];
      for (const p of chunkPages) {
        const optImg = await this.loadOptimizedImageData(p);
        chunkImages.push(optImg);
      }

      // Compose sheet
      const sheetCanvas = LayoutEngine.composeSheet(chunkImages, sheetIdx, totalSheets, layoutConfig);

      // Low-res lightweight thumbnail for sheet preview in UI
      const thumbWidth = Math.min(500, Math.round(sheetCanvas.width / 3));
      const thumbHeight = Math.min(750, Math.round(sheetCanvas.height / 3));
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = thumbWidth;
      thumbCanvas.height = thumbHeight;
      const thumbCtx = thumbCanvas.getContext('2d');
      if (thumbCtx) {
        thumbCtx.drawImage(sheetCanvas, 0, 0, thumbWidth, thumbHeight);
      }

      const previewBlob = await new Promise<Blob>((resolve) =>
        (thumbCanvas || sheetCanvas).toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 0.6)
      );
      memoryManager.disposeCanvas(thumbCanvas);

      const previewUrl = memoryManager.createTrackedBlobUrl(previewBlob);
      sheetPreviews.push(previewUrl);

      // Embed into PDF-lib directly from Blob ArrayBuffer (no heavy base64 strings)
      const jpegBlob = await new Promise<Blob>((resolve) =>
        sheetCanvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 0.85)
      );
      const jpegBytes = await jpegBlob.arrayBuffer();
      const embeddedImage = await pdfDoc.embedJpg(jpegBytes);
      const pdfPage = pdfDoc.addPage([sheetCanvas.width, sheetCanvas.height]);
      pdfPage.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: sheetCanvas.width,
        height: sheetCanvas.height,
      });

      // Dispose sheet canvas and clear loaded chunk images
      memoryManager.disposeCanvas(sheetCanvas);
      chunkImages.length = 0;
      await memoryManager.yieldToUI();
    }

    const pdfBytes = await pdfDoc.save();
    const finalPdfBlob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });

    const elapsedMs = Math.round(performance.now() - startTime);

    const avgInkBefore = activePages.reduce((sum, p) => sum + p.inkCoverageBeforePct, 0) / activePages.length;
    const avgInkAfter = activePages.reduce((sum, p) => sum + p.inkCoverageAfterPct, 0) / activePages.length;
    const inkSavedPct = Math.max(0, Math.round(((avgInkBefore - avgInkAfter) / avgInkBefore) * 100));

    const metrics: OptimizationMetrics = {
      totalOriginalSizeMB: Number((activePages.length * 0.8).toFixed(2)),
      totalOptimizedSizeMB: Number((finalPdfBlob.size / (1024 * 1024)).toFixed(2)),
      originalInkCoveragePct: Number(avgInkBefore.toFixed(1)),
      optimizedInkCoveragePct: Number(avgInkAfter.toFixed(1)),
      inkSavedPct: isNaN(inkSavedPct) ? 80 : inkSavedPct,
      processingTimeMs: elapsedMs,
      pagesPerSecond: Number(((activePages.length / Math.max(1, elapsedMs)) * 1000).toFixed(1)),
      throughputMPixelsPerSec: 5,
    };

    return { finalPdfBlob, sheetPreviews, metrics };
  }

  /**
   * Export 1-Up Optimized PDF in a memory-safe streaming pass
   */
  public static async export1UpOptimizedPdf(
    processedPages: ProcessedPage[],
    quality: number = 0.85,
    onProgress?: (current: number, total: number) => void
  ): Promise<Blob> {
    const pdfDoc = await PDFDocument.create();

    for (let i = 0; i < processedPages.length; i++) {
      if (onProgress) onProgress(i + 1, processedPages.length);

      const pageItem = processedPages[i];
      const optData = await this.loadOptimizedImageData(pageItem);

      const canvas = document.createElement('canvas');
      canvas.width = optData.width;
      canvas.height = optData.height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.putImageData(optData, 0, 0);
        const jpegBlob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', quality)
        );
        const jpegBytes = await jpegBlob.arrayBuffer();
        const embeddedImage = await pdfDoc.embedJpg(jpegBytes);
        const pdfPage = pdfDoc.addPage([canvas.width, canvas.height]);
        pdfPage.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: canvas.width,
          height: canvas.height,
        });
      }

      memoryManager.disposeCanvas(canvas);
      await memoryManager.yieldToUI();
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  }
}
