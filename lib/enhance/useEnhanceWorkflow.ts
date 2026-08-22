/**
 * useEnhanceWorkflow — React hook driving the Enhance Light PDF tool.
 *
 * Composes the pure reducer with the processor/exporter and the shared
 * UploadService. Uploading lands on an arrange stage (reorder / remove /
 * Smart Arrange); enhancement only starts when the user taps "Enhance PDF".
 * Slider changes queue a manual "Apply" re-process; exports build the
 * print-ready PDF fully on-device. Owns an AbortController so long jobs
 * can be cancelled.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { isLikelyPdfFile, UploadService } from '@/lib/services/UploadService';
import { planSmartOrder } from '@/lib/rearrange';
import { buildEnhanceFileName, enhanceReducer } from './enhanceReducer';
import { EnhanceExporter } from './enhanceExporter';
import { EnhanceProcessor } from './enhanceProcessor';
import { MAX_ENHANCE_FILES, INITIAL_ENHANCE_STATE, type EnhanceSettings } from './types';

export function useEnhanceWorkflow() {
  const [state, dispatch] = useReducer(enhanceReducer, INITIAL_ENHANCE_STATE);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  const runProcessing = useCallback(async (items: Parameters<typeof EnhanceProcessor.process>[0], settings: EnhanceSettings) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;
    dispatch({ type: 'PROCESS_START' });
    try {
      const results = await EnhanceProcessor.process(
        items,
        settings,
        (p) => dispatch({ type: 'PROCESS_PROGRESS', progress: p }),
        signal,
      );
      if (signal.aborted) return;
      dispatch({ type: 'PROCESS_COMPLETE', results, fileName: buildEnhanceFileName(items) });
    } catch (err) {
      if (signal.aborted) {
        if (abortRef.current?.signal === signal) {
          dispatch({ type: 'PROCESS_CANCEL' });
        }
        return;
      }
      if (err instanceof Error && err.message === 'Processing cancelled.') {
        if (abortRef.current?.signal === signal) {
          dispatch({ type: 'PROCESS_CANCEL' });
        }
        return;
      }
      dispatch({
        type: 'PROCESS_ERROR',
        error: err instanceof Error ? err.message : 'Enhancement failed.',
      });
    }
  }, []);

  const handleUpload = useCallback(async (files: File[]) => {
    if (state.isProcessing || state.exportBusy) return;
    const pdfs = files.slice(0, MAX_ENHANCE_FILES);
    if (pdfs.length === 0) {
      dispatch({ type: 'PROCESS_ERROR', error: 'No files selected.' });
      return;
    }
    try {
      for (const f of pdfs) {
        if (!(await isLikelyPdfFile(f))) {
          dispatch({ type: 'PROCESS_ERROR', error: `"${f.name}" is not a PDF file.` });
          return;
        }
      }
      const items = await UploadService.readFiles(pdfs);
      // Adding from the arrange stage appends; uploading fresh replaces.
      const base = state.step === 'arrange' ? state.files : [];
      const merged = [...base, ...items].slice(0, MAX_ENHANCE_FILES);
      dispatch({ type: 'SET_FILES', files: merged, step: 'arrange' });
    } catch {
      dispatch({ type: 'PROCESS_ERROR', error: 'Failed to read the selected files.' });
    }
  }, [state.isProcessing, state.exportBusy, state.step, state.files]);

  /** Explicit start — the only path that kicks off enhancement. */
  const handleStartEnhance = useCallback(() => {
    if (state.files.length === 0 || state.isProcessing || state.exportBusy) return;
    dispatch({ type: 'SET_STEP', step: 'enhance' });
    void runProcessing(state.files, state.settings);
  }, [state.files, state.isProcessing, state.exportBusy, state.settings, runProcessing]);

  const canEditQueue = !state.isProcessing && !state.exportBusy;

  const handleMoveFile = useCallback((index: number, direction: 'UP' | 'DOWN') => {
    if (!canEditQueue) return;
    dispatch({ type: 'MOVE_FILE', index, direction });
  }, [canEditQueue]);

  const handleReorderFiles = useCallback((fromIndex: number, toIndex: number) => {
    if (!canEditQueue) return;
    dispatch({ type: 'REORDER_FILES', fromIndex, toIndex });
  }, [canEditQueue]);

  const handleRemoveFile = useCallback((index: number) => {
    if (!canEditQueue) return;
    dispatch({ type: 'REMOVE_FILE', index });
  }, [canEditQueue]);

  const handleSmartArrange = useCallback(() => {
    if (!canEditQueue || state.files.length < 2) return;
    const plan = planSmartOrder(state.files);
    if (!plan.changed) return;
    dispatch({ type: 'SMART_ARRANGE', files: plan.orderedItems });
  }, [canEditQueue, state.files]);

  const handleBackToArrange = useCallback(() => {
    if (state.isProcessing || state.exportBusy) return;
    dispatch({ type: 'BACK_TO_ARRANGE' });
  }, [state.isProcessing, state.exportBusy]);

  const handleApplySettings = useCallback(() => {
    if (state.files.length === 0 || state.isProcessing || state.exportBusy) return;
    void runProcessing(state.files, state.settings);
  }, [state.files, state.isProcessing, state.exportBusy, state.settings, runProcessing]);

  const handleCancelProcessing = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSetSettings = useCallback((settings: EnhanceSettings) => {
    dispatch({ type: 'SET_SETTINGS', settings });
  }, []);

  const handleSetSelected = useCallback((index: number) => {
    dispatch({ type: 'SET_SELECTED', index });
  }, []);

  const triggerBrowserDownload = useCallback((blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, []);

  /** One tap: build the print-ready PDF and hand it straight to the browser. */
  const handleDownloadPrintPdf = useCallback(async () => {
    if (state.results.length === 0 || state.exportBusy) return;
    dispatch({ type: 'EXPORT_START' });
    try {
      const blob = await EnhanceExporter.exportPdf(state.results, () => undefined);
      dispatch({ type: 'EXPORT_COMPLETE', blob, fileName: state.fileName });
      triggerBrowserDownload(blob, state.fileName);
    } catch {
      dispatch({ type: 'EXPORT_ERROR', error: 'Failed to build the print PDF.' });
    }
  }, [state.results, state.exportBusy, state.fileName, triggerBrowserDownload]);

  const handleSharePdf = useCallback(async () => {
    if (!state.pdfBlob || typeof navigator === 'undefined' || !('share' in navigator)) return;
    try {
      const file = new File([state.pdfBlob], state.fileName, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: state.fileName });
      } else {
        await navigator.share({ title: state.fileName });
      }
    } catch {
      /* user cancelled */
    }
  }, [state.pdfBlob, state.fileName]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: 'RESET' });
  }, []);

  const value = useMemo(
    () => ({
      state,
      handleUpload,
      handleStartEnhance,
      handleMoveFile,
      handleReorderFiles,
      handleRemoveFile,
      handleSmartArrange,
      handleBackToArrange,
      handleApplySettings,
      handleCancelProcessing,
      handleSetSettings,
      handleSetSelected,
      handleDownloadPrintPdf,
      handleSharePdf,
      handleReset,
    }),
    [state, handleUpload, handleStartEnhance, handleMoveFile, handleReorderFiles, handleRemoveFile, handleSmartArrange, handleBackToArrange, handleApplySettings, handleCancelProcessing, handleSetSettings, handleSetSelected, handleDownloadPrintPdf, handleSharePdf, handleReset],
  );

  return value;
}

export type EnhanceWorkflow = ReturnType<typeof useEnhanceWorkflow>;