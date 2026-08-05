/**
 * ProcessingEngineV2 - Memory-optimized pipeline engine (Production).
 *
 * Key optimizations for 4 GB RAM phones & 250+ page documents:
 *  - Hoisted imports: zero per-page dynamic import overhead
 *  - Sequential page processing with immediate IndexedDB persistence
 *  - ImageData released after each page (never accumulated)
 *  - Adaptive render scale based on device memory / live pressure
 *  - DOM-canvas fallback when OffscreenCanvas is unavailable
 *  - Cooperative UI yielding between pages (prevents ANR)
 *  - MemoryGuard pressure checks with buffer pool shrink
 *  - Zero-copy ink coverage (passes ArrayBuffer directly)
 *  - Batched IDB writes (reduces transaction overhead)
 *  - Adaptive yield frequency per device class
 */
import { PipelineController } from '../../../pipeline/PipelineController';
import { PluginRegistry } from '../../../pipeline/PluginRegistry';
import { RenderPlugin } from '../../../plugins/RenderPlugin';
import { AnalyzePlugin } from '../../../plugins/AnalyzePlugin';
import { ProcessPlugin } from '../../../plugins/ProcessPlugin';
import type { IProcessingEngine } from '../IProcessingEngine';
import type {
  EngineCapabilities,
  EngineDocumentInput,
  EngineDocumentOutput,
  EnginePageOptimizedCallback,
  EnginePageProcessResult,
  EngineProcessingOptions,
  EngineProgressCallback,
  EngineVersion,
} from '../types';
import type { PageProfile, ProcessedPage, LayoutConfig } from '../../types';
import { memoryManager } from '../../memoryManager';
import { pwOptimizerStorage } from '../../storage';
import { memoryGuard } from '../../../pipeline/MemoryGuard';
import { detectDeviceProfile } from '../../../pipeline/types';
import { bufferPool } from '../../perf/bufferPool';

/* Hoisted imports: eliminate per-page dynamic import overhead */
import { analyzeImageData } from '../../analysis';
import {
  processPage as runProcessPage,
  calculateInkCoverage,
  createImageDataFromBuffer,
} from '../../../kernels';
import { ParameterGenerator } from '../../parameterGenerator';
import { getPdfjsLib } from '../../pdfjsLoader';
import { metricsBus } from '../../../metrics/MetricsBus';
import { ensureWasmKernels, isWasmLoaded, getKernels } from '../../../wasm/loader';
import { setWasmKernelsHooks, clearWasmKernelsHooks } from '../../../kernels/processPage';
import { featureFlags } from '../../features';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function adaptiveScale(): number {
  const dev = detectDeviceProfile();
  const pressureMul = memoryGuard.isCritical() ? 0.8 : memoryGuard.isUnderPressure() ? 0.9 : 1.0;
  if (dev.isMobile || dev.memoryGB <= 4) return 1.2 * pressureMul;
  if (dev.isTablet || dev.memoryGB <= 8) return 1.5 * pressureMul;
  return 1.8 * pressureMul;
}

function createCanvas2D(w: number, h: number): {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: any;
  isOffscreen: boolean;
} | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const c = new OffscreenCanvas(w, h);
      const ctx = c.getContext('2d');
      if (ctx) return { canvas: c, ctx, isOffscreen: true };
    } catch { /* fall through */ }
  }
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (ctx) return { canvas: c, ctx, isOffscreen: false };
  }
  return null;
}

async function canvasToBlob(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  isOffscreen: boolean,
  type = 'image/jpeg',
  quality = 0.6,
): Promise<Blob | null> {
  if (isOffscreen && 'convertToBlob' in canvas) {
    return (canvas as OffscreenCanvas).convertToBlob({ type, quality });
  }
  return new Promise(res => (canvas as HTMLCanvasElement).toBlob(res, type, quality));
}

async function yieldToUI(): Promise<void> {
  const sched = (globalThis as any).scheduler;
  if (sched?.yield) { await sched.yield(); return; }
  if (typeof MessageChannel !== 'undefined') {
    return new Promise(res => {
      const { port1, port2 } = new MessageChannel();
      port2.onmessage = () => res();
      port1.postMessage(null);
    });
  }
  return new Promise(res => setTimeout(res, 0));
}

function freeCanvas(c: OffscreenCanvas | HTMLCanvasElement, isOffscreen: boolean): void {
  if (!isOffscreen) {
    const el = c as HTMLCanvasElement;
    el.width = 0;
    el.height = 0;
  }
}

/* ------------------------------------------------------------------ */
/*  Engine                                                             */
/* ------------------------------------------------------------------ */

export class ProcessingEngineV2 implements IProcessingEngine {
  readonly id = 'pw-pixel-v2';
  readonly version: EngineVersion = 'v2';
  readonly name = 'PW Pipeline Engine v2';
  readonly description =
    'Memory-optimized sequential pipeline for large documents on low-RAM devices';

  readonly capabilities: EngineCapabilities = {
    supportsWebWorkers: typeof Worker !== 'undefined',
    supportsSmartColorRemap: true,
    supportsAutoBannerCrop: true,
    maxConcurrentPages: 1,
    engineDescription:
      'v2: Sequential pipeline with immediate persistence & adaptive quality.',
  };

  private controller: PipelineController;
  private activeThumbnailUrls: Set<string> = new Set();
  private disposed = false;
  private abortController: AbortController | null = null;

  constructor(_layoutConfig?: LayoutConfig) {
    const registry = new PluginRegistry();
    registry.register(new RenderPlugin());
    registry.register(new AnalyzePlugin());
    registry.register(new ProcessPlugin());
    this.controller = new PipelineController(registry);
  }

  getController(): PipelineController {
    return this.controller;
  }

  async analyzePage(imageData: ImageData, pageIndex: number): Promise<PageProfile> {
    return analyzeImageData(imageData, pageIndex);
  }

  async processPage(
    imageData: ImageData,
    pageIndex: number,
    params: import('../../types').ProcessingParameters,
    profile: PageProfile,
  ): Promise<EnginePageProcessResult> {
    const t0 = performance.now();
    let result: ReturnType<typeof runProcessPage>;
    try {
      result = runProcessPage(
        imageData.data, imageData.width, imageData.height, params, profile,
      );
    } catch (procErr) {
      console.warn(`[V2] processPage failed on page ${pageIndex}, using original render:`, procErr);
      result = {
        buffer: new Uint8ClampedArray(imageData.data).buffer,
        width: imageData.width,
        height: imageData.height,
      };
    }
    const optimizedImageData = createImageDataFromBuffer(
      result.buffer, result.width, result.height,
    );
    const ib = calculateInkCoverage(imageData.data);
    const ia = calculateInkCoverage(result.buffer);
    return {
      pageIndex,
      optimizedImageData,
      inkCoverageBeforePct: ib,
      inkCoverageAfterPct: ia,
      processingTimeMs: Math.round(performance.now() - t0),
    };
  }

  async processDocument(
    input: EngineDocumentInput,
    options: EngineProcessingOptions = {},
    onProgress?: EngineProgressCallback,
    onPageOptimized?: EnginePageOptimizedCallback,
  ): Promise<EngineDocumentOutput> {
    if (this.disposed) throw new Error('Engine has been disposed');

    const t0 = performance.now();
    const { pdfBuffer, pdfId } = input;
    const signal = options.signal;

    this.cleanupThumbnails();
    this.abortController = new AbortController();
    const localSignal = this.abortController.signal;

    if (signal) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      signal.addEventListener('abort', () => this.abortController?.abort(), { once: true });
    }

    /* Phase-2: WASM kernels are experimental and OFF by default (feature flag
       engine.v2.wasm_kernels). The pure-JS kernels are the stable, proven path.
       Always clear stale hooks first so a previous run can never leak WASM
       kernels into this document. */
    clearWasmKernelsHooks();
    if (featureFlags.isEnabled('engine.v2.wasm_kernels')) {
      try {
        await ensureWasmKernels();
        if (isWasmLoaded()) setWasmKernelsHooks(getKernels());
      } catch { /* wasm unavailable - JS path */ }
    }

    const pdfjsLib = await getPdfjsLib();
    const pdfDoc = await pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
    }).promise;
    const totalPages = pdfDoc.numPages;
    const scale = adaptiveScale();
    const device = detectDeviceProfile();
    const isLowEnd = device.isMobile || device.memoryGB <= 4;
    const yieldEveryNPages = isLowEnd ? 1 : device.isTablet ? 3 : 5;

    const profiles: PageProfile[] = [];
    const pageMeta: Array<{
      pageIndex: number;
      thumbnailUrl: string;
      inkBefore: number;
      inkAfter: number;
      width: number;
      height: number;
      profile: PageProfile;
    }> = [];

    let sumBrightness = 0;
    let darkCount = 0;
    /* Phase-0 instrumentation: per-phase timing accumulators */
    let sumRenderMs = 0, sumAnalyzeMs = 0, sumProcessMs = 0, sumThumbMs = 0, sumPersistMs = 0;

    /* Batched IDB writes */
    const idbBatch: Array<{ pdfId: string; pageIndex: number; originalBlob: Blob | null; optimizedBlob: Blob }> = [];
    const IDB_BATCH_SIZE = isLowEnd ? 2 : 4;
    let idbFlushChain: Promise<void> = Promise.resolve();

    const flushIdb = (): void => {
      if (idbBatch.length === 0) return;
      const batch = idbBatch.splice(0, idbBatch.length);
      idbFlushChain = idbFlushChain
        .then(() => pwOptimizerStorage.storePagesBatch(batch))
        .catch(e => console.warn('[V2] IDB batch write failed:', e));
    };

    for (let i = 1; i <= totalPages; i++) {
      if (localSignal.aborted) throw new DOMException('Aborted', 'AbortError');

      onProgress?.(i - 1, totalPages, `[V2] Rendering page ${i}/${totalPages}`);

      /* Phase 1: Render */
      let tPhase = performance.now();
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale });
      const vw = Math.ceil(viewport.width);
      const vh = Math.ceil(viewport.height);

      const renderTarget = createCanvas2D(vw, vh);
      if (!renderTarget) throw new Error(`Cannot create canvas for page ${i}`);

      await page.render({
        canvasContext: renderTarget.ctx as CanvasRenderingContext2D,
        viewport,
      }).promise;

      const srcImageData: ImageData = renderTarget.ctx.getImageData(0, 0, vw, vh);
      const renderMs = performance.now() - tPhase;
      freeCanvas(renderTarget.canvas, renderTarget.isOffscreen);
      page.cleanup();

      if (localSignal.aborted) throw new DOMException('Aborted', 'AbortError');

      /* Phase 2: Analyze */
      tPhase = performance.now();
      const profile = analyzeImageData(srcImageData, i - 1);
      const analyzeMs = performance.now() - tPhase;
      profiles.push(profile);
      sumBrightness += profile.averageBrightness;
      if (profile.classification === 'DARK_SLIDE') darkCount++;

      /* Phase 3: Process (merge preset defaults with user overrides) */
      tPhase = performance.now();
      const baseParams = ParameterGenerator.getPresetParameters(
        profile.classification === 'DARK_SLIDE' ? 'PW_DARK_SLIDE' : 'LIGHT_HANDWRITTEN',
      );
      const params = input.customParams
        ? { ...baseParams, ...input.customParams }
        : baseParams;
      /* Robustness: one page failing must never abort the whole document.
         Fall back to the original render if processing throws. */
      let procResult: ReturnType<typeof runProcessPage>;
      try {
        procResult = runProcessPage(
          srcImageData.data, srcImageData.width, srcImageData.height, params, profile,
        );
      } catch (procErr) {
        console.warn(`[V2] processPage failed on page ${i}, using original render:`, procErr);
        procResult = {
          buffer: new Uint8ClampedArray(srcImageData.data).buffer,
          width: srcImageData.width,
          height: srcImageData.height,
        };
      }

      /* Zero-copy ink coverage on raw buffers */
      const inkBefore = calculateInkCoverage(srcImageData.data);
      const inkAfter = calculateInkCoverage(procResult.buffer);

      const optimizedImageData = createImageDataFromBuffer(
        procResult.buffer, procResult.width, procResult.height,
      );
      const processMs = performance.now() - tPhase;

      if (localSignal.aborted) throw new DOMException('Aborted', 'AbortError');

      /* Phase 4: Thumbnail */
      tPhase = performance.now();
      let thumbUrl = '';
      try {
        thumbUrl = await this.generateThumbnail(optimizedImageData);
        if (thumbUrl) this.activeThumbnailUrls.add(thumbUrl);
      } catch { /* non-fatal */ }

      const thumbnailMs = performance.now() - tPhase;

      onPageOptimized?.(i - 1, thumbUrl, inkBefore, inkAfter);

      /* Phase 5: Persist (batched) — original re-rendered lazily for before/after (Phase-1) */
      tPhase = performance.now();
      try {
        const optBlob = await memoryManager.imageDataToBlob(optimizedImageData, 0.88);
        idbBatch.push({ pdfId, pageIndex: i - 1, originalBlob: null, optimizedBlob: optBlob });
        if (idbBatch.length >= IDB_BATCH_SIZE) flushIdb();
      } catch (e) {
        console.warn(`[V2] Persist failed page ${i}:`, e);
      }
      const persistMs = performance.now() - tPhase;

      /* Phase-0 instrumentation: emit per-phase timing */
      sumRenderMs += renderMs; sumAnalyzeMs += analyzeMs; sumProcessMs += processMs;
      sumThumbMs += thumbnailMs; sumPersistMs += persistMs;
      metricsBus.emit({ type: 'page:phases', timestamp: Date.now(), pageIndex: i - 1,
        renderMs, analyzeMs, processMs, thumbnailMs, persistMs,
        durationMs: renderMs + analyzeMs + processMs + thumbnailMs + persistMs });

      pageMeta.push({
        pageIndex: i - 1,
        thumbnailUrl: thumbUrl,
        inkBefore,
        inkAfter,
        width: optimizedImageData.width,
        height: optimizedImageData.height,
        profile,
      });

      onProgress?.(i, totalPages, `[V2] Completed page ${i}/${totalPages}`);

      /* Cooperative yielding & memory pressure */
      if (i % yieldEveryNPages === 0 || isLowEnd) {
        await yieldToUI();
      }
      if (memoryGuard.isCritical()) {
        bufferPool.shrink(8);
        await new Promise(r => setTimeout(r, 200));
      } else if (memoryGuard.isUnderPressure()) {
        bufferPool.shrink(16);
      }
    }

    flushIdb();
    await idbFlushChain;
    try { pdfDoc.destroy(); } catch { /* */ }

    const darkRatio = totalPages > 0 ? darkCount / totalPages : 0;
    const docProfile = {
      totalPages,
      averageBrightness: totalPages > 0 ? Math.round(sumBrightness / totalPages) : 0,
      darkSlideRatio: Number(darkRatio.toFixed(2)),
      recommendedPreset: darkRatio > 0.6 ? 'PW_DARK_SLIDE' : 'LIGHT_HANDWRITTEN',
      pages: profiles,
      detectedBanners: {
        topPct: profiles.reduce((a, p) => Math.max(a, p?.topBannerHeightPct ?? 0), 0),
        bottomPct: profiles.reduce((a, p) => Math.max(a, p?.bottomBannerHeightPct ?? 0), 0),
      },
    };

    const processedPages: ProcessedPage[] = pageMeta.map(m => ({
      pageIndex: m.pageIndex,
      thumbnailDataUrl: m.thumbnailUrl,
      profile: m.profile,
      parameters: {} as any,
      inkCoverageBeforePct: m.inkBefore,
      inkCoverageAfterPct: m.inkAfter,
      width: m.width,
      height: m.height,
      storageKey: pdfId,
    }));

    const totalMs = Math.round(performance.now() - t0);
    /* Phase-0: emit document-level phase summary */
    metricsBus.emit({ type: 'doc:phases', timestamp: Date.now(), durationMs: totalMs,
      totalPages, pagesPerSecond: Number((totalPages / (totalMs / 1000)).toFixed(2)),
      renderMs: sumRenderMs, analyzeMs: sumAnalyzeMs, processMs: sumProcessMs,
      thumbnailMs: sumThumbMs, persistMs: sumPersistMs });
    return {
      processedPages,
      docProfile: docProfile as any,
      engineVersion: this.version,
      engineId: this.id,
      totalTimeMs: totalMs,
      metrics: {
        processingTimeMs: totalMs,
        pagesPerSecond: Number((totalPages / (totalMs / 1000)).toFixed(2)),
      },
    };
  }

  private async generateThumbnail(imageData: ImageData): Promise<string> {
    const tw = Math.max(1, Math.round(imageData.width / 5));
    const th = Math.max(1, Math.round(imageData.height / 5));

    const target = createCanvas2D(tw, th);
    if (!target) return '';
    const src = createCanvas2D(imageData.width, imageData.height);
    if (!src) { freeCanvas(target.canvas, target.isOffscreen); return ''; }

    src.ctx.putImageData(imageData, 0, 0);
    target.ctx.drawImage(src.canvas as any, 0, 0, tw, th);
    freeCanvas(src.canvas, src.isOffscreen);

    const blob = await canvasToBlob(target.canvas, target.isOffscreen, 'image/jpeg', 0.55);
    freeCanvas(target.canvas, target.isOffscreen);
    if (!blob) return '';
    return URL.createObjectURL(blob);
  }

  private cleanupThumbnails(): void {
    for (const url of this.activeThumbnailUrls) {
      try { URL.revokeObjectURL(url); } catch { /* */ }
    }
    this.activeThumbnailUrls.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.abortController?.abort();
    this.controller.abort();
    this.cleanupThumbnails();
    bufferPool.shrink(0);
  }
}
