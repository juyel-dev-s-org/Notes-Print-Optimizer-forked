/**
 * useSplitWorkflow — hook driving the Split PDF tool.
 * Extract-range (single output) and burst-every-N (multi + ZIP) modes.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { isLikelyPdfFile, UploadService } from '@/lib/services/UploadService';
import { ExportService } from '@/lib/services/ExportService';
import { ImagesConverter } from '@/lib/toimages/imagesConverter';
import { buildZip } from '@/lib/toimages/zipWriter';
import { planChunks, planEvenChunks } from '../shared/chunks';
import { resolveRange } from '../shared/range';
import { sanitizeBaseName } from '../shared/filename';
import { INITIAL_SPLIT_STATE, splitReducer, buildPartName } from './splitReducer';
import { SplitService } from './splitService';
import type { SplitMode, SplitOutput } from './splitReducer';

export function useSplitWorkflow() {
  const [state, dispatch] = useReducer(splitReducer, INITIAL_SPLIT_STATE);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleUpload = useCallback(
    async (files: File[]) => {
      if (state.isBusy) return;
      const file = files[0];
      if (!file) return;
      try {
        if (!(await isLikelyPdfFile(file))) {
          dispatch({ type: 'RUN_ERROR', error: `"${file.name}" is not a PDF file.` });
          return;
        }
        const [item] = await UploadService.readFiles([file]);
        dispatch({
          type: 'SET_FILE',
          source: {
            name: item.name,
            baseName: item.name.replace(/\.pdf$/i, ''),
            sizeMB: item.sizeMB,
            bytes: new Uint8Array(item.arrayBuffer.slice(0)),
          },
        });
        void ImagesConverter.countPages(new Uint8Array(item.arrayBuffer.slice(0)))
          .then((count) => dispatch({ type: 'SET_PAGE_COUNT', count }))
          .catch(() => undefined);
      } catch {
        dispatch({ type: 'RUN_ERROR', error: 'Failed to read the selected file.' });
      }
    },
    [state.isBusy],
  );

  const canRun = useMemo(() => {
    if (!state.source || state.isBusy || !state.pageCount) return false;
    if (state.mode === 'extract') {
      return resolveRange('custom', state.rangeFrom, state.rangeTo, state.pageCount) !== null;
    }
    if (state.mode === 'every') {
      const n = Number.parseInt(state.perFile, 10);
      return Number.isFinite(n) && n >= 1 && planChunks(state.pageCount, n).length > 0;
    }
    const parts = Number.parseInt(state.partCount, 10);
    return Number.isFinite(parts) && parts >= 2 && planEvenChunks(state.pageCount, parts).length > 0;
  }, [state.source, state.isBusy, state.pageCount, state.mode, state.rangeFrom, state.rangeTo, state.perFile, state.partCount]);

  const handleRun = useCallback(async () => {
    if (!canRun || !state.source || !state.pageCount) return;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (state.mode === 'extract') {
        const range = resolveRange('custom', state.rangeFrom, state.rangeTo, state.pageCount)!;
        dispatch({ type: 'RUN_START', progress: { pct: 35, label: `Extracting pages ${range.start}–${range.end}…` } });
        const { bytes, pages } = await SplitService.extract(state.source.bytes.slice(0), range);
        if (controller.signal.aborted) return;
        dispatch({
          type: 'RUN_COMPLETE',
          kind: 'single',
          outputs: [{ name: '', blob: new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }), pages }],
        });
      } else {
        // 'every' and 'parts' share the burst pipeline — only the planner differs.
        const chunks =
          state.mode === 'every'
            ? planChunks(state.pageCount, Number.parseInt(state.perFile, 10))
            : planEvenChunks(state.pageCount, Number.parseInt(state.partCount, 10));
        dispatch({ type: 'RUN_START', progress: { pct: 10, label: `Splitting into ${chunks.length} files…` } });

        const parts = await SplitService.splitEvery(
          state.source.bytes.slice(0),
          chunks,
          (done, total) => {
            if (!controller.signal.aborted) {
              dispatch({
                type: 'RUN_PROGRESS',
                progress: { pct: 10 + Math.round((done / Math.max(1, total)) * 85), label: `Writing file ${done} of ${total}…` },
              });
            }
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        const outputs: SplitOutput[] = parts.map((part) => ({
          name: buildPartName(state.source!.baseName, part.index),
          blob: new Blob([part.bytes as unknown as BlobPart], { type: 'application/pdf' }),
          pages: part.pages,
        }));
        dispatch({ type: 'RUN_COMPLETE', kind: 'multi', outputs });
      }
    } catch (err) {
      abortRef.current = null;
      if (err instanceof Error && err.message === 'Processing cancelled.') return;
      const msg =
        err instanceof Error && /encrypt/i.test(err.message)
          ? 'This PDF is password-protected — remove the lock before splitting.'
          : 'Split failed. The PDF may be corrupted.';
      dispatch({ type: 'RUN_ERROR', error: msg });
    }
  }, [canRun, state.source, state.pageCount, state.mode, state.rangeFrom, state.rangeTo, state.perFile, state.partCount]);

  const handleCancelRun = useCallback(() => abortRef.current?.abort(), []);

  /** Single-extract download — user names it on the Done screen. */
  const handleDownloadSingle = useCallback(
    (baseName: string) => {
      if (state.kind !== 'single' || state.outputs[0] === undefined) return;
      const clean = sanitizeBaseName(baseName) || 'Extracted';
      ExportService.downloadBlob(state.outputs[0].blob, `${clean}-PrintReady.pdf`);
    },
    [state.kind, state.outputs],
  );

  const handleSaveOne = useCallback(
    (output: SplitOutput) => {
      ExportService.downloadBlob(output.blob, output.name);
    },
    [],
  );

  /** Packs every part into a STORE-only archive at download time. */
  const handleDownloadZip = useCallback(
    async (zipBase: string): Promise<void> => {
      if (state.outputs.length === 0) return;
      const clean = sanitizeBaseName(zipBase) || 'Parts';
      const entries = await Promise.all(
        state.outputs.map(async (o) => ({ name: o.name, data: new Uint8Array(await o.blob.arrayBuffer()) })),
      );
      const zip = buildZip(entries);
      ExportService.downloadBlob(new Blob([zip as unknown as BlobPart], { type: 'application/zip' }), `${clean}-PrintReady.zip`);
    },
    [state.outputs],
  );

  const handleSetMode = useCallback((mode: SplitMode) => dispatch({ type: 'SET_MODE', mode }), []);
  const handleSetRangeFrom = useCallback((value: string) => dispatch({ type: 'SET_RANGE_FROM', value }), []);
  const handleSetRangeTo = useCallback((value: string) => dispatch({ type: 'SET_RANGE_TO', value }), []);
  const handleSetPerFile = useCallback((value: string) => dispatch({ type: 'SET_PER_FILE', value }), []);
  const handleSetPartCount = useCallback((value: string) => dispatch({ type: 'SET_PART_COUNT', value }), []);
  const handleBackToOptions = useCallback(() => dispatch({ type: 'SET_STEP', step: 'options' }), []);
  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: 'RESET' });
  }, []);

  const value = useMemo(
    () => ({
      state,
      canRun,
      handleUpload,
      handleRun,
      handleCancelRun,
      handleDownloadSingle,
      handleDownloadZip,
      handleSaveOne,
      handleSetMode,
      handleSetRangeFrom,
      handleSetRangeTo,
      handleSetPerFile,
      handleSetPartCount,
      handleBackToOptions,
      handleReset,
    }),
    [state, canRun, handleUpload, handleRun, handleCancelRun, handleDownloadSingle, handleDownloadZip, handleSaveOne, handleSetMode, handleSetRangeFrom, handleSetRangeTo, handleSetPerFile, handleSetPartCount, handleBackToOptions, handleReset],
  );

  return value;
}

export type SplitWorkflow = ReturnType<typeof useSplitWorkflow>;
