'use client';

import { useCallback } from 'react';
import { LayoutService } from '../../services/LayoutService';
import type { LayoutConfig, ProcessedPage } from '../../optimizer/types';
import type { WorkflowActions } from '../useWorkflow';

interface ExclusionParams {
  excludedPages: Set<number>;
  currentPhase: number;
  processedPages: ProcessedPage[];
  layoutConfig: LayoutConfig;
  actions: WorkflowActions;
  compilePhase3PrintLayout: (config: LayoutConfig, overrideExcludedPages?: Set<number>) => Promise<void>;
  excludeLayoutTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  excludeLayoutArgsRef: React.MutableRefObject<{ config: LayoutConfig; excluded: Set<number> } | null>;
}

/**
 * Page exclusion with a 400ms debounce so rapid include/exclude
 * toggles collapse into a single phase-3 re-layout.
 */
export function useExclusion({
  excludedPages,
  currentPhase,
  processedPages,
  layoutConfig,
  actions,
  compilePhase3PrintLayout,
  excludeLayoutTimerRef,
  excludeLayoutArgsRef,
}: ExclusionParams) {
  const handleToggleExcludePage = useCallback(
    (pageIdx: number) => {
      const next = new Set(excludedPages);
      if (next.has(pageIdx)) next.delete(pageIdx);
      else next.add(pageIdx);
      actions.setExcludedPages(next);
      if (currentPhase === 3 && processedPages.length > 0) {
        const activePages = LayoutService.getActivePages(processedPages, next);
        if (activePages.length > 0) {
          /* Debounce rapid toggles into a single re-layout */
          excludeLayoutArgsRef.current = { config: layoutConfig, excluded: next };
          if (excludeLayoutTimerRef.current) clearTimeout(excludeLayoutTimerRef.current);
          excludeLayoutTimerRef.current = setTimeout(() => {
            excludeLayoutTimerRef.current = null;
            const args = excludeLayoutArgsRef.current;
            if (args) compilePhase3PrintLayout(args.config, args.excluded);
          }, 400);
        }
      }
    },
    [
      excludedPages,
      currentPhase,
      processedPages,
      layoutConfig,
      compilePhase3PrintLayout,
      actions,
      excludeLayoutTimerRef,
      excludeLayoutArgsRef,
    ],
  );

  return { handleToggleExcludePage };
}
