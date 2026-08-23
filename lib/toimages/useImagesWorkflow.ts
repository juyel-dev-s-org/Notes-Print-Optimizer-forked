/**
 * useImagesWorkflow — hook driving the PDF to Images tool.
 * Real per-page progress, cancellable conversion, lazy ZIP build.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { isLikelyPdfFile, UploadService } from '@/lib/services/UploadService';
import { ExportService } from '@/lib/services/ExportService';
import { sanitizeBaseName } from '../shared/filename';
import {
  DPI_PRESETS,
  INITIAL_IMAGES_STATE,
  imagesReducer,
  resolveRange,
  type DpiPresetId,
  type ImagesFormat,
  type PageOutput,
} from './imagesReducer';
import { FORMAT_EXT, ImagesConverter } from './imagesConverter';
import { buildZip } from './zipWriter';

const MAX_PAGES = 200;

export function useImagesWorkflow() {
  const [state, dispatch] = useReducer(imagesReducer, INITIAL_IMAGES_STATE);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleUpload = useCallback(
    async (files: File[]) => {
      if (state.isBusy) return;
      const file = files[0];
      if (!file) return;
      try {
        if (!(await isLikelyPdfFile(file))) {
          dispatch({ type: 'CONVERT_ERROR', error: `"${file.name}" is not a PDF file.` });
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
        // Page count resolves right after landing on the options screen.
        void ImagesConverter.countPages(new Uint8Array(item.arrayBuffer.slice(0)))
          .then((count) => dispatch({ type: 'SET_PAGE_COUNT', count }))
          .catch(() => undefined);
      } catch {
        dispatch({ type: 'CONVERT_ERROR', error: 'Failed to read the selected file.' });
      }
    },
    [state.isBusy],
  );

  const handleConvert = useCallback(async () => {
    if (!state.source || state.isBusy) return;

    const range = resolveRange(state.rangeMode, state.rangeFrom, state.rangeTo, state.pageCount);
    let total = range ? range.end - range.start + 1 : 0;
    if (total <= 0) {
      dispatch({ type: 'CONVERT_ERROR', error: 'Check the selected page range.' });
      return;
    }
    if (total > MAX_PAGES) total = MAX_PAGES; // hard mobile memory guard

    const preset = DPI_PRESETS.find((p) => p.id === state.dpi) ?? DPI_PRESETS[1];
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: 'CONVERT_START', total });

    const results: PageOutput[] = [];
    try {
      await ImagesConverter.convert(
        state.source.bytes.slice(0),
        {
          dpi: preset.dpi,
          format: state.format,
          quality: state.quality,
          fromPage: range!.start,
          toPage: range!.end,
        },
        ({ index, blob, thumbDataUrl }) => {
          // index is the absolute 0-based page — names stay traceable to the document.
          results.push({
            blob,
            thumbDataUrl,
            name: `${state.source!.baseName}-p${String(index + 1).padStart(2, '0')}.${FORMAT_EXT[state.format]}`,
          });
          dispatch({ type: 'CONVERT_PROGRESS', current: results.length });
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      dispatch({ type: 'CONVERT_COMPLETE', results: results.slice(0, MAX_PAGES) });
    } catch (err) {
      abortRef.current = null;
      if (err instanceof Error && err.message === 'Processing cancelled.') return;
      dispatch({ type: 'CONVERT_ERROR', error: 'Conversion failed. The PDF may be corrupted.' });
    }
  }, [state.source, state.isBusy, state.pageCount, state.rangeMode, state.rangeFrom, state.rangeTo, state.dpi, state.format, state.quality]);

  const canConvert =
    !!state.source &&
    !state.isBusy &&
    resolveRange(state.rangeMode, state.rangeFrom, state.rangeTo, state.pageCount) !== null;

  const handleCancelConvert = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** Builds the STORE-only archive lazily at download time. */
  const handleDownloadZip = useCallback(
    async (zipBase: string): Promise<void> => {
      if (state.results.length === 0) return;
      const clean = sanitizeBaseName(zipBase) || 'Images';
      const entries = await Promise.all(
        state.results.map(async (r) => ({ name: r.name, data: new Uint8Array(await r.blob.arrayBuffer()) })),
      );
      const zip = buildZip(entries);
      ExportService.downloadBlob(new Blob([zip as unknown as BlobPart], { type: 'application/zip' }), `${clean}-PrintReady.zip`);
    },
    [state.results],
  );

  const handleDownloadSingle = useCallback((page: PageOutput) => {
    ExportService.downloadBlob(page.blob, page.name);
  }, []);

  const handleSetDpi = useCallback((dpi: DpiPresetId) => dispatch({ type: 'SET_DPI', dpi }), []);
  const handleSetFormat = useCallback((format: ImagesFormat) => dispatch({ type: 'SET_FORMAT', format }), []);
  const handleSetQuality = useCallback((quality: number) => dispatch({ type: 'SET_QUALITY', quality }), []);
  const handleSetRangeMode = useCallback((mode: 'all' | 'custom') => dispatch({ type: 'SET_RANGE_MODE', mode }), []);
  const handleSetRangeFrom = useCallback((value: string) => dispatch({ type: 'SET_RANGE_FROM', value }), []);
  const handleSetRangeTo = useCallback((value: string) => dispatch({ type: 'SET_RANGE_TO', value }), []);
  const handleBackToOptions = useCallback(() => dispatch({ type: 'SET_STEP', step: 'options' }), []);
  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: 'RESET' });
  }, []);

  const value = useMemo(
    () => ({
      state,
      canConvert,
      handleUpload,
      handleConvert,
      handleCancelConvert,
      handleDownloadZip,
      handleDownloadSingle,
      handleSetDpi,
      handleSetFormat,
      handleSetQuality,
      handleSetRangeMode,
      handleSetRangeFrom,
      handleSetRangeTo,
      handleBackToOptions,
      handleReset,
    }),
    [state, canConvert, handleUpload, handleConvert, handleCancelConvert, handleDownloadZip, handleDownloadSingle, handleSetDpi, handleSetFormat, handleSetQuality, handleSetRangeMode, handleSetRangeFrom, handleSetRangeTo, handleBackToOptions, handleReset],
  );

  return value;
}

export type ImagesWorkflow = ReturnType<typeof useImagesWorkflow>;
