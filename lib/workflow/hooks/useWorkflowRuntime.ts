'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkflow } from '../useWorkflow';
import { memoryManager } from '../../optimizer/memoryManager';
import { pwOptimizerStorage } from '../../optimizer/storage';
import type { LayoutConfig, ProcessingProgress } from '../../optimizer/types';

/** The shared processing guard passed to every domain hook. */
export type WithProcessingFn = <T>(
  fn: () => Promise<T>,
  errorMsg: string,
  stage: ProcessingProgress | null,
) => Promise<T | undefined>;

type PreviewPdfDoc = { bytes: Uint8Array; doc: unknown } | null;

/**
 * Shared runtime for the whole page-handler domain: abort plumbing,
 * processing guard, progressive thumbnail cache and the preview/pdf-doc
 * blob lifecycle. Domain hooks receive these as parameters.
 */
export function useWorkflowRuntime() {
  const { state, actions } = useWorkflow();

  const abortRef = useRef<AbortController | null>(null);
  const [progressiveThumbnails, setProgressiveThumbnails] = useState<Map<number, string>>(new Map());

  /**
   * Tracks the blob URL of the current single-page preview so it can be
   * revoked before a new one is created (prevents orphaned blob leaks).
   */
  const previewBlobUrlRef = useRef<string | null>(null);
  const previewPdfDocRef = useRef<PreviewPdfDoc>(null);

  /* Debounced phase-3 re-layout on exclude / keep-original toggles */
  const excludeLayoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const excludeLayoutArgsRef = useRef<{
    config: LayoutConfig;
    excluded: Set<number>;
    keepOriginal: Set<number>;
  } | null>(null);

  /** Revokes the cached preview blob URL + destroys the cached pdfjs doc. */
  const revokePreviewAssets = useCallback(() => {
    if (previewBlobUrlRef.current) {
      memoryManager.revokeBlobUrl(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    if (previewPdfDocRef.current?.doc) {
      try {
        (previewPdfDocRef.current.doc as { destroy?: () => void }).destroy?.();
      } catch {
        /* noop */
      }
      previewPdfDocRef.current = null;
    }
  }, []);

  const clearProgressiveThumbnails = useCallback(() => setProgressiveThumbnails(new Map()), []);

  useEffect(() => {
    pwOptimizerStorage.clearCache();
    pwOptimizerStorage.evictStaleEntries();
    memoryManager.checkStorageQuota().then(q => {
      if (q && !q.ok) console.warn(`[Storage] ${q.percentUsed.toFixed(0)}% used - near quota`);
    });
    const handleUnload = () => {
      pwOptimizerStorage.clearCache();
      memoryManager.revokeAllBlobUrls();
      if (previewPdfDocRef.current?.doc) {
        try {
          (previewPdfDocRef.current.doc as { destroy?: () => void }).destroy?.();
        } catch {
          /* noop */
        }
        previewPdfDocRef.current = null;
      }
    };
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('pagehide', handleUnload);
    };
  }, []);

  /* Cleanup preview blob + pending layout debounce on unmount */
  useEffect(() => {
    return () => {
      if (previewBlobUrlRef.current) {
        memoryManager.revokeBlobUrl(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
      if (previewPdfDocRef.current?.doc) {
        try {
          (previewPdfDocRef.current.doc as { destroy?: () => void }).destroy?.();
        } catch {
          /* noop */
        }
        previewPdfDocRef.current = null;
      }
      if (excludeLayoutTimerRef.current) {
        clearTimeout(excludeLayoutTimerRef.current);
        excludeLayoutTimerRef.current = null;
      }
    };
  }, []);

  const withProcessing = useCallback(
    async <T,>(
      fn: () => Promise<T>,
      errorMsg: string,
      stage: Parameters<typeof actions.setProgress>[0],
    ): Promise<T | undefined> => {
      actions.setError(null);
      actions.setProcessing(true);
      if (stage) actions.setProgress(stage);
      try {
        return await fn();
      } catch (err: unknown) {
        const e = err as { name?: string; message?: string };
        if (e?.name === 'AbortError' || e?.message === 'CANCELLED') {
          return undefined;
        }
        console.error(err);
        actions.setError(errorMsg);
        return undefined;
      } finally {
        actions.setProcessing(false);
        actions.setProgress(null);
      }
    },
    [actions],
  );

  return {
    state,
    actions,
    abortRef,
    withProcessing,
    progressiveThumbnails,
    setProgressiveThumbnails,
    clearProgressiveThumbnails,
    previewBlobUrlRef,
    previewPdfDocRef,
    excludeLayoutTimerRef,
    excludeLayoutArgsRef,
    revokePreviewAssets,
  };
}

export type WorkflowRuntime = ReturnType<typeof useWorkflowRuntime>;
