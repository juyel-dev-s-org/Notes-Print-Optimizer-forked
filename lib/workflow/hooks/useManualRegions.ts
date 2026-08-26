'use client';

import { useCallback } from 'react';
import { LayoutService } from '../../services/LayoutService';
import type { LayoutConfig, ProcessedPage } from '../../optimizer/types';
import type { WhiteBoxRegion } from '../../kernels/whiteBox';
import type { WorkflowActions } from '../useWorkflow';

interface ManualRegionsParams {
  processedPages: ProcessedPage[];
  excludedPages: Set<number>;
  manualWhiteBoxRegions: Record<number, WhiteBoxRegion[]>;
  keepOriginalPages: Set<number>;
  mergedPdfBytes: Uint8Array | null;
  layoutConfig: LayoutConfig;
  currentPhase: number;
  actions: WorkflowActions;
  compilePhase3PrintLayout: (
    config: LayoutConfig,
    overrideExcludedPages?: Set<number>,
    overrideKeepOriginal?: Set<number>,
    overrideManualRegions?: Record<number, WhiteBoxRegion[]>,
  ) => Promise<void>;
  excludeLayoutTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  excludeLayoutArgsRef: React.MutableRefObject<{
    config: LayoutConfig;
    excluded: Set<number>;
    keepOriginal: Set<number>;
    manualRegions: Record<number, WhiteBoxRegion[]>;
  } | null>;
}

/**
 * Manual white-box regions: user-drawn rects/ellipses that the auto detector
 * missed. Edits are tiny JSON (x,y,w,h,shape) — no image duplication.
 * Export composites them at export time; the hook also debounces a
 * phase-3 re-layout so sheet previews reflect the edit.
 */
export function useManualRegions({
  processedPages,
  excludedPages,
  manualWhiteBoxRegions,
  keepOriginalPages,
  mergedPdfBytes,
  layoutConfig,
  currentPhase,
  actions,
  compilePhase3PrintLayout,
  excludeLayoutTimerRef,
  excludeLayoutArgsRef,
}: ManualRegionsParams) {
  const scheduleRelayout = useCallback(
    (nextManual: Record<number, WhiteBoxRegion[]>) => {
      if (!(currentPhase === 3 && processedPages.length > 0)) return;
      const activePages = LayoutService.getActivePages(processedPages, excludedPages);
      if (activePages.length === 0) return;
      excludeLayoutArgsRef.current = {
        config: layoutConfig,
        excluded: excludedPages,
        keepOriginal: keepOriginalPages,
        manualRegions: nextManual,
      };
      if (excludeLayoutTimerRef.current) clearTimeout(excludeLayoutTimerRef.current);
      excludeLayoutTimerRef.current = setTimeout(() => {
        excludeLayoutTimerRef.current = null;
        const args = excludeLayoutArgsRef.current;
        if (args) compilePhase3PrintLayout(args.config, args.excluded, args.keepOriginal, args.manualRegions);
      }, 400);
    },
    [currentPhase, processedPages, excludedPages, keepOriginalPages, layoutConfig, compilePhase3PrintLayout, excludeLayoutTimerRef, excludeLayoutArgsRef],
  );

  const regenerateThumbnail = useCallback(async (pageIndex: number, regions: WhiteBoxRegion[]) => {
    const page = processedPages.find((p) => p.pageIndex === pageIndex);
    if (!page) return;
    try {
      const { PdfExporter } = await import('../../optimizer/pdfExporter');
      const { compositeWhiteBoxRegions } = await import('../../kernels/whiteBox');
      const { memoryManager } = await import('../../optimizer/memoryManager');
      // Load current optimized (auto-healed) and original at same scale
      const opt = await PdfExporter.loadOptimizedImageData(page);
      let displayData = opt;
      if (regions.length > 0 && mergedPdfBytes) {
        const orig = await PdfExporter.loadOriginalImageData(page, mergedPdfBytes, opt.width);
        if (orig.width === opt.width && orig.height === opt.height) {
          compositeWhiteBoxRegions(opt.data, orig.data, opt.width, opt.height, regions, 0);
          displayData = opt;
        }
      }
      // Downscale to thumbnail (same as ProcessingEngineV2.generateThumbnail 1/5)
      const tw = Math.max(1, Math.round(displayData.width / 5));
      const th = Math.max(1, Math.round(displayData.height / 5));
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = displayData.width;
      srcCanvas.height = displayData.height;
      srcCanvas.getContext('2d')!.putImageData(displayData, 0, 0);
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = tw;
      thumbCanvas.height = th;
      thumbCanvas.getContext('2d')!.drawImage(srcCanvas, 0, 0, tw, th);
      const blob = await new Promise<Blob>((res) => thumbCanvas.toBlob((b) => res(b || new Blob()), 'image/jpeg', 0.6));
      // Revoke old thumbnail URL and track new one
      memoryManager.revokeBlobUrl(page.thumbnailDataUrl);
      const newUrl = memoryManager.createTrackedBlobUrl(blob);
      const updated: ProcessedPage = { ...page, thumbnailDataUrl: newUrl };
      actions.updateSingleProcessedPage(pageIndex, updated);
    } catch (e) {
      console.warn('[manualRegions] thumbnail regen failed for page', pageIndex, e);
    }
  }, [processedPages, mergedPdfBytes, actions]);

  const handleSetManualRegions = useCallback(
    (pageIndex: number, regions: WhiteBoxRegion[]) => {
      actions.setManualWhiteBoxRegions(pageIndex, regions);
      const nextManual = { ...manualWhiteBoxRegions };
      if (regions.length === 0) delete nextManual[pageIndex];
      else nextManual[pageIndex] = regions;
      scheduleRelayout(nextManual);
      // Fire-and-forget thumbnail refresh so the grid shows the edit
      void regenerateThumbnail(pageIndex, regions);
    },
    [manualWhiteBoxRegions, actions, scheduleRelayout, regenerateThumbnail],
  );

  const handleClearManualRegions = useCallback(
    (pageIndex: number) => {
      actions.clearManualWhiteBoxRegions(pageIndex);
      const nextManual = { ...manualWhiteBoxRegions };
      delete nextManual[pageIndex];
      scheduleRelayout(nextManual);
      void regenerateThumbnail(pageIndex, []);
    },
    [manualWhiteBoxRegions, actions, scheduleRelayout, regenerateThumbnail],
  );

  return { handleSetManualRegions, handleClearManualRegions };
}
