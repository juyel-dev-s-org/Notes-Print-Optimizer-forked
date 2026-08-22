'use client';

import { useCallback, useRef } from 'react';
import { OptimizationService } from '../../services/OptimizationService';
import { pwOptimizerStorage } from '../../optimizer/storage';
import { memoryManager } from '../../optimizer/memoryManager';
import { getPdfjsLib } from '../../optimizer/pdfjsLoader';
import { ParameterGenerator } from '../../optimizer/parameterGenerator';
import type {
  PageProfile,
  ProcessedPage,
  ProcessingParameters,
} from '../../optimizer/types';
import type { ProcessingToggleState } from '../types';
import type { WorkflowActions } from '../useWorkflow';
import { DEFAULT_PROCESSING_TOGGLES } from '../types';
import { buildEffectiveParams } from './buildEffectiveParams';
import type { WithProcessingFn } from './useWorkflowRuntime';

interface OptimizationParams {
  mergedPdfBytes: Uint8Array | null;
  masterParams: ProcessingParameters;
  processingToggles: ProcessingToggleState;
  selectedPageIndex: number;
  processedPages: ProcessedPage[];
  pageProfiles: PageProfile[];
  actions: WorkflowActions & {
    updateSingleProcessedPage: (idx: number, page: ProcessedPage) => void;
  };
  abortRef: React.MutableRefObject<AbortController | null>;
  previewBlobUrlRef: React.MutableRefObject<string | null>;
  previewPdfDocRef: React.MutableRefObject<{ bytes: Uint8Array; doc: any } | null>;
  withProcessing: WithProcessingFn;
  setProgressiveThumbnails: React.Dispatch<React.SetStateAction<Map<number, string>>>;
  clearProgressiveThumbnails: () => void;
}

/**
 * Phase-2 optimization domain: full-document processing, batch
 * re-process and the memory-guarded single-page preview reprocess.
 */
export function useOptimization({
  mergedPdfBytes,
  masterParams,
  processingToggles,
  selectedPageIndex,
  processedPages,
  pageProfiles,
  actions,
  abortRef,
  previewBlobUrlRef,
  previewPdfDocRef,
  withProcessing,
  setProgressiveThumbnails,
  clearProgressiveThumbnails,
}: OptimizationParams) {
  const handleProceedToPhase2 = useCallback(
    async () => {
      if (!mergedPdfBytes) return;
      const startTime = Date.now();
      const abortController = new AbortController();
      abortRef.current = abortController;
      const pdfId = `pw_doc_${Date.now()}`;
      clearProgressiveThumbnails();
      await withProcessing(async () => {
        const signal = abortController.signal;
        const service = new OptimizationService();
        const effectiveParams = buildEffectiveParams(masterParams, processingToggles);
        const { processedPages: pages, docProfile: dProf } = await service.processDocument(
          mergedPdfBytes.buffer.slice(
            mergedPdfBytes.byteOffset,
            mergedPdfBytes.byteOffset + mergedPdfBytes.byteLength,
          ) as ArrayBuffer,
          pdfId,
          effectiveParams.preset,
          (curr, total, action) => {
            if (signal.aborted) throw new Error('CANCELLED');
            actions.setProgress({
              stage: 'OPTIMIZING',
              currentPage: curr,
              totalPages: total,
              percent: Math.round((curr / total) * 100),
              currentAction: action,
              elapsedMs: Date.now() - startTime,
            });
          },
          (pageIndex, thumbUrl) => {
            setProgressiveThumbnails(prev => {
              const next = new Map(prev);
              next.set(pageIndex, thumbUrl);
              return next;
            });
          },
          effectiveParams,
        );
        if (signal.aborted) return;
        actions.setTiming({
          analysisTimeMs: Math.round((Date.now() - startTime) * 0.15),
          optimizationTimeMs: Math.round((Date.now() - startTime) * 0.85),
        });
        actions.setDocProfile(dProf);
        actions.setPageProfiles(dProf.pages);
        actions.setProcessedPages(pages);
        actions.setPhase(2);
      }, 'Processing failed due to browser memory limits.', null);
      if (abortRef.current === abortController) abortRef.current = null;
    },
    [mergedPdfBytes, masterParams, processingToggles, actions, withProcessing, abortRef, setProgressiveThumbnails, clearProgressiveThumbnails],
  );

  /* ----------------------------------------------------------------
   * handlePreviewReprocess  -  SINGLE-PAGE PREVIEW PROCESSING
   *
   * Memory strategy: render ONLY the selected page, process it,
   * generate a small thumbnail blob URL, store the result in
   * IndexedDB, then release everything. The previous preview blob
   * URL is revoked before a new one is created.
   * ---------------------------------------------------------------- */
  /** Guards against overlapping preview-reprocess invocations. */
  const previewInFlightRef = useRef(false);

  const handlePreviewReprocess = useCallback(async () => {
    if (!mergedPdfBytes || mergedPdfBytes.length === 0 || processedPages.length === 0) return;
    const pageIndex = selectedPageIndex;
    if (pageIndex < 0 || pageIndex >= processedPages.length) return;
    if (previewInFlightRef.current) return; // already running — skip

    previewInFlightRef.current = true;
    actions.setPreviewProcessing(true);
    actions.setError(null);

    let rawCanvas: HTMLCanvasElement | null = null;
    let originalImageData: ImageData | null = null;
    let optimizedImageData: ImageData | null = null;
    let thumbCanvas: HTMLCanvasElement | null = null;

    try {
      const effectiveParams = buildEffectiveParams(masterParams, processingToggles);
      const { getProcessingEngine } = await import('../../optimizer/engine');
      const engine = getProcessingEngine();

      // Render ONLY the selected page from the cached or loaded PDF
      let pdfDoc =
        previewPdfDocRef.current?.bytes === mergedPdfBytes ? previewPdfDocRef.current.doc : null;
      if (!pdfDoc) {
        if (previewPdfDocRef.current?.doc) {
          try {
            previewPdfDocRef.current.doc.destroy();
          } catch {
            /* noop */
          }
          previewPdfDocRef.current = null;
        }
        const pdfjsLib = await getPdfjsLib();
        pdfDoc = await pdfjsLib.getDocument({ data: mergedPdfBytes.slice() }).promise;
        previewPdfDocRef.current = { bytes: mergedPdfBytes, doc: pdfDoc };
      }
      const pdfPage = await pdfDoc.getPage(pageIndex + 1);

      const viewport = pdfPage.getViewport({ scale: 1.0 });
      const TARGET_DPI = 250;
      const dpiScale = TARGET_DPI / 72;
      const maxDim = Math.max(viewport.width, viewport.height);
      const isMobile = memoryManager.isMobileDevice();
      const dimCap = isMobile ? 1600 : 2400;
      const dimCapScale = dimCap / maxDim;
      const renderScale = Math.max(1.0, Math.min(4.0, Math.min(dpiScale, dimCapScale)));

      const scaledViewport = pdfPage.getViewport({ scale: renderScale });
      rawCanvas = memoryManager.acquireCanvas(
        Math.floor(scaledViewport.width),
        Math.floor(scaledViewport.height),
      );
      const rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true })!;
      await pdfPage.render({ canvasContext: rawCtx, viewport: scaledViewport }).promise;
      originalImageData = rawCtx.getImageData(0, 0, rawCanvas.width, rawCanvas.height);

      // Release the render canvas immediately - we have the ImageData
      memoryManager.releaseCanvas(rawCanvas);
      rawCanvas = null;

      // Get or reuse the existing page profile
      const profile =
        pageProfiles[pageIndex] ?? (await engine.analyzePage(originalImageData, pageIndex));

      // Process through the engine
      const result = await engine.processPage(
        originalImageData,
        pageIndex,
        effectiveParams,
        profile,
      );
      optimizedImageData = result.optimizedImageData;

      // Release original ImageData (original is re-rendered lazily for before/after)
      originalImageData = null;

      // Generate thumbnail (small, memory-cheap)
      const tw = Math.max(1, Math.round(optimizedImageData.width / 4));
      const th = Math.max(1, Math.round(optimizedImageData.height / 4));
      thumbCanvas = memoryManager.acquireCanvas(tw, th);
      const thumbCtx = thumbCanvas.getContext('2d', { willReadFrequently: true })!;

      const tmpCanvas = memoryManager.acquireCanvas(
        optimizedImageData.width,
        optimizedImageData.height,
      );
      const tmpCtx = tmpCanvas.getContext('2d', { willReadFrequently: true })!;
      tmpCtx.putImageData(optimizedImageData, 0, 0);
      thumbCtx.drawImage(tmpCanvas, 0, 0, tw, th);
      memoryManager.releaseCanvas(tmpCanvas);

      // Revoke previous preview blob URL before creating a new one
      if (previewBlobUrlRef.current) {
        memoryManager.revokeBlobUrl(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }

      const thumbBlob = await new Promise<Blob>(resolve => {
        thumbCanvas!.toBlob(
          b => resolve(b || new Blob([], { type: 'image/jpeg' })),
          'image/jpeg',
          0.6,
        );
      });
      memoryManager.releaseCanvas(thumbCanvas);
      thumbCanvas = null;

      const thumbUrl = memoryManager.createTrackedBlobUrl(thumbBlob);
      previewBlobUrlRef.current = thumbUrl;

      // Store optimized result in IndexedDB
      const optBlob = await memoryManager.imageDataToBlob(
        optimizedImageData,
        effectiveParams.outputQuality,
      );
      const previewPdfId = `pw_preview_${Date.now()}`;
      try {
        await pwOptimizerStorage.storePage(previewPdfId, pageIndex, null, optBlob);
      } catch {
        // IDB write failure is non-fatal for preview
      }

      // Release optimized ImageData - no longer needed
      const optWidth = optimizedImageData.width;
      const optHeight = optimizedImageData.height;
      optimizedImageData = null;

      // Update ONLY the selected page in processedPages
      const updatedPage: ProcessedPage = {
        pageIndex,
        thumbnailDataUrl: thumbUrl,
        profile,
        parameters: effectiveParams,
        inkCoverageBeforePct: result.inkCoverageBeforePct,
        inkCoverageAfterPct: result.inkCoverageAfterPct,
        width: optWidth,
        height: optHeight,
        storageKey: `${previewPdfId}_page_${pageIndex}`,
      };
      actions.updateSingleProcessedPage(pageIndex, updatedPage);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        console.error('[PreviewReprocess] Failed:', err);
        actions.setError('Preview processing failed. Try adjusting settings.');
      }
    } finally {
      // Guaranteed cleanup - release any remaining resources
      if (rawCanvas) memoryManager.releaseCanvas(rawCanvas);
      if (thumbCanvas) memoryManager.releaseCanvas(thumbCanvas);
      originalImageData = null;
      optimizedImageData = null;
      previewInFlightRef.current = false;
      actions.setPreviewProcessing(false);
    }
  }, [
    mergedPdfBytes,
    processedPages,
    selectedPageIndex,
    masterParams,
    processingToggles,
    pageProfiles,
    actions,
    previewBlobUrlRef,
    previewPdfDocRef,
  ]);

  /* ----------------------------------------------------------------
   * handleReprocess  -  BATCH RE-PROCESS ALL PAGES
   *
   * This is the ONLY action that applies current settings to
   * every page in the document. Triggered explicitly by the
   * "Re-process All Pages" button.
   * ---------------------------------------------------------------- */
  const handleReprocess = useCallback(async () => {
    if (!mergedPdfBytes) return;
    const startTime = Date.now();
    const abortController = new AbortController();
    abortRef.current = abortController;
    const pdfId = `pw_reprocess_${Date.now()}`;
    clearProgressiveThumbnails();

    if (previewBlobUrlRef.current) {
      memoryManager.revokeBlobUrl(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }

    await withProcessing(async () => {
      const signal = abortController.signal;
      const service = new OptimizationService();
      const effectiveParams = buildEffectiveParams(masterParams, processingToggles);
      const { processedPages: pages, docProfile: dProf } = await service.processDocument(
        mergedPdfBytes.buffer.slice(
          mergedPdfBytes.byteOffset,
          mergedPdfBytes.byteOffset + mergedPdfBytes.byteLength,
        ) as ArrayBuffer,
        pdfId,
        effectiveParams.preset,
        (curr, total, action) => {
          if (signal.aborted) throw new Error('CANCELLED');
          actions.setProgress({
            stage: 'OPTIMIZING',
            currentPage: curr,
            totalPages: total,
            percent: Math.round((curr / total) * 100),
            currentAction: action,
            elapsedMs: Date.now() - startTime,
          });
        },
        (pageIndex, thumbUrl) => {
          setProgressiveThumbnails(prev => {
            const next = new Map(prev);
            next.set(pageIndex, thumbUrl);
            return next;
          });
        },
        effectiveParams,
      );
      if (signal.aborted) return;
      actions.setTiming({
        analysisTimeMs: Math.round((Date.now() - startTime) * 0.15),
        optimizationTimeMs: Math.round((Date.now() - startTime) * 0.85),
      });
      actions.setDocProfile(dProf);
      actions.setPageProfiles(dProf.pages);
      actions.setProcessedPages(pages);
      actions.setExcludedPages(new Set());
    }, 'Re-processing failed. Try reducing settings values.', null);
    if (abortRef.current === abortController) abortRef.current = null;
  }, [
    mergedPdfBytes,
    masterParams,
    processingToggles,
    actions,
    withProcessing,
    abortRef,
    previewBlobUrlRef,
    setProgressiveThumbnails,
    clearProgressiveThumbnails,
  ]);

  /**
   * Restores the selected preset defaults and turns OFF all manual
   * overrides. Does NOT automatically re-process pages.
   */
  const handleResetSettings = useCallback(() => {
    const presetDefaults = ParameterGenerator.getPresetParameters(masterParams.preset);
    actions.setMasterParams(presetDefaults);
    actions.setProcessingToggles({ ...DEFAULT_PROCESSING_TOGGLES });
  }, [masterParams.preset, actions]);

  return {
    handleProceedToPhase2,
    handlePreviewReprocess,
    handleReprocess,
    handleResetSettings,
  };
}
