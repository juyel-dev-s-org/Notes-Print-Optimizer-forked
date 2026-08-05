import { IProcessingEngine } from '../IProcessingEngine';
import type { EngineCapabilities, EngineDocumentInput, EngineDocumentOutput, EnginePageOptimizedCallback, EnginePageProcessResult, EngineProcessingOptions, EngineProgressCallback, EngineVersion } from '../types';
import { DocumentProfile, PageProfile, PresetMode, ProcessedPage, ProcessingParameters } from '../../types';
import { ParameterGenerator } from '../../parameterGenerator';
import { memoryManager } from '../../memoryManager';
import { pwOptimizerStorage } from '../../storage';
import { getPdfjsLib } from '../../pdfjsLoader';
import { canCreateImageBitmap, featureFlags } from '../../features';
import type { IImageProcessor } from '../../processor/IImageProcessor';
import { metricsBus } from '../../../metrics/MetricsBus';
import { ensureWasmKernels, isWasmLoaded, getKernels } from '../../../wasm/loader';
import { setWasmKernelsHooks, clearWasmKernelsHooks } from '../../../kernels/processPage';

/** Batched IDB write queue — reduces per-page transactions (H-5). */
interface PendingWrite {
  pdfId: string;
  pageIndex: number;
  originalBlob: Blob | null;
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

  private processor: IImageProcessor;

  constructor(processor: IImageProcessor) {
    this.processor = processor;
  }

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

  /* ── Thumbnail generation ── */
  private thumbUrls: Map<number, string> = new Map();

  private revokeThumbUrls(): void {
    this.thumbUrls.forEach((url) => {
      try { URL.revokeObjectURL(url); } catch { /* noop */ }
    });
    this.thumbUrls.clear();
  }

  private async generateThumbnail(imageData: ImageData, pageIndex: number): Promise<string> {
    const tw = Math.max(1, Math.round(imageData.width / 4));
    const th = Math.max(1, Math.round(imageData.height / 4));

    if (canCreateImageBitmap()) {
      try {
        const bmp = await createImageBitmap(imageData, {
          resizeWidth: tw, resizeHeight: th, resizeQuality: 'medium',
        });
        const canvas = document.createElement('canvas');
        canvas.width = tw; canvas.height = th;
        canvas.getContext('2d')!.drawImage(bmp, 0, 0);
        bmp.close();
        const url = await encodeCanvasJpeg(canvas, 0.6);
        memoryManager.disposeCanvas(canvas);
        this.updateThumbUrl(pageIndex, url);
        return url;
      } catch { /* fall through to fallback */ }
    }

    const canvas = document.createElement('canvas');
    canvas.width = tw; canvas.height = th;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const tmp = document.createElement('canvas');
    tmp.width = imageData.width; tmp.height = imageData.height;
    tmp.getContext('2d')!.putImageData(imageData, 0, 0);
    ctx.drawImage(tmp, 0, 0, tw, th);
    memoryManager.disposeCanvas(tmp);
    const url = await encodeCanvasJpeg(canvas, 0.6);
    memoryManager.disposeCanvas(canvas);
    this.updateThumbUrl(pageIndex, url);
    return url;
  }

  private updateThumbUrl(pageIndex: number, url: string): void {
    const prev = this.thumbUrls.get(pageIndex);
    if (prev && prev.startsWith('blob:')) {
      try { URL.revokeObjectURL(prev); } catch { /* noop */ }
    }
    this.thumbUrls.set(pageIndex, url);
  }

  /** Release thumbnail resources. Call when the engine is no longer needed. */
  public dispose(): void {
    this.revokeThumbUrls();
  }

  /* ── Public API ── */

  public async analyzePage(imageData: ImageData, pageIndex: number): Promise<PageProfile> {
    return this.processor.analyzePage(imageData, pageIndex);
  }

  public async processPage(imageData: ImageData, pageIndex: number, params: ProcessingParameters, profile: PageProfile): Promise<EnginePageProcessResult> {
    const t0 = performance.now();
    const res = await this.processor.processPage(imageData, pageIndex, params, profile);
    return { pageIndex: res.pageIndex, optimizedImageData: res.optimizedImageData,
      inkCoverageBeforePct: res.inkCoverageBeforePct, inkCoverageAfterPct: res.inkCoverageAfterPct,
      processingTimeMs: Math.round(performance.now() - t0) };
  }

  public async processDocument(input: EngineDocumentInput, options: EngineProcessingOptions = {}, onProgress?: EngineProgressCallback, onPageOptimized?: EnginePageOptimizedCallback): Promise<EngineDocumentOutput> {
    const t0 = performance.now();
    const { pdfBuffer, pdfId, presetMode = 'AUTO_ADAPTIVE' } = input;
    const userRenderScale = options.renderScale ?? null;
    /* Phase-2: WASM kernels are experimental and OFF by default (feature flag
       engine.v2.wasm_kernels). The pure-JS kernels are the stable, proven path.
       Clear stale hooks so a previous run can't leak WASM into this document. */
    clearWasmKernelsHooks();
    if (featureFlags.isEnabled('engine.v2.wasm_kernels')) {
      try {
        await ensureWasmKernels();
        if (isWasmLoaded()) setWasmKernelsHooks(getKernels());
      } catch { /* wasm unavailable - JS path */ }
    }

    const pdfjsLib = await getPdfjsLib();
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
    const totalPages = pdfDoc.numPages;
    const profiles: PageProfile[] = new Array(totalPages);
    const processedPages: ProcessedPage[] = new Array(totalPages);
    let sumBrightness = 0, darkCount = 0;
    /* Phase-0 instrumentation: per-phase timing accumulators */
    let sumRenderMs = 0, sumAnalyzeMs = 0, sumProcessMs = 0, sumThumbMs = 0, sumPersistMs = 0;

    /* Reset write queue for new document (H-5) */
    this.writeQueue = [];
    this.flushChain = Promise.resolve();

    /* Reset thumbnail state for new document */
    this.revokeThumbUrls();

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

      /* Phase-0 instrumentation */
      let t = performance.now();
      await page.render({ canvasContext: ctx, viewport }).promise;
      const srcImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const renderMs = performance.now() - t;

      t = performance.now();
      const profile = await this.processor.analyzePage(srcImageData, i - 1);
      const analyzeMs = performance.now() - t;
      profiles[i - 1] = profile; sumBrightness += profile.averageBrightness;
      if (profile.classification === 'DARK_SLIDE') darkCount++;
      const partialDoc: DocumentProfile = { totalPages, averageBrightness: 128, darkSlideRatio: 0.5,
        recommendedPreset: presetMode, pages: profiles, detectedBanners: { topPct: 0, bottomPct: 0 } };
      const params = ParameterGenerator.generateAdaptiveForPage(profile, partialDoc, presetMode);
      if (input.customParams) Object.assign(params, input.customParams);

      t = performance.now();
      /* Robustness: one page failing must never abort the whole document.
         Fall back to the original render if processing throws. */
      let pageRes: EnginePageProcessResult;
      try {
        pageRes = await this.processPage(srcImageData, i - 1, params, profile);
      } catch (procErr) {
        console.warn(`[V1] processPage failed on page ${i}, using original render:`, procErr);
        pageRes = { pageIndex: i - 1, optimizedImageData: srcImageData,
          inkCoverageBeforePct: 0, inkCoverageAfterPct: 0, processingTimeMs: 0 };
      }
      const processMs = performance.now() - t;

      /* Thumbnail via shared canvas + blob URL (M-4) */
      t = performance.now();
      const thumbnailDataUrl = await this.generateThumbnail(pageRes.optimizedImageData, i - 1);
      const thumbnailMs = performance.now() - t;

      if (onPageOptimized) {
        onPageOptimized(i - 1, thumbnailDataUrl, pageRes.inkCoverageBeforePct, pageRes.inkCoverageAfterPct);
      }

      t = performance.now();
      const optBlob = await memoryManager.imageDataToBlob(pageRes.optimizedImageData, 0.88);

      /* Batched IDB write — original is re-rendered lazily for before/after (Phase-1) */
      this.enqueueWrite({ pdfId, pageIndex: i - 1, originalBlob: null, optimizedBlob: optBlob });
      const persistMs = performance.now() - t;

      /* Phase-0: accumulate + emit per-phase timing */
      sumRenderMs += renderMs; sumAnalyzeMs += analyzeMs; sumProcessMs += processMs;
      sumThumbMs += thumbnailMs; sumPersistMs += persistMs;
      metricsBus.emit({ type: 'page:phases', timestamp: Date.now(), pageIndex: i - 1,
        renderMs, analyzeMs, processMs, thumbnailMs, persistMs,
        durationMs: renderMs + analyzeMs + processMs + thumbnailMs + persistMs });

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
    /* Phase-0: emit document-level phase summary */
    metricsBus.emit({ type: 'doc:phases', timestamp: Date.now(), durationMs: totalMs,
      totalPages, pagesPerSecond: Number((totalPages / (totalMs / 1000)).toFixed(2)),
      renderMs: sumRenderMs, analyzeMs: sumAnalyzeMs, processMs: sumProcessMs,
      thumbnailMs: sumThumbMs, persistMs: sumPersistMs });
    return { processedPages, docProfile, engineVersion: this.version, engineId: this.id, totalTimeMs: totalMs,
      metrics: { processingTimeMs: totalMs, pagesPerSecond: Number((totalPages / (totalMs / 1000)).toFixed(2)) } };
  }
}

function encodeCanvasJpeg(canvas: HTMLCanvasElement, quality: number): Promise<string> {
  if (typeof canvas.toBlob === 'function') {
    return new Promise<string>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(URL.createObjectURL(blob));
        else resolve(canvas.toDataURL('image/jpeg', quality));
      }, 'image/jpeg', quality);
    });
  }
  return Promise.resolve(canvas.toDataURL('image/jpeg', quality));
}
