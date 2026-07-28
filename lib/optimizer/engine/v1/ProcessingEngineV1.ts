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
    const renderScale = options.renderScale || 1.8;
    const pdfjsLib = await this.initPdfJs();
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
    const totalPages = pdfDoc.numPages;
    const profiles: PageProfile[] = new Array(totalPages);
    const processedPages: ProcessedPage[] = new Array(totalPages);
    let sumBrightness = 0, darkCount = 0;

    /* Reset write queue for new document (H-5) */
    this.writeQueue = [];
    this.flushChain = Promise.resolve();

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
      const viewport = page.getViewport({ scale: renderScale });
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
      let thumbnailDataUrl = '';
      try { const tw = Math.max(1, Math.round(pageRes.optimizedImageData.width / 4));
        const th = Math.max(1, Math.round(pageRes.optimizedImageData.height / 4));
        if (typeof createImageBitmap !== 'undefined') {
          const bmp = await createImageBitmap(pageRes.optimizedImageData, { resizeWidth: tw, resizeHeight: th, resizeQuality: 'medium' });
          const tc = document.createElement('canvas'); tc.width = tw; tc.height = th;
          tc.getContext('2d')!.drawImage(bmp, 0, 0); bmp.close();
          thumbnailDataUrl = tc.toDataURL('image/jpeg', 0.6); memoryManager.disposeCanvas(tc);
        } else { const tc = document.createElement('canvas'); tc.width = tw; tc.height = th;
          const tmp = document.createElement('canvas'); tmp.width = pageRes.optimizedImageData.width; tmp.height = pageRes.optimizedImageData.height;
          tmp.getContext('2d')!.putImageData(pageRes.optimizedImageData, 0, 0);
          tc.getContext('2d')!.drawImage(tmp, 0, 0, tw, th);
          thumbnailDataUrl = tc.toDataURL('image/jpeg', 0.6);
          memoryManager.disposeCanvas(tmp); memoryManager.disposeCanvas(tc); }
      } catch { thumbnailDataUrl = ''; }
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
