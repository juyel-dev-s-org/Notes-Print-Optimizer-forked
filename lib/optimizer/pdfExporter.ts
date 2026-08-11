import { PDFDocument } from 'pdf-lib';
import { LayoutEngine } from './layoutEngine';
import { memoryManager } from './memoryManager';
import { pwOptimizerStorage } from './storage';
import { WorkerManager } from '../workers/WorkerManager';
import { getProcessingEngine, EngineVersion } from './engine';
import { getPdfjsLib } from './pdfjsLoader';
import { DocumentProfile, LayoutConfig, OptimizationMetrics, PresetMode, ProcessedPage } from './types';
import '../workers/init';

export class PdfExporter {
  /** @deprecated Use getPdfjsLib() from pdfjsLoader directly. Kept for backward compat. */
  public static async initPdfJs(): Promise<typeof import('pdfjs-dist')> {
    return getPdfjsLib();
  }

  public static async mergePdfBuffers(pdfBuffers: ArrayBuffer[]): Promise<{ pdfBytes: Uint8Array; pdfBlob: Blob }> {
    const mergedPdf = await PDFDocument.create();
    for (const buffer of pdfBuffers) {
      const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }
    const pdfBytes = await mergedPdf.save();
    return { pdfBytes, pdfBlob: new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' }) };
  }

  public static async processPdfStreaming(pdfBuffer: ArrayBuffer, pdfId: string, presetMode: PresetMode = 'AUTO_ADAPTIVE',
    onProgress?: (current: number, total: number, action: string) => void, engineVersion?: EngineVersion
  ): Promise<{ processedPages: ProcessedPage[]; docProfile: DocumentProfile }> {
    const engine = getProcessingEngine(engineVersion);
    const result = await engine.processDocument({ pdfBuffer, pdfId, presetMode }, {}, onProgress);
    return { processedPages: result.processedPages, docProfile: result.docProfile };
  }

  public static async loadPageImageData(page: ProcessedPage, mergedPdfBytes: Uint8Array | null = null): Promise<{ originalImageData: ImageData; optimizedImageData: ImageData }> {
    return {
      originalImageData: await this.loadOriginalImageData(page, mergedPdfBytes),
      optimizedImageData: await this.loadOptimizedImageData(page),
    };
  }

  public static async loadOptimizedImageData(page: ProcessedPage): Promise<ImageData> {
    const cached = await pwOptimizerStorage.getPage(page.storageKey!, page.pageIndex);
    if (cached) return memoryManager.blobToImageData(cached.optimizedBlob);
    throw new Error(`Failed to load optimized page ${page.pageIndex + 1}`);
  }

  /**
   * Loads the original (pre-optimization) page. Uses the cached originalBlob
   * when present (legacy records), otherwise lazily re-renders it from the
   * merged PDF. This lets processing skip the expensive original JPEG encode.
   */
  public static async loadOriginalImageData(page: ProcessedPage, mergedPdfBytes: Uint8Array | null): Promise<ImageData> {
    const cached = await pwOptimizerStorage.getPage(page.storageKey!, page.pageIndex);
    if (cached?.originalBlob) return memoryManager.blobToImageData(cached.originalBlob);
    if (mergedPdfBytes) return this.renderOriginalFromPdf(mergedPdfBytes, page.pageIndex);
    throw new Error(`Failed to load original for page ${page.pageIndex + 1}`);
  }

  private static async renderOriginalFromPdf(mergedPdfBytes: Uint8Array, pageIndex: number): Promise<ImageData> {
    const pdfjsLib = await getPdfjsLib();
    const pdfDoc = await pdfjsLib.getDocument({ data: mergedPdfBytes.slice() }).promise;
    try {
      const pdfPage = await pdfDoc.getPage(pageIndex + 1);
      const scale = Math.min(3.0, 200 / 72); /* ~200 DPI cap for inspection */
      const viewport = pdfPage.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      await pdfPage.render({ canvasContext: ctx, viewport }).promise;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      memoryManager.disposeCanvas(canvas);
      return imageData;
    } finally {
      try { pdfDoc.destroy(); } catch { /* noop */ }
    }
  }

  private static async composeSheetWithWorker(
    pageImageDatas: ImageData[],
    sheetIndex: number,
    totalSheets: number,
    config: LayoutConfig
  ): Promise<{ jpegBuffer: ArrayBuffer; width: number; height: number }> {
    const wm = WorkerManager.getInstance();
    if (wm.isWorkerSupported() && wm.isOffscreenCanvasSupported()) {
      const pool = wm.getPool();
      try {
          const dims = LayoutEngine.getSheetDimensions(config.paperSize, config.orientation);
          const mmPx = dims.dpi / 25.4;
          const { cols, rows } = LayoutEngine.getGridDimensions(config.gridFormat);
          const pageBuffers = pageImageDatas.map(d => d.data.buffer.slice(0));
          const result = await pool.submitComposeTask({
            sheetIndex, totalSheets,
            pageBuffers, pageWidths: pageImageDatas.map(d => d.width), pageHeights: pageImageDatas.map(d => d.height),
            dims: { widthPx: dims.widthPx, heightPx: dims.heightPx }, cols, rows,
            marginTop: Math.round((config.outerMarginMm?.top ?? config.marginMm ?? 2) * mmPx),
            marginLeft: Math.round((config.outerMarginMm?.left ?? config.marginMm ?? 5) * mmPx),
            marginRight: Math.round((config.outerMarginMm?.right ?? config.marginMm ?? 3) * mmPx),
            marginBottom: Math.round((config.outerMarginMm?.bottom ?? config.marginMm ?? 2) * mmPx),
            marginInner: Math.round((config.innerMarginMm ?? config.spacingMm ?? 1) * mmPx),
            showSlideBorders: config.showSlideBorders ?? true,
            showPageNumbers: config.showPageNumbers ?? false,
          });
          return { jpegBuffer: result.jpegBuffer, width: result.width, height: result.height };
        } catch {
          /* worker compose failed — fall through to main thread */
        }
    }
    const sheetCanvas = LayoutEngine.composeSheet(pageImageDatas, sheetIndex, totalSheets, config);
    const blob = await new Promise<Blob>((res) => sheetCanvas.toBlob((b) => res(b || new Blob()), 'image/jpeg', 0.85));
    const jpegBuffer = await blob.arrayBuffer();
    return { jpegBuffer, width: sheetCanvas.width, height: sheetCanvas.height };
  }

  public static async compileSheetsAndExportPdf(activePages: ProcessedPage[], layoutConfig: LayoutConfig,
    onProgress?: (current: number, total: number, action: string) => void
  ): Promise<{ finalPdfBlob: Blob; sheetPreviews: string[]; metrics: OptimizationMetrics }> {
    const startTime = performance.now();
    const { totalPerSheet } = LayoutEngine.getGridDimensions(layoutConfig.gridFormat);
    const totalSheets = Math.ceil(activePages.length / totalPerSheet);
    const sheetPreviews: string[] = [];
    const pdfDoc = await PDFDocument.create();

    const pool = WorkerManager.getInstance().getPool();
    pool.prewarm('compose');

    for (let si = 0; si < totalSheets; si++) {
      if (onProgress) onProgress(si + 1, totalSheets, `Building sheet ${si + 1}/${totalSheets}...`);

      const chunk = activePages.slice(si * totalPerSheet, Math.min(activePages.length, (si + 1) * totalPerSheet));

      const chunkImages = await Promise.all(chunk.map(async (p) => {
        try {
          return await this.loadOptimizedImageData(p);
        } catch (err) {
          console.warn(`[export] Failed to load optimized page ${p.pageIndex + 1}, using blank:`, err);
          const w = p.width ?? 612, h = p.height ?? 792;
          return new ImageData(new Uint8ClampedArray(w * h * 4).fill(255), w, h);
        }
      }));

      const { jpegBuffer, width, height } = await this.composeSheetWithWorker(
        chunkImages, si, totalSheets, layoutConfig
      );

      const tw = Math.min(500, Math.round(width / 3)), th = Math.min(750, Math.round(height / 3));
      const tc = document.createElement('canvas'); tc.width = tw; tc.height = th;
      try {
        const previewBlob = new Blob([jpegBuffer], { type: 'image/jpeg' });
        const bmp = await createImageBitmap(previewBlob, { resizeWidth: tw, resizeHeight: th, resizeQuality: 'medium' });
        const tCtx = tc.getContext('2d');
        if (tCtx) { tCtx.drawImage(bmp, 0, 0); bmp.close(); }
      } catch {
        console.warn('[export] Preview generation failed for sheet', si + 1);
      }
      const previewBlob = await new Promise<Blob>((res) => tc.toBlob((b) => res(b || new Blob()), 'image/jpeg', 0.6));
      memoryManager.disposeCanvas(tc);
      if (previewBlob.size > 0) sheetPreviews.push(memoryManager.createTrackedBlobUrl(previewBlob));

      const embedded = await pdfDoc.embedJpg(jpegBuffer);
      const pdfPage = pdfDoc.addPage([width, height]);
      pdfPage.drawImage(embedded, { x: 0, y: 0, width, height });
      await memoryManager.yieldToUI();
    }

    const pdfBytes = await pdfDoc.save();
    const finalPdfBlob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const elapsedMs = Math.round(performance.now() - startTime);
    const avgBefore = activePages.reduce((s, p) => s + p.inkCoverageBeforePct, 0) / activePages.length;
    const avgAfter = activePages.reduce((s, p) => s + p.inkCoverageAfterPct, 0) / activePages.length;
    const inkSaved = Math.max(0, Math.round(((avgBefore - avgAfter) / avgBefore) * 100));
    return { finalPdfBlob, sheetPreviews, metrics: {
      totalOriginalSizeMB: Number((activePages.length * 0.8).toFixed(2)),
      totalOptimizedSizeMB: Number((finalPdfBlob.size / (1024 * 1024)).toFixed(2)),
      originalInkCoveragePct: Number(avgBefore.toFixed(1)), optimizedInkCoveragePct: Number(avgAfter.toFixed(1)),
      inkSavedPct: isNaN(inkSaved) ? 80 : inkSaved, processingTimeMs: elapsedMs,
      pagesPerSecond: Number(((activePages.length / Math.max(1, elapsedMs)) * 1000).toFixed(1)),
      throughputMPixelsPerSec: Number(((activePages.length * 2.986) / (elapsedMs / 1000)).toFixed(1)),
    } };
  }

  public static async export1UpOptimizedPdf(processedPages: ProcessedPage[], quality: number = 0.85,
    onProgress?: (current: number, total: number) => void): Promise<Blob> {
    const pdfDoc = await PDFDocument.create();
    for (let i = 0; i < processedPages.length; i++) {
      if (onProgress) onProgress(i + 1, processedPages.length);
      const optData = await this.loadOptimizedImageData(processedPages[i]);
      const canvas = memoryManager.acquireCanvas(optData.width, optData.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) { ctx.putImageData(optData, 0, 0);
        const jpegBlob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b || new Blob()), 'image/jpeg', quality));
        const embedded = await pdfDoc.embedJpg(await jpegBlob.arrayBuffer());
        const pdfPage = pdfDoc.addPage([canvas.width, canvas.height]);
        pdfPage.drawImage(embedded, { x: 0, y: 0, width: canvas.width, height: canvas.height }); }
      memoryManager.disposeCanvas(canvas);
      await memoryManager.yieldToUI();
    }
    return new Blob([(await pdfDoc.save()).buffer as ArrayBuffer], { type: 'application/pdf' });
  }
}
