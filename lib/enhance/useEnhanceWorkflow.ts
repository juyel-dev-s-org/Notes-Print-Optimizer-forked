/**
 * useEnhanceWorkflow — React hook driving the Enhance Light PDF tool.
 *
 * Composes the pure reducer with the processor/exporter and the shared
 * UploadService. Uploading a PDF auto-starts enhancement (same pattern as
 * the main flow); slider changes queue a manual "Apply" re-process; exports
 * build the print-ready PDF fully on-device. Owns an AbortController so
 * long jobs can be cancelled.
 */

import { useCallback, useMemo, useReducer, useRef } from 'react';
import { isLikelyPdfFile, UploadService } from '@/lib/services/UploadService';
import { buildEnhanceFileName, enhanceReducer } from './enhanceReducer';
import { EnhanceExporter } from './enhanceExporter';
import { EnhanceProcessor } from './enhanceProcessor';
import { INITIAL_ENHANCE_STATE, type EnhanceSettings } from './types';

const MAX_FILES = 10;

export function useEnhanceWorkflow() {
  const [state, dispatch] = useReducer(enhanceReducer, INITIAL_ENHANCE_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const runProcessing = useCallback(async (items: Parameters<typeof EnhanceProcessor.process>[0], settings: EnhanceSettings) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    dispatch({ type: 'PROCESS_START' });
    try {
      const results = await EnhanceProcessor.process(
        items,
        settings,
        (p) => dispatch({ type: 'PROCESS_PROGRESS', progress: p }),
        abortRef.current.signal,
      );
      dispatch({ type: 'PROCESS_COMPLETE', results, fileName: buildEnhanceFileName(items) });
    } catch (err) {
      if (err instanceof Error && err.message === 'Processing cancelled.') {
        dispatch({ type: 'RESET' });
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
    const pdfs = files.slice(0, MAX_FILES);
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
      dispatch({ type: 'SET_FILES', files: items, step: 'enhance' });
      void runProcessing(items, state.settings);
    } catch {
      dispatch({ type: 'PROCESS_ERROR', error: 'Failed to read the selected files.' });
    }
  }, [state.isProcessing, state.exportBusy, state.settings, runProcessing]);

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

  const handleExport = useCallback(async () => {
    if (state.results.length === 0 || state.exportBusy) return;
    dispatch({ type: 'EXPORT_START' });
    try {
      const blob = await EnhanceExporter.exportPdf(state.results, () => undefined);
      dispatch({ type: 'EXPORT_COMPLETE', blob, fileName: state.fileName });
    } catch {
      dispatch({ type: 'EXPORT_ERROR', error: 'Failed to build the print PDF.' });
    }
  }, [state.results, state.exportBusy, state.fileName]);

  const handleDownload = useCallback(() => {
    if (!state.pdfBlob) return;
    const url = URL.createObjectURL(state.pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = state.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, [state.pdfBlob, state.fileName]);

  const handleBackToWorkbench = useCallback(() => {
    dispatch({ type: 'SET_STEP', step: 'enhance' });
  }, []);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: 'RESET' });
  }, []);

  const value = useMemo(
    () => ({
      state,
      handleUpload,
      handleApplySettings,
      handleCancelProcessing,
      handleSetSettings,
      handleSetSelected,
      handleExport,
      handleDownload,
      handleBackToWorkbench,
      handleReset,
    }),
    [state, handleUpload, handleApplySettings, handleCancelProcessing, handleSetSettings, handleSetSelected, handleExport, handleDownload, handleBackToWorkbench, handleReset],
  );

  return value;
}

export type EnhanceWorkflow = ReturnType<typeof useEnhanceWorkflow>;