import { IProcessingEngine } from '../IProcessingEngine';
import {
  EngineCapabilities,
  EngineDocumentInput,
  EngineDocumentOutput,
  EnginePageProcessResult,
  EngineProcessingOptions,
  EngineProgressCallback,
  EngineVersion,
} from '../types';
import {
  DocumentProfile,
  PageProfile,
  PresetMode,
  ProcessedPage,
  ProcessingParameters,
} from '../../types';
import { ImageProcessingKernels } from '../../wasmEngine';
import { workerPool } from '../../workerPool';
import { ParameterGenerator } from '../../parameterGenerator';
import { memoryManager } from '../../memoryManager';
import { pwOptimizerStorage } from '../../storage';

export class ProcessingEngineV1 implements IProcessingEngine {
  readonly id: string = 'pw-pixel-v1';
  readonly version: EngineVersion = 'v1';
  readonly name: string = 'PW High-Speed Pixel Engine v1';
  readonly description: string = 'Optimized Uint8ClampedArray pixel loops, zero-copy buffer operations, smart hue remapping, adaptive dark slide inversion, and Web Worker offloading.';

  readonly capabilities: EngineCapabilities = {
    supportsWebWorkers: true,
    supportsSmartColorRemap: true,
    supportsAutoBannerCrop: true,
    maxConcurrentPages: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
    engineDescription: 'v1 Engine: Fast parallel pixel kernels for PW Physics & Chemistry lecture notes.',
  };

  /**
   * Fast pass 1: Analyze raw ImageData
   */
  public async analyzePage(imageData: ImageData, pageIndex: number): Promise<PageProfile> {
    return ImageProcessingKernels.analyzeImageData(imageData, pageIndex);
  }

  /**
   * Pass 2: Process a single page
   */
  public async processPage(
    imageData: ImageData,
    pageIndex: number,
    params: ProcessingParameters,
    profile: PageProfile
  ): Promise<EnginePageProcessResult> {
    const startTime = performance.now();
    const workerRes = await workerPool.processPageInWorker(pageIndex, imageData, params, profile);
    const endTime = performance.now();

    return {
      pageIndex: workerRes.pageIndex,
      optimizedImageData: workerRes.optimizedImageData,
      inkCoverageBeforePct: workerRes.inkCoverageBeforePct,
      inkCoverageAfterPct: workerRes.inkCoverageAfterPct,
      processingTimeMs: Math.round(endTime - startTime),
    };
  }

  /**
   * Helper to initialize PDF.js
   */
  private async initPdfJs(): Promise<any> {
    if (typeof window === 'undefined') return null;
    if ((window as any).pdfjsLib) return (window as any).pdfjsLib;

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
   * Standalone full document processing pipeline for v1 Engine
   */
  public async processDocument(
    input: EngineDocumentInput,
    options: EngineProcessingOptions = {},
    onProgress?: EngineProgressCallback
  ): Promise<EngineDocumentOutput> {
    const startOverallTime = performance.now();
    const { pdfBuffer, pdfId, presetMode = 'AUTO_ADAPTIVE' } = input;
    const renderScale = options.renderScale || 1.8;

    const pdfjsLib = await this.initPdfJs();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    const profiles: PageProfile[] = [];
    const processedPages: ProcessedPage[] = [];

    let sumBrightness = 0;
    let darkSlidesCount = 0;

    // --- PASS 1: FAST PAGE ANALYSIS ---
    for (let i = 1; i <= totalPages; i++) {
      if (onProgress) {
        onProgress(i, totalPages, `[Engine v1] Analyzing slide structure ${i} of ${totalPages}...`);
      }

      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 0.8 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;

      await page.render({ canvasContext: ctx, viewport }).promise;
      const analysisImg = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const profile = await this.analyzePage(analysisImg, i - 1);
      profiles.push(profile);

      sumBrightness += profile.averageBrightness;
      if (profile.classification === 'DARK_SLIDE') darkSlidesCount++;

      memoryManager.disposeCanvas(canvas);
      await memoryManager.yieldToUI();
    }

    const darkSlideRatio = darkSlidesCount / totalPages;
    let recommendedPreset: PresetMode = presetMode;
    if (presetMode === 'AUTO_ADAPTIVE') {
      if (darkSlideRatio > 0.6) {
        recommendedPreset = 'PW_DARK_SLIDE';
      } else if (darkSlideRatio < 0.2) {
        recommendedPreset = 'LIGHT_HANDWRITTEN';
      }
    }

    const docProfile: DocumentProfile = {
      totalPages,
      averageBrightness: Math.round(sumBrightness / totalPages),
      darkSlideRatio: Number(darkSlideRatio.toFixed(2)),
      recommendedPreset,
      pages: profiles,
      detectedBanners: {
        topPct: profiles.reduce((acc, p) => Math.max(acc, p.topBannerHeightPct), 0),
        bottomPct: profiles.reduce((acc, p) => Math.max(acc, p.bottomBannerHeightPct), 0),
      },
    };

    // --- PASS 2: HIGH-RES RENDER & WEB WORKER OPTIMIZATION ---
    let execMode = options.executionMode || 'auto';
    if (execMode === 'auto') {
      if (typeof navigator !== 'undefined') {
        const ua = navigator.userAgent;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        const isTablet = /iPad/i.test(ua) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
        
        if (isMobile && !isTablet) {
          execMode = 'sequential';
        } else if (isTablet) {
          execMode = 'hybrid';
        } else {
          execMode = 'parallel';
        }
      } else {
        execMode = 'parallel';
      }
    }

    let concurrencyLimit = 1;
    if (execMode === 'parallel') {
      concurrencyLimit = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;
    } else if (execMode === 'hybrid') {
      concurrencyLimit = 2;
    } else {
      concurrencyLimit = 1;
    }

    const processSinglePage = async (i: number) => {
      if (onProgress) {
        onProgress(i, totalPages, `[Engine v1] Optimizing slide ${i} of ${totalPages} (${execMode} mode)...`);
      }

      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: renderScale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;

      await page.render({ canvasContext: ctx, viewport }).promise;
      const srcImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const profile = profiles[i - 1];
      const params = ParameterGenerator.generateAdaptiveForPage(profile, docProfile, recommendedPreset);

      if (input.customParams) {
        Object.assign(params, input.customParams);
      }

      // Execute worker page processing via Engine interface
      const pageRes = await this.processPage(srcImageData, i - 1, params, profile);

      // Create compressed thumbnail
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = Math.round(pageRes.optimizedImageData.width / 4);
      thumbCanvas.height = Math.round(pageRes.optimizedImageData.height / 4);
      const thumbCtx = thumbCanvas.getContext('2d');
      if (thumbCtx) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = pageRes.optimizedImageData.width;
        tempCanvas.height = pageRes.optimizedImageData.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.putImageData(pageRes.optimizedImageData, 0, 0);
          thumbCtx.drawImage(tempCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
          memoryManager.disposeCanvas(tempCanvas);
        }
      }
      const thumbnailDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.6);
      memoryManager.disposeCanvas(thumbCanvas);

      // Store Blobs in IndexedDB
      const origBlob = await memoryManager.imageDataToBlob(srcImageData, 0.85);
      const optBlob = await memoryManager.imageDataToBlob(pageRes.optimizedImageData, 0.88);

      await pwOptimizerStorage.storePage(pdfId, i - 1, origBlob, optBlob);

      memoryManager.disposeCanvas(canvas);
      await memoryManager.yieldToUI();

      return {
        pageIndex: i - 1,
        thumbnailDataUrl,
        profile,
        parameters: params,
        inkCoverageBeforePct: pageRes.inkCoverageBeforePct,
        inkCoverageAfterPct: pageRes.inkCoverageAfterPct,
        width: pageRes.optimizedImageData.width,
        height: pageRes.optimizedImageData.height,
        storageKey: pdfId,
      };
    };

    if (concurrencyLimit <= 1) {
      // Sequential execution (Low Memory Mode)
      for (let i = 1; i <= totalPages; i++) {
        const result = await processSinglePage(i);
        processedPages.push(result);
      }
    } else {
      // Parallel execution with concurrency limit (High Performance Mode / Hybrid)
      let currentIndex = 1;
      const executeNext = async (): Promise<void> => {
        if (currentIndex > totalPages) return;
        const i = currentIndex++;
        const result = await processSinglePage(i);
        processedPages.push(result);
        await executeNext();
      };
      
      const workers: Promise<void>[] = [];
      for (let w = 0; w < concurrencyLimit; w++) {
        workers.push(executeNext());
      }
      
      await Promise.all(workers);
      // Sort to ensure page order is preserved
      processedPages.sort((a, b) => a.pageIndex - b.pageIndex);
    }

    const endOverallTime = performance.now();
    const totalTimeMs = Math.round(endOverallTime - startOverallTime);

    return {
      processedPages,
      docProfile,
      engineVersion: this.version,
      engineId: this.id,
      totalTimeMs,
      metrics: {
        processingTimeMs: totalTimeMs,
        pagesPerSecond: Number((totalPages / (totalTimeMs / 1000)).toFixed(2)),
      },
    };
  }
}
