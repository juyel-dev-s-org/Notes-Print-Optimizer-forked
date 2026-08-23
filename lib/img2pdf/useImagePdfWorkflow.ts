/**
 * useImagePdfWorkflow — hook driving the Image to PDF tool.
 * Multi-image queue (capped), arrange stage, honest per-image progress.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { ExportService } from '@/lib/services/ExportService';
import { sanitizeBaseName } from '../shared/filename';
import {
  INITIAL_IMAGE_PDF_STATE,
  imagePdfReducer,
} from './imagePdfReducer';
import { ImagePdfService, isLikelyImageFile, kindOf } from './imagePdfService';
import type { ImageItem, ImagePageMode } from './imagePdfReducer';

export function useImagePdfWorkflow() {
  const [state, dispatch] = useReducer(imagePdfReducer, INITIAL_IMAGE_PDF_STATE);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const canEditQueue = !state.isBusy;

  const handleUpload = useCallback(
    async (picked: File[]) => {
      if (state.isBusy) return;
      if (picked.length === 0) return;
      try {
        const items: ImageItem[] = [];
        for (const f of picked) {
          if (!isLikelyImageFile(f)) {
            dispatch({ type: 'BUILD_ERROR', error: `"${f.name}" is not a supported image (JPG, PNG or WebP).` });
            return;
          }
          items.push({
            id: `${f.name}-${f.size}-${crypto.randomUUID?.() ?? Math.random()}`,
            name: f.name,
            sizeMB: (f.size / (1024 * 1024)).toFixed(2),
            blob: f,
            kind: kindOf(f),
          });
        }
        dispatch({ type: 'ADD_FILES', files: items });
      } catch {
        dispatch({ type: 'BUILD_ERROR', error: 'Failed to read the selected images.' });
      }
    },
    [state.isBusy],
  );

  const handleBuild = useCallback(async () => {
    if (state.files.length === 0 || state.isBusy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({
      type: 'BUILD_START',
      progress: { current: 0, total: state.files.length, label: 'Preparing…' },
    });
    try {
      const { bytes, pages } = await ImagePdfService.build(
        state.files,
        state.pageMode,
        (current, total, label) => {
          if (!controller.signal.aborted) {
            dispatch({ type: 'BUILD_PROGRESS', progress: { current, total, label } });
          }
        },
        controller.signal,
      );
      dispatch({
        type: 'BUILD_COMPLETE',
        blob: new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }),
        pages,
      });
    } catch (err) {
      abortRef.current = null;
      if (err instanceof Error && err.message === 'Processing cancelled.') return;
      dispatch({
        type: 'BUILD_ERROR',
        error: err instanceof Error ? err.message : 'PDF build failed. An image may be corrupted.',
      });
    }
  }, [state.files, state.isBusy, state.pageMode]);

  const handleCancelBuild = useCallback(() => abortRef.current?.abort(), []);

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
    // Images have no natural series convention; alphabetical is the sane sort.
    const sorted = [...state.files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    dispatch({ type: 'SMART_ARRANGE', files: sorted });
  }, [canEditQueue, state.files]);

  const handleSetPageMode = useCallback((mode: ImagePageMode) => dispatch({ type: 'SET_PAGE_MODE', mode }), []);

  /** Default base name = first image's stem (Done screen field overrides). */
  const defaultBaseName = state.files[0]?.name.replace(/\.[a-z0-9]+$/i, '') ?? 'Images';

  const handleDownload = useCallback(
    (baseName: string) => {
      if (!state.resultBlob) return;
      const clean = sanitizeBaseName(baseName) || 'Images';
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
      maxFiles: 20,
      defaultBaseName,
      handleUpload,
      handleBuild,
      handleCancelBuild,
      handleMoveFile,
      handleRemoveFile,
      handleReorderFiles,
      handleSmartArrange,
      handleSetPageMode,
      handleDownload,
      handleReset,
    }),
    [state, defaultBaseName, handleUpload, handleBuild, handleCancelBuild, handleMoveFile, handleRemoveFile, handleReorderFiles, handleSmartArrange, handleSetPageMode, handleDownload, handleReset],
  );

  return value;
}

export type ImagePdfWorkflow = ReturnType<typeof useImagePdfWorkflow>;
