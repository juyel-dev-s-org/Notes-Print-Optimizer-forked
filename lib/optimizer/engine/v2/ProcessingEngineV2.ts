/**
 * ProcessingEngineV2 - Plugin-based pipeline engine with:
 * - Single PDF load (shared across plugins)
 * - Per-page error isolation with retry
 * - Feature-flag-aware execution paths
 * - Memory-efficient thumbnail generation with fallback
 * - Full disposal and cleanup
 */
import { PipelineController } from '../../../pipeline/PipelineController';
import { PluginRegistry } from '../../../pipeline/PluginRegistry';
import { RenderPlugin } from '../../../plugins/RenderPlugin';
import { AnalyzePlugin } from '../../../plugins/AnalyzePlugin';
import { ProcessPlugin } from '../../../plugins/ProcessPlugin';
import { ExportPlugin } from '../../../plugins/ExportPlugin';
import { LayoutPlugin } from '../../../plugins/LayoutPlugin';
import type { IProcessingEngine } from '../IProcessingEngine';
import type { EngineCapabilities, EngineDocumentInput, EngineDocumentOutput, EnginePageOptimizedCallback, EnginePageProcessResult, EngineProcessingOptions, EngineProgressCallback, EngineVersion } from '../types';
import type { PageProfile, ProcessedPage, LayoutConfig } from '../../types';
import type { PagePipelineResult } from '../../../pipeline/PipelineController';
import { memoryManager } from '../../memoryManager';
import { pwOptimizerStorage } from '../../storage';
import { featureFlags } from '../../features';
import { MetricsBus } from '../../../metrics/MetricsBus';

export class ProcessingEngineV2 implements IProcessingEngine {
  readonly id = 'pw-pixel-v2';
  readonly version: EngineVersion = 'v2';
  readonly name = 'PW Pipeline Engine v2';
  readonly description = 'Plugin-based pipeline with staged execution, retry, and memory management';
  readonly capabilities: EngineCapabilities = {
    supportsWebWorkers: typeof Worker !== 'undefined',
    supportsSmartColorRemap: true,
    supportsAutoBannerCrop: true,
    maxConcurrentPages: typeof navigator !== 'undefined' ? Math.min(navigator.hardwareConcurrency || 4, 8) : 4,
    engineDescription: 'v2: Plugin pipeline with bounded concurrency, retry, and adaptive memory.',
  };

  private controller: PipelineController;
  private metricsBus: MetricsBus;
  private activeThumbnailUrls: Set<string> = new Set();
  private disposed = false;

  constructor(layoutConfig?: LayoutConfig) {
    this.metricsBus = new MetricsBus(1000);
    const registry = new PluginRegistry();
    registry.register(new RenderPlugin());
    registry.register(new AnalyzePlugin());
    registry.register(new ProcessPlugin());
    if (layoutConfig) { registry.register(new LayoutPlugin()); registry.register(new ExportPlugin()); }
    const validation = registry.validate();
    if (!validation.valid) console.warn('[EngineV2] Plugin validation warnings:', validation.errors);
    this.controller = new PipelineController(registry, this.metricsBus);
  }

  getController(): PipelineController { return this.controller; }
  getMetricsBus(): MetricsBus { return this.metricsBus; }

  async analyzePage(imageData: ImageData, pageIndex: number): Promise<PageProfile> {
    const { analyzeImageData } = await import('../../analysis');
    return analyzeImageData(imageData, pageIndex);
  }

  async processPage(imageData: ImageData, pageIndex: number, params: import('../../types').ProcessingParameters, profile: PageProfile): Promise<EnginePageProcessResult> {
    const t0 = performance.now();
    const { processPage: runProcess, calculateInkCoverage, createImageDataFromBuffer } = await import('../../../kernels');
    const result = runProcess(imageData.data, imageData.width, imageData.height, params, profile);
    const optimizedImageData = createImageDataFromBuffer(result.buffer, result.width, result.height);
    const ib = calculateInkCoverage(imageData.data);
    const ia = calculateInkCoverage(new Uint8ClampedArray(result.buffer));
    return { pageIndex, optimizedImageData, inkCoverageBeforePct: ib, inkCoverageAfterPct: ia, processingTimeMs: Math.round(performance.now() - t0) };
  }

  async processDocument(input: EngineDocumentInput, options: EngineProcessingOptions = {}, onProgress?: EngineProgressCallback, onPageOptimized?: EnginePageOptimizedCallback): Promise<EngineDocumentOutput> {
    if (this.disposed) throw new Error('Engine has been disposed');
    const t0 = performance.now();
    const { pdfBuffer, pdfId } = input;
    this.cleanupThumbnails();
    featureFlags.init();

    const pdfjsLib = await (await import('../../pdfjsLoader')).getPdfjsLib();
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
    const totalPages = pdfDoc.numPages;
    pdfDoc.destroy();

    const { pages: pipelineResults, totalMetrics } = await this.controller.runDocument(pdfBuffer, {
      documentId: pdfId, totalPages, signal: options.signal,
      maxPageRetries: featureFlags.isEnabled('pipeline.retry_on_error') ? 2 : 0,
      onProgress: (pageIndex, total, phase) => { onProgress?.(pageIndex, total, `[Engine v2] ${phase} page ${pageIndex}/${total}`); },
    });

    const results: PagePipelineResult[] = [];
    const profiles: PageProfile[] = [];
    let sumBrightness = 0; let darkCount = 0;

    for (const result of pipelineResults) {
      if (options.signal?.aborted) break;
      profiles.push(result.profile);
      sumBrightness += result.profile.averageBrightness;
      if (result.profile.classification === 'DARK_SLIDE') darkCount++;
      let thumbUrl = '';
      try { thumbUrl = await this.generateThumbnail(result.optimizedImageData); this.activeThumbnailUrls.add(thumbUrl); } catch { thumbUrl = ''; }
      onPageOptimized?.(result.pageIndex, thumbUrl, result.inkBefore, result.inkAfter);
      result.thumbnailUrl = thumbUrl;
      results.push(result);
      this.persistPage(pdfId, result).catch(() => { /* non-fatal */ });
    }

    const darkRatio = totalPages > 0 ? darkCount / totalPages : 0;
    const docProfile = { totalPages, averageBrightness: totalPages > 0 ? Math.round(sumBrightness / totalPages) : 0, darkSlideRatio: Number(darkRatio.toFixed(2)), recommendedPreset: darkRatio > 0.6 ? 'PW_DARK_SLIDE' : 'LIGHT_HANDWRITTEN', pages: profiles, detectedBanners: { topPct: profiles.reduce((a, p) => Math.max(a, p?.topBannerHeightPct ?? 0), 0), bottomPct: profiles.reduce((a, p) => Math.max(a, p?.bottomBannerHeightPct ?? 0), 0) } };

    const processedPages: ProcessedPage[] = results.map((r) => ({ pageIndex: r.pageIndex, thumbnailDataUrl: r.thumbnailUrl || '', profile: r.profile, parameters: {} as any, inkCoverageBeforePct: r.inkBefore, inkCoverageAfterPct: r.inkAfter, width: r.optimizedImageData.width, height: r.optimizedImageData.height, storageKey: pdfId }));

    return { processedPages, docProfile: docProfile as any, engineVersion: this.version, engineId: this.id, totalTimeMs: totalMetrics.durationMs, metrics: { processingTimeMs: totalMetrics.durationMs, pagesPerSecond: totalMetrics.pagesPerSecond } };
  }

  private async persistPage(pdfId: string, result: PagePipelineResult): Promise<void> {
    const origBlob = await memoryManager.imageDataToBlob(result.imageData, 0.75);
    const optBlob = await memoryManager.imageDataToBlob(result.optimizedImageData, 0.88);
    await pwOptimizerStorage.storePagesBatch([{ pdfId, pageIndex: result.pageIndex, originalBlob: origBlob, optimizedBlob: optBlob }]);
  }

  private async generateThumbnail(imageData: ImageData): Promise<string> {
    const tw = Math.max(1, Math.round(imageData.width / 4));
    const th = Math.max(1, Math.round(imageData.height / 4));
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(tw, th); const ctx = canvas.getContext('2d');
      if (ctx) { const tmp = new OffscreenCanvas(imageData.width, imageData.height); const tmpCtx = tmp.getContext('2d');
        if (tmpCtx) { tmpCtx.putImageData(imageData, 0, 0); ctx.drawImage(tmp, 0, 0, tw, th);
          const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.6 }); return URL.createObjectURL(blob); } }
    }
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas'); canvas.width = tw; canvas.height = th;
      const ctx = canvas.getContext('2d');
      if (ctx) { const tmp = document.createElement('canvas'); tmp.width = imageData.width; tmp.height = imageData.height;
        const tmpCtx = tmp.getContext('2d');
        if (tmpCtx) { tmpCtx.putImageData(imageData, 0, 0); ctx.drawImage(tmp, 0, 0, tw, th);
          const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.6));
          if (blob) return URL.createObjectURL(blob); } }
    }
    return '';
  }

  private cleanupThumbnails(): void { for (const url of this.activeThumbnailUrls) { try { URL.revokeObjectURL(url); } catch { /* */ } } this.activeThumbnailUrls.clear(); }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.controller.dispose(); this.cleanupThumbnails(); this.metricsBus.clearHistory(); }
}
