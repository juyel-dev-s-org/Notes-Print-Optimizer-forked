'use client';

import { useCallback } from 'react';
import { LayoutService } from '../../services/LayoutService';
import type { LayoutConfig, ProcessedPage } from '../../optimizer/types';
import type { WorkflowActions } from '../useWorkflow';

interface ExclusionParams {
  excludedPages: Set<number>;
  keepOriginalPages: Set<number>;
  manualWhiteBoxRegions: Record<number, import('../../kernels/whiteBox').WhiteBoxRegion[]>;
  currentPhase: number;
  processedPages: ProcessedPage[];
  layoutConfig: LayoutConfig;
  actions: WorkflowActions;
  compilePhase3PrintLayout: (
    config: LayoutConfig,
    overrideExcludedPages?: Set<number>,
    overrideKeepOriginal?: Set<number>,
    overrideManualRegions?: Record<number, import('../../kernels/whiteBox').WhiteBoxRegion[]>,
  ) => Promise<void>;
  excludeLayoutTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  excludeLayoutArgsRef: React.MutableRefObject<{
    config: LayoutConfig;
    excluded: Set<number>;
    keepOriginal: Set<number>;
    manualRegions: Record<number, import('../../kernels/whiteBox').WhiteBoxRegion[]>;
  } | null>;
}

/**
 * Page include/exclude + keep-original toggles, debounced 400ms so rapid
 * flips collapse into a single phase-3 re-layout. Both toggle kinds share
 * one debounce slot — the latest combined state always wins.
 */
export function useExclusion({
  excludedPages,
  keepOriginalPages,
  manualWhiteBoxRegions,
  currentPhase,
  processedPages,
  layoutConfig,
  actions,
  compilePhase3PrintLayout,
  excludeLayoutTimerRef,
  excludeLayoutArgsRef,
}: ExclusionParams) {
  const scheduleRelayout = useCallback(
    (nextExcluded: Set<number>, nextKeepOriginal: Set<number>) => {
      if (!(currentPhase === 3 && processedPages.length > 0)) return;
      const activePages = LayoutService.getActivePages(processedPages, nextExcluded);
      if (activePages.length === 0) return;
      excludeLayoutArgsRef.current = {
        config: layoutConfig,
        excluded: nextExcluded,
        keepOriginal: nextKeepOriginal,
        manualRegions: manualWhiteBoxRegions,
      };
      if (excludeLayoutTimerRef.current) clearTimeout(excludeLayoutTimerRef.current);
      excludeLayoutTimerRef.current = setTimeout(() => {
        excludeLayoutTimerRef.current = null;
        const args = excludeLayoutArgsRef.current;
        if (args) compilePhase3PrintLayout(args.config, args.excluded, args.keepOriginal, args.manualRegions);
      }, 400);
    },
    [currentPhase, processedPages, manualWhiteBoxRegions, layoutConfig, compilePhase3PrintLayout, excludeLayoutTimerRef, excludeLayoutArgsRef],
  );

  const handleToggleExcludePage = useCallback(
    (pageIdx: number) => {
      const next = new Set(excludedPages);
      if (next.has(pageIdx)) next.delete(pageIdx);
      else next.add(pageIdx);
      actions.setExcludedPages(next);
      scheduleRelayout(next, keepOriginalPages);
    },
    [excludedPages, keepOriginalPages, actions, scheduleRelayout],
  );

  const handleToggleKeepOriginalPage = useCallback(
    (pageIdx: number) => {
      const next = new Set(keepOriginalPages);
      if (next.has(pageIdx)) next.delete(pageIdx);
      else next.add(pageIdx);
      actions.setKeepOriginalPages(next);
      scheduleRelayout(excludedPages, next);
    },
    [keepOriginalPages, excludedPages, actions, scheduleRelayout],
  );

  return { handleToggleExcludePage, handleToggleKeepOriginalPage };
}
