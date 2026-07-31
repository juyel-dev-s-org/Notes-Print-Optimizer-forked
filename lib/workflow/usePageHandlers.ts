'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkflow } from './useWorkflow';
import { UploadService, type UploadedItem } from '../services/UploadService';
import { LayoutService } from '../services/LayoutService';
import { ExportService } from '../services/ExportService';
import { OptimizationService } from '../services/OptimizationService';
import { pwOptimizerStorage } from '../optimizer/storage';
import { memoryManager } from '../optimizer/memoryManager';
import { CheckpointManager } from '../pipeline/checkpoint/CheckpointManager';
import type { GridFormat, LayoutConfig, OuterMarginConfig } from '../optimizer/types';
import type { ResumeInfo } from './types';

const checkpointManager = new CheckpointManager();

export function usePageHandlers() {
  const { state, actions } = useWorkflow();
  const { mergedPdfBytes, uploadedItems, processedPages, excludedPages, layoutConfig, selectedEngineVersion, masterParams } = state;

  const abortRef = useRef<AbortController | null>(null);
  const [resumeInfo, setResumeInfo] = useState<ResumeInfo | null>(null);
  const [progressiveThumbnails, setProgressiveThumbnails] = useState<Map<number, string>>(new Map());
  const snapshotsCheckedRef = useRef(false);

  useEffect(() => {
    pwOptimizerStorage.clearCache();
    pwOptimizerStorage.evictStaleEntries();
    memoryManager.checkStorageQuota().then(q => {
      if (q && !q.ok) console.warn(`[Storage] ${q.percentUsed.toFixed(0)}% used — near quota`);
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
      const updatedList = [...uploadedItems, ...items];
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
      const { processedPages: pages, docProfile: dProf } = await service.processDocument(
        mergedPdfBytes.buffer as ArrayBuffer, pdfId, masterParams.preset,
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
        masterParams,
      );
      if (signal.aborted) return;
      actions.setTiming({
        analysisTimeMs: Math.round((Date.now() - startTime) * 0.15),
        optimizationTimeMs: Math.round((Date.now() - startTime) * 0.85),
      });
      actions.setDocProfile(dProf);
      actions.setPageProfiles(dProf.pages);
      actions.setProcessedPages(pages);
      // Keep mergedPdfBytes for potential re-processing with adjusted params
      actions.setPhase(2);
      await checkpointManager.remove(pdfId);
    }, 'Processing failed due to browser memory limits.', null);
    if (abortRef.current === abortController) abortRef.current = null;
  }, [mergedPdfBytes, masterParams, selectedEngineVersion, actions, withProcessing]);

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

  /** Re-process document with updated parameters (from settings panel) */
  const handleReprocess = useCallback(async () => {
    if (!mergedPdfBytes) return;
    const startTime = Date.now();
    const abortController = new AbortController();
    abortRef.current = abortController;
    const pdfId = `pw_reprocess_${Date.now()}`;
    setProgressiveThumbnails(new Map());
    await withProcessing(async () => {
      const signal = abortController.signal;
      const service = new OptimizationService();
      const { processedPages: pages, docProfile: dProf } = await service.processDocument(
        mergedPdfBytes.buffer as ArrayBuffer, pdfId, masterParams.preset,
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
        masterParams,
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
  }, [mergedPdfBytes, masterParams, selectedEngineVersion, actions, withProcessing]);

  return {
    state, actions,
    handleResetWorkflow, handleFilesUpload, handleLoadSamplePdf,
    handleMoveItem, handleRemoveItem, handleDownloadMerged,
    handleProceedToPhase2, handleToggleExcludePage, handleDownloadOptimized1Up,
    handleProceedToPhase3, handleReprocess,
    handleSelectLayoutFormat, handleToggleOrientation, handleToggleBorders,
    handleTogglePageNumbers, handleUpdateOuterMargins, handleUpdateInnerMargin,
    handleApplyLayout, handleDownloadFinalPrintPdf, handleProceedToPhase4,
    handleSendFeedback, compilePhase3PrintLayout,
    handleCancelProcessing, resumeInfo, handleResumeProcessing, handleDismissResume,
    progressiveThumbnails,
  };
}
