import { PDFDocument } from 'pdf-lib';
import { LayoutEngine } from './layoutEngine';
import { memoryManager } from './memoryManager';
import { pwOptimizerStorage } from './storage';
import { WorkerManager } from '../workers/WorkerManager';
import { getProcessingEngine, EngineVersion } from './engine';
import { getPdfjsLib } from './pdfjsLoader';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { DocumentProfile, LayoutConfig, OptimizationMetrics, PresetMode, ProcessedPage } from './types';
import '../workers/init';

/**
 * Cached PDF.js document keyed by the source bytes reference, so the original
 * page can be re-rendered across previews/adjustments without re-parsing the
 * whole PDF each time. Destroyed when bytes change or on unload.
 */
let cachedOriginalPdfDoc: { bytes: Uint8Array; doc: PDFDocumentProxy } | null = null;

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
    const engine = getProcessingEngine();
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

  private static async loadPageImageDataOrBlank(page: ProcessedPage): Promise<ImageData> {
    try {
      return await this.loadOptimizedImageData(page);
    } catch (err) {
      console.warn(`[export] Failed to load optimized page ${page.pageIndex + 1}, using blank:`, err);
      const w = page.width ?? 612, h = page.height ?? 792;
      return new ImageData(new Uint8ClampedArray(w * h * 4).fill(255), w, h);
    }
  }

  /**
   * Loads the original (pre-optimization) page. Uses the cached originalBlob
   * when present (legacy records), otherwise lazily re-renders it from the
   * merged PDF. This lets processing skip the expensive original JPEG encode.
   * `targetWidth` renders at the processed page's own resolution so pinned
   * original pages visually match their whitened neighbors inside N-up
   * sheets (and avoid a needless 200 DPI memory spike).
   */
  public static async loadOriginalImageData(
    page: ProcessedPage,
    mergedPdfBytes: Uint8Array | null,
    targetWidth?: number,
  ): Promise<ImageData> {
    const cached = await pwOptimizerStorage.getPage(page.storageKey!, page.pageIndex);
    if (cached?.originalBlob) return memoryManager.blobToImageData(cached.originalBlob);
    if (mergedPdfBytes) return this.renderOriginalFromPdf(mergedPdfBytes, page.pageIndex, targetWidth ?? page.width);
    throw new Error(`Failed to load original for page ${page.pageIndex + 1}`);
  }

  private static async renderOriginalFromPdf(
    mergedPdfBytes: Uint8Array,
    pageIndex: number,
    targetWidth?: number,
  ): Promise<ImageData> {
    const pdfjsLib = await getPdfjsLib();
    let pdfDoc = cachedOriginalPdfDoc?.bytes === mergedPdfBytes ? cachedOriginalPdfDoc.doc : null;
    if (!pdfDoc) {
      PdfExporter.disposeCachedOriginalPdf();
      pdfDoc = await pdfjsLib.getDocument({ data: mergedPdfBytes.slice() }).promise;
      cachedOriginalPdfDoc = { bytes: mergedPdfBytes, doc: pdfDoc };
    }
    const pdfPage = await pdfDoc.getPage(pageIndex + 1);
    const base = pdfPage.getViewport({ scale: 1 });
    /* Match the processed page's pixel width when known; else the legacy
       ~200 DPI inspection cap. */
    const scale = targetWidth && targetWidth > 0
      ? Math.min(3.0, targetWidth / base.width)
      : Math.min(3.0, 200 / 72);
    const viewport = pdfPage.getViewport({ scale });
    const vw = Math.floor(viewport.width);
    const vh = Math.floor(viewport.height);
    const canvas = memoryManager.acquireCanvas(vw, vh);
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    await pdfPage.render({ canvasContext: ctx, viewport }).promise;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    memoryManager.disposeCanvas(canvas);
    return imageData;
  }

  /** Destroys the cached PDF.js document so a newer source can take its place. */
  public static disposeCachedOriginalPdf(): void {
    if (cachedOriginalPdfDoc?.doc) {
      try { cachedOriginalPdfDoc.doc.destroy(); } catch { /* noop */ }
    }
    cachedOriginalPdfDoc = null;
  }

  private static async composeSheetWithWorker(
    pages: ProcessedPage[],
    pageImageDatas: ImageData[],
    sheetIndex: number,
    totalSheets: number,
    config: LayoutConfig
  ): Promise<{ jpegBuffer: ArrayBuffer; width: number; height: number }> {
    const wm = WorkerManager.getInstance();
    if (wm.isWorkerSupported() && wm.isOffscreenCanvasSupported()) {
      const pool = wm.getPool();
      const geometry = LayoutEngine.getSheetCompositionGeometry(config);
      /* loadOptimizedImageData decodes fresh buffers owned exclusively by this
         call, so the worker gets them zero-copy (no .slice(0) memcpy per page).
         A view into a larger/shared buffer — never produced today, cheap to
         guard — is copied instead so nothing we do not own is detached. */
      const owned = new Set<Uint8ClampedArray>();
      const pageBuffers = pageImageDatas.map((d) => {
        const buf = d.data.buffer;
        if (d.data.byteOffset === 0 && d.data.byteLength === buf.byteLength) {
          owned.add(d.data);
          return buf;
        }
        return buf.slice(d.data.byteOffset, d.data.byteOffset + d.data.byteLength);
      });
      try {
        const result = await pool.submitComposeTask({
          sheetIndex, totalSheets,
          pageBuffers, pageWidths: pageImageDatas.map(d => d.width), pageHeights: pageImageDatas.map(d => d.height),
          dims: { widthPx: geometry.dims.widthPx, heightPx: geometry.dims.heightPx }, cols: geometry.cols, rows: geometry.rows,
          marginTop: geometry.marginTop, marginLeft: geometry.marginLeft, marginRight: geometry.marginRight,
          marginBottom: geometry.marginBottom, marginInner: geometry.marginInner,
          footerHeight: geometry.footerHeight, footerFontSize: geometry.footerFontSize, footerBaseline: geometry.footerBaseline,
          showSlideBorders: config.showSlideBorders ?? true,
          showPageNumbers: config.showPageNumbers ?? false,
        });
        return { jpegBuffer: result.jpegBuffer, width: result.width, height: result.height };
      } catch {
        /* Worker compose failed. Buffers that were transferred are now
           detached — reload those pages from storage so the main-thread
           fallback below can still render the sheet. */
        if (owned.size > 0) {
          pageImageDatas = await Promise.all(pageImageDatas.map(async (d, i) =>
            owned.has(d.data) ? this.loadPageImageDataOrBlank(pages[i]) : d
          ));
        }
      }
    }
    const sheetCanvas = LayoutEngine.composeSheet(pageImageDatas, sheetIndex, totalSheets, config);
    const width = sheetCanvas.width;
    const height = sheetCanvas.height;
    const blob = await new Promise<Blob>((res) => sheetCanvas.toBlob((b) => res(b || new Blob()), 'image/jpeg', 0.85));
    sheetCanvas.width = 0;
    sheetCanvas.height = 0;
    const jpegBuffer = await blob.arrayBuffer();
    return { jpegBuffer, width, height };
  }

  public static async compileSheetsAndExportPdf(
    activePages: ProcessedPage[],
    layoutConfig: LayoutConfig,
    onProgress?: (current: number, total: number, action: string) => void,
    opts?: { keepOriginalPages?: Set<number>; manualWhiteBoxRegions?: Record<number, import('../kernels/whiteBox').WhiteBoxRegion[]>; mergedPdfBytes?: Uint8Array | null },
  ): Promise<{ finalPdfBlob: Blob; sheetPreviews: string[]; metrics: OptimizationMetrics }> {
    const startTime = performance.now();
    const keepOriginal = opts?.keepOriginalPages;
    const mergedBytes = opts?.mergedPdfBytes ?? null;
    const { totalPerSheet } = LayoutEngine.getGridDimensions(layoutConfig.gridFormat);
    const totalSheets = Math.ceil(activePages.length / totalPerSheet);
    const sheetPreviews: string[] = [];
    const pdfDoc = await PDFDocument.create();

    const pool = WorkerManager.getInstance().getPool();
    pool.prewarm('compose');

    for (let si = 0; si < totalSheets; si++) {
      if (onProgress) onProgress(si + 1, totalSheets, `Building sheet ${si + 1}/${totalSheets}...`);

      const chunk = activePages.slice(si * totalPerSheet, Math.min(activePages.length, (si + 1) * totalPerSheet));

      /* Pinned pages render from the ORIGINAL merged PDF (pure source swap,
         zero reprocessing). Manual white-box regions are composited on top
         of the optimized bitmap (original pixels pasted back per rect/ellipse).
         Falls back to the processed bitmap if any render fails. */
      const manualRegions = opts?.manualWhiteBoxRegions;
      const chunkImages = await Promise.all(chunk.map(async (p) => {
        if (keepOriginal?.has(p.pageIndex) && mergedBytes) {
          try {
            return await this.loadOriginalImageData(p, mergedBytes, p.width);
          } catch (err) {
            console.warn(`[export] Original render failed for page ${p.pageIndex + 1}, using processed:`, err);
          }
        }
        const img = await this.loadPageImageDataOrBlank(p);
        const userRects = manualRegions?.[p.pageIndex];
        if (userRects && userRects.length > 0 && mergedBytes && !keepOriginal?.has(p.pageIndex)) {
          try {
            const orig = await this.loadOriginalImageData(p, mergedBytes, img.width);
            // Ensure dimensions match (original rendered at img.width)
            if (orig.width === img.width && orig.height === img.height) {
              const { compositeWhiteBoxRegions } = await import('../kernels/whiteBox');
              compositeWhiteBoxRegions(img.data, orig.data, img.width, img.height, userRects, 0);
            }
          } catch (err) {
            console.warn(`[export] Manual region composite failed for page ${p.pageIndex + 1}:`, err);
          }
        }
        return img;
      }));

      const { jpegBuffer, width, height } = await this.composeSheetWithWorker(
        chunk, chunkImages, si, totalSheets, layoutConfig
      );

      const tw = Math.min(500, Math.round(width / 3)), th = Math.min(750, Math.round(height / 3));
      const tc = memoryManager.acquireCanvas(tw, th);
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
      if (previewBlob.size > 0) sheetPreviews.push(memoryManager.createTrackedBlobUrl(previewBlob, 'sheet-preview'));

      const embedded = await pdfDoc.embedJpg(jpegBuffer);
      const pdfPage = pdfDoc.addPage([width, height]);
      pdfPage.drawImage(embedded, { x: 0, y: 0, width, height });
      await memoryManager.yieldToUI();
    }

    const pdfBytes = await pdfDoc.save();
    const finalPdfBlob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const elapsedMs = Math.round(performance.now() - startTime);
    /* Pinned-original pages save no ink — their "after" equals "before". */
    const avgBefore = activePages.reduce((s, p) => s + p.inkCoverageBeforePct, 0) / activePages.length;
    const avgAfter = activePages.reduce(
      (s, p) => s + (keepOriginal?.has(p.pageIndex) ? p.inkCoverageBeforePct : p.inkCoverageAfterPct),
      0,
    ) / activePages.length;
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
      if (ctx) {
        ctx.putImageData(optData, 0, 0);
        const jpegBlob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), 'image/jpeg', quality));
        if (jpegBlob && jpegBlob.size > 0) {
          const embedded = await pdfDoc.embedJpg(await jpegBlob.arrayBuffer());
          const pdfPage = pdfDoc.addPage([canvas.width, canvas.height]);
          pdfPage.drawImage(embedded, { x: 0, y: 0, width: canvas.width, height: canvas.height });
        }
      }
      memoryManager.disposeCanvas(canvas);
      await memoryManager.yieldToUI();
    }
    return new Blob([(await pdfDoc.save()).buffer as ArrayBuffer], { type: 'application/pdf' });
  }
}
