'use client';

import { useCallback } from 'react';
import { LayoutService } from '../../services/LayoutService';
import type {
  GridFormat,
  LayoutConfig,
  OuterMarginConfig,
  ProcessedPage,
} from '../../optimizer/types';
import type { WorkflowActions } from '../useWorkflow';
import type { WithProcessingFn } from './useWorkflowRuntime';

interface LayoutEngineParams {
  processedPages: ProcessedPage[];
  excludedPages: Set<number>;
  keepOriginalPages: Set<number>;
  manualWhiteBoxRegions: Record<number, import('../../kernels/whiteBox').WhiteBoxRegion[]>;
  mergedPdfBytes: Uint8Array | null;
  layoutConfig: LayoutConfig;
  layoutDirty: boolean;
  actions: WorkflowActions;
  abortRef: React.MutableRefObject<AbortController | null>;
  withProcessing: WithProcessingFn;
}

/**
 * Phase-3 layout domain: N-Up config mutations, print-sheet
 * compilation and the apply/render cycle.
 */
export function useLayoutEngine({
  processedPages,
  excludedPages,
  keepOriginalPages,
  manualWhiteBoxRegions,
  mergedPdfBytes,
  layoutConfig,
  layoutDirty,
  actions,
  abortRef,
  withProcessing,
}: LayoutEngineParams) {
  const compilePhase3PrintLayout = useCallback(
    async (
      config: LayoutConfig,
      overrideExcludedPages?: Set<number>,
      overrideKeepOriginal?: Set<number>,
      overrideManualRegions?: Record<number, import('../../kernels/whiteBox').WhiteBoxRegion[]>,
    ) => {
      const startTime = Date.now();
      const abortController = new AbortController();
      abortRef.current = abortController;
      await withProcessing(async () => {
        const signal = abortController.signal;
        const activePages = LayoutService.getActivePages(
          processedPages,
          overrideExcludedPages || excludedPages,
        );
        if (activePages.length === 0) {
          alert('Please include at least one page to generate layout.');
          return;
        }
        const { finalPdfBlob, sheetPreviews, metrics } = await LayoutService.compilePrintLayout(
          activePages,
          config,
          (curr, total, action) => {
            if (signal.aborted) throw new Error('CANCELLED');
            actions.setProgress({
              stage: 'BUILDING_GRID',
              currentPage: curr,
              totalPages: total,
              percent: Math.round((curr / total) * 100),
              currentAction: action,
              elapsedMs: Date.now() - startTime,
            });
          },
          {
            keepOriginalPages: overrideKeepOriginal || keepOriginalPages,
            manualWhiteBoxRegions: overrideManualRegions || manualWhiteBoxRegions,
            mergedPdfBytes,
          },
        );
        if (signal.aborted) return;
        actions.setTiming({ layoutTimeMs: Math.round(Date.now() - startTime) });
        actions.setLayoutResult(finalPdfBlob, sheetPreviews, metrics);
      }, 'Failed to generate print layout PDF.', null);
      if (abortRef.current === abortController) abortRef.current = null;
    },
    [processedPages, excludedPages, keepOriginalPages, manualWhiteBoxRegions, mergedPdfBytes, actions, withProcessing, abortRef],
  );

  const handleSelectLayoutFormat = useCallback(
    (format: GridFormat) => {
      actions.setLayoutConfig(LayoutService.updateGridFormat(layoutConfig, format));
      actions.setLayoutDirty(true);
    },
    [layoutConfig, actions],
  );

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

  const handleUpdateOuterMargins = useCallback(
    (outerMargins: OuterMarginConfig) => {
      actions.setLayoutConfig(LayoutService.updateOuterMargins(layoutConfig, outerMargins));
      actions.setLayoutDirty(true);
    },
    [layoutConfig, actions],
  );

  const handleUpdateInnerMargin = useCallback(
    (innerMarginMm: number) => {
      actions.setLayoutConfig(LayoutService.updateInnerMargin(layoutConfig, innerMarginMm));
      actions.setLayoutDirty(true);
    },
    [layoutConfig, actions],
  );

  const handleApplyLayout = useCallback(async () => {
    if (!layoutDirty) return;
    await compilePhase3PrintLayout(layoutConfig);
    actions.setLayoutDirty(false);
  }, [layoutDirty, layoutConfig, compilePhase3PrintLayout, actions]);

  return {
    compilePhase3PrintLayout,
    handleSelectLayoutFormat,
    handleToggleOrientation,
    handleToggleBorders,
    handleTogglePageNumbers,
    handleUpdateOuterMargins,
    handleUpdateInnerMargin,
    handleApplyLayout,
  };
}
