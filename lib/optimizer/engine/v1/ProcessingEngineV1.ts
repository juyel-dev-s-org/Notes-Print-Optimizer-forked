import { IProcessingEngine } from '../IProcessingEngine';
import { EngineCapabilities, EngineDocumentInput, EngineDocumentOutput, EnginePageProcessResult, EngineProcessingOptions, EngineProgressCallback, EngineVersion } from '../types';
import { DocumentProfile, PageProfile, PresetMode, ProcessedPage, ProcessingParameters } from '../../types';
import { ImageProcessingKernels } from '../../pixelKernels';
import { workerPool } from '../../workerPool';
import { ParameterGenerator } from '../../parameterGenerator';
import { memoryManager } from '../../memoryManager';
import { pwOptimizerStorage } from '../../storage';

/** Batched IDB write queue — reduces per-page transactions (H-5). */
interface PendingWrite {
  pdfId: string;
  pageIndex: number;
  originalBlob: Blob;
  optimizedBlob: Blob;
}

const WRITE_BATCH_SIZE = 4;

/* ── Adaptive render scale constants (M-2) ── */
const TARGET_DPI = 250;
const MIN_SCALE = 1.0;
const MAX_SCALE = 4.0;
const MAX_LONGEST_DIM_DESKTOP = 2400;
const MAX_LONGEST_DIM_MOBILE = 1600;
const FALLBACK_SCALE = 1.8;

export class ProcessingEngineV1 implements IProcessingEngine {
  readonly id = 'pw-pixel-v1';
  readonly version: EngineVersion = 'v1';
  readonly name = 'PW High-Speed Pixel Engine v1';
  readonly description = 'Single-pass rendering, unified HSV evaluation, persistent worker pool, pre-allocated CC buffers.';
  readonly capabilities: EngineCapabilities = {
    supportsWebWorkers: true, supportsSmartColorRemap: true, supportsAutoBannerCrop: true,
    maxConcurrentPages: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
    engineDescription: 'v1: Single-pass render + parallel pixel kernels.',
  };

  /* ── Batched write queue (H-5) ── */
  private writeQueue: PendingWrite[] = [];
  private flushChain: Promise<void> = Promise.resolve();

  private enqueueWrite(entry: PendingWrite): void {
    this.writeQueue.push(entry);
    if (this.writeQueue.length >= WRITE_BATCH_SIZE) {
      this.scheduleFlush();
    }
  }

  private scheduleFlush(): void {
    const batch = this.writeQueue.splice(0, this.writeQueue.length);
    if (batch.length === 0) return;
    this.flushChain = this.flushChain.then(() =>
      pwOptimizerStorage.storePagesBatch(batch)
    ).catch((e) => {
      console.warn('[Engine v1] IDB batch write failed (non-fatal):', e);
    });
  }

  private async flushRemainingWrites(): Promise<void> {
    this.scheduleFlush();
    await this.flushChain;
  }

  /* ── Adaptive DPI-targeted render scale (M-2) ── */

  private getMaxLongestDim(): number {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent;
      const isMob = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const isTab = /iPad/i.test(ua) || (navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
      if (isMob && !isTab) return MAX_LONGEST_DIM_MOBILE;
    }
    return MAX_LONGEST_DIM_DESKTOP;
  }

  private computeAdaptiveScale(page: any): number {
    try {
      const viewport = page.getViewport({ scale: 1.0 });
      const w = viewport?.width;
      const h = viewport?.height;
      if (!w || !h || !isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) {
        console.warn('[Engine v1] Invalid viewport dimensions, falling back to', FALLBACK_SCALE);
        return FALLBACK_SCALE;
      }
      const dpiScale = TARGET_DPI / 72;
      const maxDim = Math.max(w, h);
      const dimCapScale = this.getMaxLongestDim() / maxDim;
      const raw = Math.min(dpiScale, dimCapScale);
      return Math.max(MIN_SCALE, Math.min(MAX_SCALE, raw));
    } catch (e) {
      console.warn('[Engine v1] computeAdaptiveScale failed, falling back to', FALLBACK_SCALE, e);
      return FALLBACK_SCALE;
    }
  }

  /* ── Reusable thumbnail canvas + blob URLs (M-4) ── */
  private thumbCanvas: HTMLCanvasElement | null = null;
  private thumbCtx: CanvasRenderingContext2D | null = null;
  private thumbUrls: Map<number, string> = new Map();
  /** Serializes thumbnail generation so the shared canvas is safe under concurrency. */
  private thumbChain: Promise<string> = Promise.resolve('');

  private getThumbContext(width: number, height: number): CanvasRenderingContext2D {
    if (!this.thumbCanvas) {
      this.thumbCanvas = document.createElement('canvas');
      this.thumbCtx = this.thumbCanvas.getContext('2d')!;
    }
    if (this.thumbCanvas.width !== width || this.thumbCanvas.height !== height) {
      this.thumbCanvas.width = width;
      this.thumbCanvas.height = height;
    }
    this.thumbCtx!.clearRect(0, 0, width, height);
    return this.thumbCtx!;
  }

  private revokeThumbUrls(): void {
    this.thumbUrls.forEach((url) => {
      try { URL.revokeObjectURL(url); } catch { /* noop */ }
    });
    this.thumbUrls.clear();
  }

  private encodeThumbBlob(quality: number): Promise<string> {
    const canvas = this.thumbCanvas!;
    if (typeof canvas.toBlob === 'function') {
      return new Promise<string>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            console.warn('[Engine v1] toBlob returned null, falling back to toDataURL');
            resolve(canvas.toDataURL('image/jpeg', quality));
          }
        }, 'image/jpeg', quality);
      });
    }
    /* toBlob unavailable — fall back to synchronous data URL */
    return Promise.resolve(canvas.toDataURL('image/jpeg', quality));
  }

  /**
   * Generate a thumbnail for one page. Serialized via thumbChain so the
   * shared canvas is never accessed by two pages simultaneously.
   */
  private generateThumbnail(optimizedImageData: ImageData, pageIndex: number): Promise<string> {
    const task = this.thumbChain.then(async () => {
      const tw = Math.max(1, Math.round(optimizedImageData.width / 4));
      const th = Math.max(1, Math.round(optimizedImageData.height / 4));
      const ctx = this.getThumbContext(tw, th);

      if (typeof createImageBitmap !== 'undefined') {
        const bmp = await createImageBitmap(optimizedImageData, {
          resizeWidth: tw, resizeHeight: th, resizeQuality: 'medium',
        });
        ctx.drawImage(bmp, 0, 0);
        bmp.close();
      } else {
        /* Fallback: temp canvas holds full-size pixels, then scale-draw */
        const tmp = document.createElement('canvas');
        tmp.width = optimizedImageData.width;
        tmp.height = optimizedImageData.height;
        tmp.getContext('2d')!.putImageData(optimizedImageData, 0, 0);
        ctx.drawImage(tmp, 0, 0, tw, th);
        memoryManager.disposeCanvas(tmp);
      }

      const url = await this.encodeThumbBlob(0.6);

      /* Revoke previous URL if this page was reprocessed */
      const prev = this.thumbUrls.get(pageIndex);
      if (prev && prev.startsWith('blob:')) {
        try { URL.revokeObjectURL(prev); } catch { /* noop */ }
      }
      this.thumbUrls.set(pageIndex, url);
      return url;
    }).catch(() => '');

    this.thumbChain = task;
    return task;
  }

  /** Release thumbnail resources. Call when the engine is no longer needed. */
  public dispose(): void {
    this.revokeThumbUrls();
    this.thumbCanvas = null;
    this.thumbCtx = null;
  }

  /* ── Public API ── */

  public async analyzePage(imageData: ImageData, pageIndex: number): Promise<PageProfile> {
    return ImageProcessingKernels.analyzeImageData(imageData, pageIndex);
  }

  public async processPage(imageData: ImageData, pageIndex: number, params: ProcessingParameters, profile: PageProfile): Promise<EnginePageProcessResult> {
    const t0 = performance.now();
    const res = await workerPool.processPage(pageIndex, imageData, params, profile);
    return { pageIndex: res.pageIndex, optimizedImageData: res.optimizedImageData,
      inkCoverageBeforePct: res.inkCoverageBeforePct, inkCoverageAfterPct: res.inkCoverageAfterPct,
      processingTimeMs: Math.round(performance.now() - t0) };
  }

  private async initPdfJs(): Promise<any> {
    if (typeof window === 'undefined') return null;
    if ((window as any).pdfjsLib) return (window as any).pdfjsLib;
    return new Promise((resolve, reject) => {
      const existing = document.getElementById('pdfjs-script');
      if (existing) { let att = 0; const iv = setInterval(() => {
        if ((window as any).pdfjsLib) { clearInterval(iv); resolve((window as any).pdfjsLib); }
        else if (att++ > 50) { clearInterval(iv); reject(new Error('PDF.js timeout')); }
      }, 100); return; }
      const s = document.createElement('script'); s.id = 'pdfjs-script';
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = () => { const lib = (window as any).pdfjsLib;
        if (lib) { lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; resolve(lib); }
        else reject(new Error('PDF.js init failed')); };
      s.onerror = () => reject(new Error('PDF.js CDN failed'));
      document.head.appendChild(s);
    });
  }

  public async processDocument(input: EngineDocumentInput, options: EngineProcessingOptions = {}, onProgress?: EngineProgressCallback): Promise<EngineDocumentOutput> {
    const t0 = performance.now();
    const { pdfBuffer, pdfId, presetMode = 'AUTO_ADAPTIVE' } = input;
    const userRenderScale = options.renderScale ?? null;
    const pdfjsLib = await this.initPdfJs();
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
    const totalPages = pdfDoc.numPages;
    const profiles: PageProfile[] = new Array(totalPages);
    const processedPages: ProcessedPage[] = new Array(totalPages);
    let sumBrightness = 0, darkCount = 0;

    /* Reset write queue for new document (H-5) */
    this.writeQueue = [];
    this.flushChain = Promise.resolve();

    /* Reset thumbnail state for new document (M-4) */
    this.revokeThumbUrls();
    this.thumbChain = Promise.resolve('');

    let execMode = options.executionMode || 'auto';
    if (execMode === 'auto') {
      if (typeof navigator !== 'undefined') { const ua = navigator.userAgent;
        const isMob = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        const isTab = /iPad/i.test(ua) || (navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
        execMode = isMob && !isTab ? 'sequential' : isTab ? 'hybrid' : 'parallel';
      } else execMode = 'parallel';
    }
    const concurrency = execMode === 'parallel' ? Math.min(4, typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4) : execMode === 'hybrid' ? 2 : 1;

    const processSinglePage = async (i: number): Promise<void> => {
      if (onProgress) onProgress(i, totalPages, `[Engine v1] Processing slide ${i}/${totalPages} (${execMode})...`);
      const page = await pdfDoc.getPage(i);
      const pageScale = userRenderScale !== null ? userRenderScale : this.computeAdaptiveScale(page);
      const viewport = page.getViewport({ scale: pageScale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const srcImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const profile = ImageProcessingKernels.analyzeImageData(srcImageData, i - 1);
      profiles[i - 1] = profile; sumBrightness += profile.averageBrightness;
      if (profile.classification === 'DARK_SLIDE') darkCount++;
      const partialDoc: DocumentProfile = { totalPages, averageBrightness: 128, darkSlideRatio: 0.5,
        recommendedPreset: presetMode, pages: profiles, detectedBanners: { topPct: 0, bottomPct: 0 } };
      const params = ParameterGenerator.generateAdaptiveForPage(profile, partialDoc, presetMode);
      if (input.customParams) Object.assign(params, input.customParams);
      const pageRes = await this.processPage(srcImageData, i - 1, params, profile);

      /* Thumbnail via shared canvas + blob URL (M-4) */
      const thumbnailDataUrl = await this.generateThumbnail(pageRes.optimizedImageData, i - 1);

      const origBlob = await memoryManager.imageDataToBlob(srcImageData, 0.85);
      const optBlob = await memoryManager.imageDataToBlob(pageRes.optimizedImageData, 0.88);

      /* Batched IDB write — enqueue instead of per-page transaction (H-5) */
      this.enqueueWrite({ pdfId, pageIndex: i - 1, originalBlob: origBlob, optimizedBlob: optBlob });

      memoryManager.disposeCanvas(canvas);
      processedPages[i - 1] = { pageIndex: i - 1, thumbnailDataUrl, profile, parameters: params,
        inkCoverageBeforePct: pageRes.inkCoverageBeforePct, inkCoverageAfterPct: pageRes.inkCoverageAfterPct,
        width: pageRes.optimizedImageData.width, height: pageRes.optimizedImageData.height, storageKey: pdfId };
      await memoryManager.yieldToUI();
    };

    if (concurrency <= 1) { for (let i = 1; i <= totalPages; i++) await processSinglePage(i); }
    else { let idx = 1; const run = async () => { while (idx <= totalPages) { const i = idx++; await processSinglePage(i); } };
      await Promise.all(Array.from({ length: concurrency }, () => run())); }

    /* Final flush — ensure all remaining writes are committed (H-5) */
    await this.flushRemainingWrites();

    const darkRatio = darkCount / totalPages;
    let recommended: PresetMode = presetMode;
    if (presetMode === 'AUTO_ADAPTIVE') { if (darkRatio > 0.6) recommended = 'PW_DARK_SLIDE'; else if (darkRatio < 0.2) recommended = 'LIGHT_HANDWRITTEN'; }
    const docProfile: DocumentProfile = { totalPages, averageBrightness: Math.round(sumBrightness / totalPages),
      darkSlideRatio: Number(darkRatio.toFixed(2)), recommendedPreset: recommended, pages: profiles,
      detectedBanners: { topPct: profiles.reduce((a, p) => Math.max(a, p?.topBannerHeightPct ?? 0), 0),
        bottomPct: profiles.reduce((a, p) => Math.max(a, p?.bottomBannerHeightPct ?? 0), 0) } };
    const totalMs = Math.round(performance.now() - t0);
    return { processedPages, docProfile, engineVersion: this.version, engineId: this.id, totalTimeMs: totalMs,
      metrics: { processingTimeMs: totalMs, pagesPerSecond: Number((totalPages / (totalMs / 1000)).toFixed(2)) } };
  }
}
