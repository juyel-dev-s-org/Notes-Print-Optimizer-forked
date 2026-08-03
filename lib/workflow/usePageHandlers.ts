'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkflow } from './useWorkflow';
import { UploadService, type UploadedItem } from '../services/UploadService';
import { planSmartOrder } from '../rearrange';
import { LayoutService } from '../services/LayoutService';
import { ExportService } from '../services/ExportService';
import { OptimizationService } from '../services/OptimizationService';
import { pwOptimizerStorage } from '../optimizer/storage';
import { memoryManager } from '../optimizer/memoryManager';
import { CheckpointManager } from '../pipeline/checkpoint/CheckpointManager';
import { ParameterGenerator } from '../optimizer/parameterGenerator';
import { getProcessingEngine } from '../optimizer/engine';
import { getPdfjsLib } from '../optimizer/pdfjsLoader';
import type {
  GridFormat,
  LayoutConfig,
  OuterMarginConfig,
  ProcessedPage,
  ProcessingParameters,
} from '../optimizer/types';
import type { ProcessingToggleState, ResumeInfo } from './types';
import { DEFAULT_PROCESSING_TOGGLES } from './types';

const checkpointManager = new CheckpointManager();

/* ----------------------------------------------------------------
 * buildEffectiveParams
 *
 * Merges the selected preset defaults with any manually-enabled
 * toggle overrides from the settings panel.
 *
 * - Stroke/Dilation OFF -> dilationKernelSize forced to 0
 *   (raw PDF preserved, NO morphology at all).
 * - Stroke/Dilation ON  -> uses the slider value from masterParams.
 * - Other toggles OFF   -> preset default value is used.
 * - Other toggles ON    -> masterParams slider value overrides preset.
 * ---------------------------------------------------------------- */
function buildEffectiveParams(
  masterParams: ProcessingParameters,
  toggles: ProcessingToggleState,
): ProcessingParameters {
  const presetDefaults = ParameterGenerator.getPresetParameters(masterParams.preset);

  const effective: ProcessingParameters = {
    ...presetDefaults,
    preset: masterParams.preset,
    invertMode: masterParams.invertMode,
    smartColorMapping: masterParams.smartColorMapping,
    bannerCropTopPct: masterParams.bannerCropTopPct,
    bannerCropBottomPct: masterParams.bannerCropBottomPct,
    autoTrimMargins: masterParams.autoTrimMargins,
    binaizationThreshold: masterParams.binaizationThreshold,
    outputQuality: masterParams.outputQuality,
  };

  // Stroke / Dilation
  if (toggles.strokeDilation) {
    effective.dilationKernelSize = masterParams.dilationKernelSize;
    effective.strokeEnhancement = masterParams.strokeEnhancement;
  } else {
    effective.dilationKernelSize = 0;
    effective.strokeEnhancement = 'none';
  }

  // Sharpen
  effective.sharpenAmount = toggles.sharpen
    ? masterParams.sharpenAmount
    : presetDefaults.sharpenAmount;

  // Contrast
  effective.contrastEnhancement = toggles.contrast
    ? masterParams.contrastEnhancement
    : presetDefaults.contrastEnhancement;

  // Denoise
  effective.denoiseAmount = toggles.denoise
    ? masterParams.denoiseAmount
    : presetDefaults.denoiseAmount;

  // BG Whitening
  effective.backgroundWhiteningThreshold = toggles.bgWhitening
    ? masterParams.backgroundWhiteningThreshold
    : presetDefaults.backgroundWhiteningThreshold;

  return effective;
}

export function usePageHandlers() {
  const { state, actions } = useWorkflow();
  const {
    mergedPdfBytes,
    uploadedItems,
    processedPages,
    excludedPages,
    layoutConfig,
    selectedEngineVersion,
    masterParams,
    processingToggles,
    selectedPageIndex,
    pageProfiles,
  } = state;

  const abortRef = useRef<AbortController | null>(null);
  const [resumeInfo, setResumeInfo] = useState<ResumeInfo | null>(null);
  const [progressiveThumbnails, setProgressiveThumbnails] = useState<Map<number, string>>(new Map());
  const snapshotsCheckedRef = useRef(false);

  /**
   * Tracks the blob URL of the current single-page preview so it can be
   * revoked before a new one is created (prevents orphaned blob leaks).
   */
  const previewBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    pwOptimizerStorage.clearCache();
    pwOptimizerStorage.evictStaleEntries();
    memoryManager.checkStorageQuota().then(q => {
      if (q && !q.ok) console.warn(`[Storage] ${q.percentUsed.toFixed(0)}% used - near quota`);
    });
    if (!snapshotsCheckedRef.current) {
      snapshotsCheckedRef.current = true;
      checkpointManager.listSnapshots().then(snapshots => {
        if (snapshots.length > 0) {
          const latest = snapshots.reduce((a, b) => a.lastUpdated > b.lastUpdated ? a : b);
          if (latest.completedCount < latest.totalPages) {
            setResumeInfo(latest);
          } else {
            checkpointManager.remove(latest.documentId);
          }
        }
      });
    }
    const handleUnload = () => { pwOptimizerStorage.clearCache(); memoryManager.revokeAllBlobUrls(); };
    window.addEventListener('beforeunload', handleUnload);
    return () => { window.removeEventListener('beforeunload', handleUnload); handleUnload(); };
  }, []);

  /* Cleanup preview blob on unmount */
  useEffect(() => {
    return () => {
      if (previewBlobUrlRef.current) {
        memoryManager.revokeBlobUrl(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
    };
  }, []);

  const handleCancelProcessing = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    actions.setProcessing(false);
    actions.setProgress(null);
    actions.setError(null);
    actions.setPhase(1);
  }, [actions]);

  const handleResumeProcessing = useCallback(() => {
    if (!resumeInfo) return;
    actions.setError(null);
    actions.setProcessing(true);
    actions.setProgress({
      stage: 'INITIALIZING', currentPage: resumeInfo.completedCount, totalPages: resumeInfo.totalPages,
      percent: Math.round((resumeInfo.completedCount / resumeInfo.totalPages) * 100),
      currentAction: 'Resuming from checkpoint...', elapsedMs: 0,
    });
    setResumeInfo(null);
  }, [resumeInfo, actions]);

  const handleDismissResume = useCallback(() => {
    if (resumeInfo) {
      checkpointManager.remove(resumeInfo.documentId);
      setResumeInfo(null);
    }
  }, [resumeInfo]);

  const handleResetWorkflow = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    pwOptimizerStorage.clearCache();
    memoryManager.revokeAllBlobUrls();
    if (previewBlobUrlRef.current) {
      memoryManager.revokeBlobUrl(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    setProgressiveThumbnails(new Map());
    actions.resetWorkflow();
  }, [actions]);

  const withProcessing = useCallback(async <T,>(fn: () => Promise<T>, errorMsg: string, stage: Parameters<typeof actions.setProgress>[0]): Promise<T | undefined> => {
    actions.setError(null);
    actions.setProcessing(true);
    if (stage) actions.setProgress(stage);
    try { return await fn(); }
    catch (err: any) {
      if (err?.name === 'AbortError' || err?.message === 'CANCELLED') {
        return undefined;
      }
      console.error(err); actions.setError(errorMsg); return undefined;
    }
    finally { actions.setProcessing(false); actions.setProgress(null); }
  }, [actions]);

  const generateMergedPreview = useCallback(async (items: UploadedItem[]) => {
    if (items.length === 0) { actions.setMergeResult(null, null, []); return; }
    const result = await UploadService.mergeAndPreview(items);
    if (result) actions.setMergeResult(result.pdfBlob, result.pdfBytes, result.thumbnails);
  }, [actions]);

  const handleFilesUpload = useCallback(async (newFiles: File[]) => {
    await withProcessing(async () => {
      const items = await UploadService.readFiles(newFiles);
      const combined = [...uploadedItems, ...items];
      // Smart PDF rearrangement: auto-detect related series ("Calculus 1..13
      // Class Notes") and natural-sort them as files arrive. The rule engine
      // returns the untouched order when no confident pattern is found, so
      // this is a no-op for unrelated uploads.
      const smartPlan = planSmartOrder(combined);
      const updatedList = smartPlan.changed ? smartPlan.orderedItems : combined;
      actions.setUploadedItems(updatedList);
      await generateMergedPreview(updatedList);
    }, 'PDF cannot be opened or is corrupted.', {
      stage: 'INITIALIZING', currentPage: 0, totalPages: newFiles.length,
      percent: 20, currentAction: 'Reading PDF files...', elapsedMs: 0,
    });
  }, [uploadedItems, actions, withProcessing, generateMergedPreview]);

  const handleLoadSamplePdf = useCallback(async () => {
    await withProcessing(async () => {
      const item = await UploadService.generateSamplePdf();
      const updatedList = [item];
      actions.setUploadedItems(updatedList);
      await generateMergedPreview(updatedList);
    }, 'Failed to load sample PDF.', {
      stage: 'INITIALIZING', currentPage: 1, totalPages: 1,
      percent: 30, currentAction: 'Generating sample slides...', elapsedMs: 0,
    });
  }, [actions, withProcessing, generateMergedPreview]);

  const handleMoveItem = useCallback(async (index: number, direction: 'UP' | 'DOWN') => {
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= uploadedItems.length) return;
    const newList = [...uploadedItems];
    [newList[index], newList[targetIdx]] = [newList[targetIdx], newList[index]];
    actions.setUploadedItems(newList);
    await generateMergedPreview(newList);
  }, [uploadedItems, actions, generateMergedPreview]);

  /**
   * Smart PDF Rearrangement - one-click rule-based ordering.
   * Detects related series ("Basic Maths and Calculus 1..13 Class Notes")
   * and natural-sorts them; standalone files keep their relative order.
   */
  const handleSmartArrange = useCallback(async () => {
    if (uploadedItems.length < 2) return;
    const plan = planSmartOrder(uploadedItems);
    if (!plan.changed) return;
    actions.setUploadedItems(plan.orderedItems);
    await generateMergedPreview(plan.orderedItems);
  }, [uploadedItems, actions, generateMergedPreview]);

  /** Drag & drop reorder: move item at fromIndex into position toIndex. */
  const handleReorderItem = useCallback(async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= uploadedItems.length) return;
    if (toIndex < 0 || toIndex >= uploadedItems.length) return;
    const newList = [...uploadedItems];
    const [moved] = newList.splice(fromIndex, 1);
    newList.splice(toIndex, 0, moved);
    actions.setUploadedItems(newList);
    await generateMergedPreview(newList);
  }, [uploadedItems, actions, generateMergedPreview]);

  const handleRemoveItem = useCallback(async (index: number) => {
    const newList = uploadedItems.filter((_, i) => i !== index);
    actions.setUploadedItems(newList);
    if (newList.length > 0) await generateMergedPreview(newList);
    else actions.setMergeResult(null, null, []);
  }, [uploadedItems, actions, generateMergedPreview]);

  const handleDownloadMerged = useCallback(() => {
    if (!state.mergedPdfBlob) return;
    ExportService.downloadBlob(state.mergedPdfBlob, 'PW_Merged_Notes.pdf');
  }, [state.mergedPdfBlob]);

  const handleProceedToPhase2 = useCallback(async () => {
    if (!mergedPdfBytes) return;
    const startTime = Date.now();
    const abortController = new AbortController();
    abortRef.current = abortController;
    const pdfId = `pw_doc_${Date.now()}`;
    setProgressiveThumbnails(new Map());
    await withProcessing(async () => {
      const signal = abortController.signal;
      await checkpointManager.save(pdfId, {
        documentId: pdfId, totalPages: 0, completedPages: [],
        engineVersion: selectedEngineVersion, params: masterParams as unknown as Record<string, unknown>,
        layoutConfig: { gridFormat: '2x2', paperSize: 'A4', orientation: 'PORTRAIT',
          outerMarginMm: { top: 2, left: 5, right: 3, bottom: 2 }, innerMarginMm: 1, marginMm: 2, spacingMm: 1,
          showSlideBorders: false, showPageNumbers: false, headerTitle: '',
        } as unknown as Record<string, unknown>,
      });
      const service = new OptimizationService();
      const effectiveParams = buildEffectiveParams(masterParams, processingToggles);
      const { processedPages: pages, docProfile: dProf } = await service.processDocument(
        mergedPdfBytes.slice().buffer as ArrayBuffer, pdfId, effectiveParams.preset,
        selectedEngineVersion,
        (curr, total, action) => {
          if (signal.aborted) throw new Error('CANCELLED');
          actions.setProgress({
            stage: 'OPTIMIZING', currentPage: curr, totalPages: total,
            percent: Math.round((curr / total) * 100), currentAction: action,
            elapsedMs: Date.now() - startTime,
          });
          if (curr > 0 && curr <= total) {
            checkpointManager.markPageDone(pdfId, curr);
          }
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
      await checkpointManager.remove(pdfId);
    }, 'Processing failed due to browser memory limits.', null);
    if (abortRef.current === abortController) abortRef.current = null;
  }, [mergedPdfBytes, masterParams, processingToggles, selectedEngineVersion, actions, withProcessing]);

  /* ----------------------------------------------------------------
   * handlePreviewReprocess  -  SINGLE-PAGE PREVIEW PROCESSING
   *
   * Memory & Processing Strategy:
   *  1. Renders ONLY the selected page from the source PDF.
   *  2. Processes it through the engine with effective params.
   *  3. Generates a small thumbnail blob URL.
   *  4. Stores optimized result in IndexedDB.
   *  5. Updates ONLY processedPages[selectedPageIndex].
   *  6. Immediately releases full-res ImageData + canvas.
   *  7. Revokes the previous preview blob URL before creating new.
   *
   * Preview Memory Lifecycle:
   *  - At most 1 page's full-res ImageData exists at any time.
   *  - Canvas is acquired from pool and released back after use.
   *  - Blob URLs are tracked via previewBlobUrlRef and revoked
   *    on next preview or on unmount.
   *  - No batch allocation; other pages remain untouched.
   * ---------------------------------------------------------------- */
  /** Guards against overlapping preview-reprocess invocations. */
  const previewInFlightRef = useRef(false);

  const handlePreviewReprocess = useCallback(async () => {
    if (!mergedPdfBytes || mergedPdfBytes.length === 0 || processedPages.length === 0) return;
    const pageIndex = selectedPageIndex;
    if (pageIndex < 0 || pageIndex >= processedPages.length) return;
    if (previewInFlightRef.current) return;   // already running — skip

    previewInFlightRef.current = true;
    actions.setPreviewProcessing(true);
    actions.setError(null);

    let rawCanvas: HTMLCanvasElement | null = null;
    let originalImageData: ImageData | null = null;
    let optimizedImageData: ImageData | null = null;
    let thumbCanvas: HTMLCanvasElement | null = null;
    let pdfDoc: any = null;

    try {
      const effectiveParams = buildEffectiveParams(masterParams, processingToggles);
      const engine = getProcessingEngine(selectedEngineVersion);

      // 1. Render ONLY the selected page from the source PDF
      const pdfjsLib = await getPdfjsLib();
      pdfDoc = await pdfjsLib.getDocument({ data: mergedPdfBytes.slice() }).promise;
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

      // 2. Get or reuse the existing page profile
      const profile = pageProfiles[pageIndex]
        ?? await engine.analyzePage(originalImageData, pageIndex);

      // 3. Process through the engine
      const result = await engine.processPage(
        originalImageData, pageIndex, effectiveParams, profile,
      );
      optimizedImageData = result.optimizedImageData;

      // Create original blob for IDB storage BEFORE releasing ImageData
      const originalBlob = await memoryManager.imageDataToBlob(originalImageData, 0.85);

      // Release original ImageData immediately after blob creation
      originalImageData = null;

      // 4. Generate thumbnail (small, memory-cheap)
      const tw = Math.max(1, Math.round(optimizedImageData.width / 4));
      const th = Math.max(1, Math.round(optimizedImageData.height / 4));
      thumbCanvas = memoryManager.acquireCanvas(tw, th);
      const thumbCtx = thumbCanvas.getContext('2d', { willReadFrequently: true })!;

      const tmpCanvas = memoryManager.acquireCanvas(
        optimizedImageData.width, optimizedImageData.height,
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

      const thumbBlob = await new Promise<Blob>((resolve) => {
        thumbCanvas!.toBlob(
          (b) => resolve(b || new Blob([], { type: 'image/jpeg' })),
          'image/jpeg',
          0.6,
        );
      });
      memoryManager.releaseCanvas(thumbCanvas);
      thumbCanvas = null;

      const thumbUrl = memoryManager.createTrackedBlobUrl(thumbBlob);
      previewBlobUrlRef.current = thumbUrl;

      // 5. Store optimized result in IndexedDB
      const optBlob = await memoryManager.imageDataToBlob(optimizedImageData, effectiveParams.outputQuality);
      const previewPdfId = `pw_preview_${Date.now()}`;
      try {
        await pwOptimizerStorage.storePage(previewPdfId, pageIndex, originalBlob, optBlob);
      } catch {
        // IDB write failure is non-fatal for preview
      }

      // Release optimized ImageData - no longer needed
      const optWidth = optimizedImageData.width;
      const optHeight = optimizedImageData.height;
      optimizedImageData = null;

      // 6. Update ONLY the selected page in processedPages
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

    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('[PreviewReprocess] Failed:', err);
        actions.setError('Preview processing failed. Try adjusting settings.');
      }
    } finally {
      // 7. Guaranteed cleanup - release any remaining resources
      if (rawCanvas) memoryManager.releaseCanvas(rawCanvas);
      if (thumbCanvas) memoryManager.releaseCanvas(thumbCanvas);
      originalImageData = null;
      optimizedImageData = null;
      if (pdfDoc) {
        try { pdfDoc.destroy(); } catch { /* noop */ }
      }
      previewInFlightRef.current = false;
      actions.setPreviewProcessing(false);
    }
  }, [
    mergedPdfBytes, processedPages, selectedPageIndex, masterParams,
    processingToggles, selectedEngineVersion, pageProfiles, actions,
  ]);

  /* ----------------------------------------------------------------
   * handleReprocess  -  BATCH RE-PROCESS ALL PAGES
   *
   * This is the ONLY action that applies current settings to
   * every page in the document. Triggered explicitly by the
   * "Re-process All Pages" button.
   *
   * Memory Principles:
   *  - Uses the engine's processDocument which handles per-page
   *    ImageData lifecycle internally (render -> process -> store -> release).
   *  - Revokes all previous preview blob URLs before starting.
   *  - Clears progressive thumbnail cache.
   *  - Resets excluded pages since all pages are re-processed.
   * ---------------------------------------------------------------- */
  const handleReprocess = useCallback(async () => {
    if (!mergedPdfBytes) return;
    const startTime = Date.now();
    const abortController = new AbortController();
    abortRef.current = abortController;
    const pdfId = `pw_reprocess_${Date.now()}`;
    setProgressiveThumbnails(new Map());

    if (previewBlobUrlRef.current) {
      memoryManager.revokeBlobUrl(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }

    await withProcessing(async () => {
      const signal = abortController.signal;
      const service = new OptimizationService();
      const effectiveParams = buildEffectiveParams(masterParams, processingToggles);
      const { processedPages: pages, docProfile: dProf } = await service.processDocument(
        mergedPdfBytes.slice().buffer as ArrayBuffer, pdfId, effectiveParams.preset,
        selectedEngineVersion,
        (curr, total, action) => {
          if (signal.aborted) throw new Error('CANCELLED');
          actions.setProgress({
            stage: 'OPTIMIZING', currentPage: curr, totalPages: total,
            percent: Math.round((curr / total) * 100), currentAction: action,
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
  }, [mergedPdfBytes, masterParams, processingToggles, selectedEngineVersion, actions, withProcessing]);

  /* ----------------------------------------------------------------
   * handleResetSettings  -  RESET DEFAULTS
   *
   * Restores the selected preset defaults, turns OFF all manual
   * overrides, resets Stroke/Dilation to its default OFF state.
   * Updates ONLY the currently selected preview page.
   * Does NOT automatically re-process the remaining pages.
   * ---------------------------------------------------------------- */
  const handleResetSettings = useCallback(() => {
    const presetDefaults = ParameterGenerator.getPresetParameters(masterParams.preset);
    actions.setMasterParams(presetDefaults);
    actions.setProcessingToggles({ ...DEFAULT_PROCESSING_TOGGLES });
  }, [masterParams.preset, actions]);

  const compilePhase3PrintLayout = useCallback(async (config: LayoutConfig, overrideExcludedPages?: Set<number>) => {
    const startTime = Date.now();
    const abortController = new AbortController();
    abortRef.current = abortController;
    await withProcessing(async () => {
      const signal = abortController.signal;
      const activePages = LayoutService.getActivePages(processedPages, overrideExcludedPages || excludedPages);
      if (activePages.length === 0) { alert('Please include at least one page to generate layout.'); return; }
      const { finalPdfBlob, sheetPreviews, metrics } = await LayoutService.compilePrintLayout(
        activePages, config,
        (curr, total, action) => {
          if (signal.aborted) throw new Error('CANCELLED');
          actions.setProgress({
            stage: 'BUILDING_GRID', currentPage: curr, totalPages: total,
            percent: Math.round((curr / total) * 100), currentAction: action,
            elapsedMs: Date.now() - startTime,
          });
        },
      );
      if (signal.aborted) return;
      actions.setTiming({ layoutTimeMs: Math.round(Date.now() - startTime) });
      actions.setLayoutResult(finalPdfBlob, sheetPreviews, metrics);
    }, 'Failed to generate print layout PDF.', null);
    if (abortRef.current === abortController) abortRef.current = null;
  }, [processedPages, excludedPages, actions, withProcessing]);

  const handleSelectLayoutFormat = useCallback((format: GridFormat) => {
    actions.setLayoutConfig(LayoutService.updateGridFormat(layoutConfig, format));
    actions.setLayoutDirty(true);
  }, [layoutConfig, actions]);

  const handleToggleOrientation = useCallback(() => {
    actions.setLayoutConfig(LayoutService.toggleOrientation(layoutConfig));
    actions.setLayoutDirty(true);
  }, [layoutConfig, actions]);

  const handleToggleBorders = useCallback(() => {
    actions.setLayoutConfig(LayoutService.toggleBorders(layoutConfig));
    actions.setLayoutDirty(true);
  }, [layoutConfig, actions]);

  const handleTogglePageNumbers = useCallback(() => {
    actions.setLayoutConfig(LayoutService.togglePageNumbers(layoutConfig));
    actions.setLayoutDirty(true);
  }, [layoutConfig, actions]);

  const handleUpdateOuterMargins = useCallback((outerMargins: OuterMarginConfig) => {
    actions.setLayoutConfig(LayoutService.updateOuterMargins(layoutConfig, outerMargins));
    actions.setLayoutDirty(true);
  }, [layoutConfig, actions]);

  const handleUpdateInnerMargin = useCallback((innerMarginMm: number) => {
    actions.setLayoutConfig(LayoutService.updateInnerMargin(layoutConfig, innerMarginMm));
    actions.setLayoutDirty(true);
  }, [layoutConfig, actions]);

  const handleApplyLayout = useCallback(async () => {
    if (!state.layoutDirty) return;
    await compilePhase3PrintLayout(layoutConfig);
    actions.setLayoutDirty(false);
  }, [state.layoutDirty, layoutConfig, compilePhase3PrintLayout, actions]);

  const handleDownloadFinalPrintPdf = useCallback(() => {
    if (!state.finalPrintPdfBlob) return;
    ExportService.downloadBlob(state.finalPrintPdfBlob, 'PW_Print_Ready_Notes.pdf');
  }, [state.finalPrintPdfBlob]);

  const handleProceedToPhase4 = useCallback(() => {
    pwOptimizerStorage.clearCache();
    memoryManager.revokeAllBlobUrls();
    if (previewBlobUrlRef.current) {
      memoryManager.revokeBlobUrl(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    actions.setPhase(4);
  }, [actions]);

  const handleToggleExcludePage = useCallback((pageIdx: number) => {
    const next = new Set(excludedPages);
    if (next.has(pageIdx)) next.delete(pageIdx);
    else next.add(pageIdx);
    actions.setExcludedPages(next);
    if (state.currentPhase === 3 && processedPages.length > 0) {
      const activePages = LayoutService.getActivePages(processedPages, next);
      if (activePages.length > 0) setTimeout(() => compilePhase3PrintLayout(layoutConfig, next), 0);
    }
  }, [excludedPages, state.currentPhase, processedPages, layoutConfig, compilePhase3PrintLayout, actions]);

  const handleDownloadOptimized1Up = useCallback(async () => {
    let blob = state.optimized1UpBlob;
    if (!blob) {
      await withProcessing(async () => {
        blob = await ExportService.exportOptimized1Up(processedPages);
        actions.setOptimized1UpBlob(blob!);
      }, '1-up export failed.', null);
    }
    if (blob) ExportService.downloadBlob(blob, 'PW_Optimized_1Up.pdf');
  }, [state.optimized1UpBlob, processedPages, actions, withProcessing]);

  const handleProceedToPhase3 = useCallback(() => actions.setPhase(3), [actions]);

  const handleSendFeedback = useCallback(async () => {
    actions.setFeedbackSubmitted(true);
    const url = process.env.NEXT_PUBLIC_FEEDBACK_URL ||
      (window as unknown as Record<string, string>).__NEXT_FEEDBACK_URL;
    if (!url) return;
    try {
      await fetch(url, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: state.rating, feedback: state.feedbackText,
          timestamp: new Date().toLocaleString(), source: 'Notes Print Optimizer',
        }),
      });
    } catch { /* feedback is best-effort */ }
  }, [actions, state.rating, state.feedbackText]);

  return {
    state, actions,
    handleResetWorkflow, handleFilesUpload, handleLoadSamplePdf,
    handleMoveItem, handleRemoveItem, handleDownloadMerged,
    handleSmartArrange, handleReorderItem,
    handleProceedToPhase2, handleToggleExcludePage, handleDownloadOptimized1Up,
    handleProceedToPhase3, handleReprocess, handlePreviewReprocess,
    handleResetSettings,
    handleSelectLayoutFormat, handleToggleOrientation, handleToggleBorders,
    handleTogglePageNumbers, handleUpdateOuterMargins, handleUpdateInnerMargin,
    handleApplyLayout, handleDownloadFinalPrintPdf, handleProceedToPhase4,
    handleSendFeedback, compilePhase3PrintLayout,
    handleCancelProcessing, resumeInfo, handleResumeProcessing, handleDismissResume,
    progressiveThumbnails,
  };
}
