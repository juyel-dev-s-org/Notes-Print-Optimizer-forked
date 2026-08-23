/**
 * useMergeWorkflow — hook driving the Merge PDFs tool.
 * Multi-upload (capped), arrange stage reuse, honest per-file progress.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { isLikelyPdfFile, UploadService } from '@/lib/services/UploadService';
import { ExportService } from '@/lib/services/ExportService';
import { planSmartOrder } from '@/lib/rearrange';
import { sanitizeBaseName } from '../shared/filename';
import { MAX_MERGE_FILES, INITIAL_MERGE_STATE, mergeReducer } from './mergeReducer';
import { MergeService } from './mergeService';

export function useMergeWorkflow() {
  const [state, dispatch] = useReducer(mergeReducer, INITIAL_MERGE_STATE);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const canEditQueue = !state.isBusy;

  const handleUpload = useCallback(
    async (picked: File[]) => {
      if (state.isBusy) return;
      const room = MAX_MERGE_FILES - state.files.length;
      if (room <= 0) {
        dispatch({ type: 'MERGE_ERROR', error: `Maximum of ${MAX_MERGE_FILES} files per merge.` });
        return;
      }
      const files = picked.slice(0, room);
      if (files.length === 0) return;
      try {
        for (const f of files) {
          if (!(await isLikelyPdfFile(f))) {
            dispatch({ type: 'MERGE_ERROR', error: `"${f.name}" is not a PDF file.` });
            return;
          }
        }
        const items = await UploadService.readFiles(files);
        dispatch({ type: 'SET_FILES', files: [...state.files, ...items] });
      } catch {
        dispatch({ type: 'MERGE_ERROR', error: 'Failed to read the selected files.' });
      }
    },
    [state.isBusy, state.files],
  );

  const handleMerge = useCallback(async () => {
    if (state.files.length < 2 || state.isBusy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: 'MERGE_START' });
    try {
      const { bytes, pages } = await MergeService.merge(
        state.files,
        (done, total, label) => {
          if (!controller.signal.aborted) {
            dispatch({ type: 'MERGE_PROGRESS', progress: { current: done, total, label } });
          }
        },
        controller.signal,
      );
      dispatch({
        type: 'MERGE_COMPLETE',
        blob: new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }),
        pages,
      });
    } catch (err) {
      abortRef.current = null;
      if (err instanceof Error && err.message === 'Processing cancelled.') return;
      const msg =
        err instanceof Error && /encrypt/i.test(err.message)
          ? 'An encrypted PDF cannot be merged — remove its password first.'
          : 'Merge failed. One of the files may be corrupted.';
      dispatch({ type: 'MERGE_ERROR', error: msg });
    }
  }, [state.files, state.isBusy]);

  const handleCancelMerge = useCallback(() => abortRef.current?.abort(), []);

  const handleMoveFile = useCallback(
    (index: number, direction: 'UP' | 'DOWN') => {
      if (!canEditQueue) return;
      dispatch({ type: 'MOVE_FILE', index, direction });
    },
    [canEditQueue],
  );

  const handleRemoveFile = useCallback(
    (index: number) => {
      if (!canEditQueue) return;
      dispatch({ type: 'REMOVE_FILE', index });
    },
    [canEditQueue],
  );

  const handleReorderFiles = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!canEditQueue) return;
      dispatch({ type: 'REORDER_FILES', fromIndex, toIndex });
    },
    [canEditQueue],
  );

  const handleSmartArrange = useCallback(() => {
    if (!canEditQueue || state.files.length < 2) return;
    const plan = planSmartOrder(state.files);
    if (!plan.changed) return;
    dispatch({ type: 'SMART_ARRANGE', files: plan.orderedItems });
  }, [canEditQueue, state.files]);

  const handleDownload = useCallback(
    (baseName: string) => {
      if (!state.resultBlob) return;
      const clean = sanitizeBaseName(baseName) || 'Merged';
      ExportService.downloadBlob(state.resultBlob, `${clean}-PrintReady.pdf`);
    },
    [state.resultBlob],
  );

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: 'RESET' });
  }, []);

  const value = useMemo(
    () => ({
      state,
      maxFiles: MAX_MERGE_FILES,
      handleUpload,
      handleMerge,
      handleCancelMerge,
      handleMoveFile,
      handleRemoveFile,
      handleReorderFiles,
      handleSmartArrange,
      handleDownload,
      handleReset,
    }),
    [state, handleUpload, handleMerge, handleCancelMerge, handleMoveFile, handleRemoveFile, handleReorderFiles, handleSmartArrange, handleDownload, handleReset],
  );

  return value;
}

export type MergeWorkflow = ReturnType<typeof useMergeWorkflow>;
