import { PipelineController } from '../../../pipeline/PipelineController';
import { PluginRegistry } from '../../../pipeline/PluginRegistry';
import { RenderPlugin } from '../../../plugins/RenderPlugin';
import { AnalyzePlugin } from '../../../plugins/AnalyzePlugin';
import { ProcessPlugin } from '../../../plugins/ProcessPlugin';
import type { IProcessingEngine } from '../IProcessingEngine';
import type { EngineCapabilities, EngineDocumentInput, EngineDocumentOutput, EnginePageOptimizedCallback, EnginePageProcessResult, EngineProcessingOptions, EngineProgressCallback, EngineVersion } from '../types';
import type { PageProfile, ProcessedPage } from '../../types';
import type { PagePipelineResult } from '../../../pipeline/PipelineController';
import { memoryManager } from '../../memoryManager';
import { pwOptimizerStorage } from '../../storage';
import type { LayoutConfig } from '../../types';
import { ExportPlugin } from '../../../plugins/ExportPlugin';
import { LayoutPlugin } from '../../../plugins/LayoutPlugin';

export class ProcessingEngineV2 implements IProcessingEngine {
  readonly id = 'pw-pixel-v2';
  readonly version: EngineVersion = 'v2';
  readonly name = 'PW Pipeline Engine v2';
  readonly description = 'Plugin-based pipeline with staged execution per page';
  readonly capabilities: EngineCapabilities = {
    supportsWebWorkers: true,
    supportsSmartColorRemap: true,
    supportsAutoBannerCrop: true,
    maxConcurrentPages: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
    engineDescription: 'v2: Plugin pipeline with bounded concurrency.',
  };
  private controller: PipelineController;
  private activeThumbnailUrls: Set<string> = new Set();

  constructor(layoutConfig?: LayoutConfig) {
    const registry = new PluginRegistry();

    const renderPlugin = new RenderPlugin();
    const analyzePlugin = new AnalyzePlugin();
    const processPlugin = new ProcessPlugin();

    registry.register(renderPlugin);
    registry.register(analyzePlugin);
    registry.register(processPlugin);

    if (layoutConfig) {
      registry.register(new LayoutPlugin());
      registry.register(new ExportPlugin());
    }

    this.controller = new PipelineController(registry);
  }

  getController(): PipelineController {
    return this.controller;
  }

  async analyzePage(imageData: ImageData, pageIndex: number): Promise<PageProfile> {
    const { analyzeImageData } = await import('../../analysis');
    return analyzeImageData(imageData, pageIndex);
  }

  async processPage(
    imageData: ImageData,
    pageIndex: number,
    params: import('../../types').ProcessingParameters,
    profile: PageProfile
  ): Promise<EnginePageProcessResult> {
    const t0 = performance.now();
    const { processPage: runProcess, calculateInkCoverage, createImageDataFromBuffer } = await import('../../../kernels');
    const result = runProcess(imageData.data, imageData.width, imageData.height, params, profile);
    const optimizedImageData = createImageDataFromBuffer(result.buffer, result.width, result.height);
    const ib = calculateInkCoverage(imageData.data);
    const ia = calculateInkCoverage(new Uint8ClampedArray(result.buffer));

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
    const t0 = performance.now();
    const { pdfBuffer, pdfId, presetMode } = input;
    
    // Clear previous thumbnails to prevent memory leaks
    this.activeThumbnailUrls.forEach(url => URL.revokeObjectURL(url));
    this.activeThumbnailUrls.clear();

    // Get total pages first to inform the pipeline controller
    const pdfjsLib = await (await import('../../pdfjsLoader')).getPdfjsLib();
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
    const totalPages = pdfDoc.numPages;

    const { pages: pipelineResults, totalMetrics } = await this.controller.runDocument(pdfBuffer, {
      documentId: pdfId,
      totalPages,
      signal: options.signal,
      onProgress: (pageIndex, total, phase) => {
        if (onProgress) onProgress(pageIndex, total, `[Engine v2] ${phase} page ${pageIndex}/${total}`);
      }
    });
    
    const results: PagePipelineResult[] = [];
    const profiles: PageProfile[] = [];
    let sumBrightness = 0, darkCount = 0;

    for (const result of pipelineResults) {
      profiles.push(result.profile);
      sumBrightness += result.profile.averageBrightness;
      if (result.profile.classification === 'DARK_SLIDE') darkCount++;

      // Generate thumbnail and track it for cleanup
      const thumbDataUrl = await this.generateThumbnail(result.optimizedImageData);
      this.activeThumbnailUrls.add(thumbDataUrl);

      if (onPageOptimized) {
        onPageOptimized(result.pageIndex, thumbDataUrl, result.inkBefore, result.inkAfter);
      }

      // Update result with thumbnail
      result.thumbnailUrl = thumbDataUrl;
      results.push(result);

      // Store blobs
      const origBlob = await memoryManager.imageDataToBlob(result.imageData, 0.75);
      const optBlob = await memoryManager.imageDataToBlob(result.optimizedImageData, 0.88);
      await pwOptimizerStorage.storePagesBatch([{ pdfId, pageIndex: result.pageIndex, originalBlob: origBlob, optimizedBlob: optBlob }]);
    }

    const darkRatio = darkCount / totalPages;
    const docProfile = {
      totalPages,
      averageBrightness: Math.round(sumBrightness / totalPages),
      darkSlideRatio: Number(darkRatio.toFixed(2)),
      recommendedPreset: darkRatio > 0.6 ? 'PW_DARK_SLIDE' : 'LIGHT_HANDWRITTEN',
      pages: profiles,
      detectedBanners: {
        topPct: profiles.reduce((a, p) => Math.max(a, p?.topBannerHeightPct ?? 0), 0),
        bottomPct: profiles.reduce((a, p) => Math.max(a, p?.bottomBannerHeightPct ?? 0), 0),
      },
    };

    const processedPages: ProcessedPage[] = results.map((r) => ({
      pageIndex: r.pageIndex,
      thumbnailDataUrl: r.thumbnailUrl || '',
      profile: r.profile,
      parameters: {} as any,
      inkCoverageBeforePct: r.inkBefore,
      inkCoverageAfterPct: r.inkAfter,
      width: r.optimizedImageData.width,
      height: r.optimizedImageData.height,
      storageKey: pdfId,
    }));

    return {
      processedPages,
      docProfile: docProfile as any,
      engineVersion: this.version,
      engineId: this.id,
      totalTimeMs: totalMetrics.durationMs,
      metrics: {
        processingTimeMs: totalMetrics.durationMs,
        pagesPerSecond: totalMetrics.pagesPerSecond,
      },
    };
  }

  private async generateThumbnail(imageData: ImageData): Promise<string> {
    const tw = Math.max(1, Math.round(imageData.width / 4));
    const th = Math.max(1, Math.round(imageData.height / 4));

    const canvas = new OffscreenCanvas(tw, th);
    const ctx = canvas.getContext('2d')!;
    const tmp = new OffscreenCanvas(imageData.width, imageData.height);
    const tmpCtx = tmp.getContext('2d')!;
    tmpCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(tmp, 0, 0, tw, th);

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.6 });
    return URL.createObjectURL(blob);
  }

  dispose(): void {
    this.controller.abort();
    // Cleanup all tracked thumbnails to prevent memory leaks
    this.activeThumbnailUrls.forEach(url => URL.revokeObjectURL(url));
    this.activeThumbnailUrls.clear();
  }
}
