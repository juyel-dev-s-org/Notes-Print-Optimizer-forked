import { describe, it, expect, beforeEach } from 'vitest';
import {
  workflowReducer,
  initialState,
  initialLayoutConfig,
} from '../../../lib/workflow/workflowReducer';
import type { WorkflowState } from '../../../lib/workflow/types';

describe('workflowReducer', () => {
  let state: WorkflowState;

  beforeEach(() => {
    state = JSON.parse(JSON.stringify(initialState, (_key, value) =>
      value instanceof Set ? [...value] : value
    )) as WorkflowState;
    state.excludedPages = new Set<number>();
    state.masterParams = {
      ...initialState.masterParams,
      preset: 'AUTO_ADAPTIVE',
      backgroundWhiteningThreshold: 220,
      contrastEnhancement: 25,
      sharpenAmount: 35,
      denoiseAmount: 15,
      outputQuality: 0.88,
      invertMode: 'smart',
      smartColorMapping: true,
      bannerCropTopPct: 0,
      bannerCropBottomPct: 0,
      autoTrimMargins: false,
      binaizationThreshold: 0,
      strokeEnhancement: 'strong',
    };
  });

  it('should start in phase 1 (UPLOAD)', () => {
    expect(state.currentPhase).toBe(1);
  });

  describe('phase transitions', () => {
    it('should transition to phase 2 via SET_PHASE', () => {
      const next = workflowReducer(state, { type: 'SET_PHASE', phase: 2 });
      expect(next.currentPhase).toBe(2);
    });

    it('should transition to phase 3 via SET_PHASE', () => {
      const next = workflowReducer(state, { type: 'SET_PHASE', phase: 3 });
      expect(next.currentPhase).toBe(3);
    });

    it('should transition to phase 4 via SET_PHASE', () => {
      const next = workflowReducer(state, { type: 'SET_PHASE', phase: 4 });
      expect(next.currentPhase).toBe(4);
    });

    it('should go back to phase 1 via SET_PHASE', () => {
      const s2 = workflowReducer(state, { type: 'SET_PHASE', phase: 2 });
      const s1 = workflowReducer(s2, { type: 'SET_PHASE', phase: 1 });
      expect(s1.currentPhase).toBe(1);
    });
  });

  describe('processing state', () => {
    it('should set isProcessing to true', () => {
      const next = workflowReducer(state, {
        type: 'SET_PROCESSING',
        isProcessing: true,
      });
      expect(next.isProcessing).toBe(true);
    });

    it('should set isProcessing to false', () => {
      const processing = workflowReducer(state, {
        type: 'SET_PROCESSING',
        isProcessing: true,
      });
      const next = workflowReducer(processing, {
        type: 'SET_PROCESSING',
        isProcessing: false,
      });
      expect(next.isProcessing).toBe(false);
    });

    it('should set progress', () => {
      const progress = {
        stage: 'OPTIMIZING' as const,
        currentPage: 1,
        totalPages: 10,
        percent: 10,
        currentAction: 'Processing page 1 of 10',
        elapsedMs: 100,
      };
      const next = workflowReducer(state, { type: 'SET_PROGRESS', progress });
      expect(next.progress).toEqual(progress);
    });

    it('should clear progress to null', () => {
      const withProgress = workflowReducer(state, {
        type: 'SET_PROGRESS',
        progress: {
          stage: 'OPTIMIZING',
          currentPage: 1,
          totalPages: 10,
          percent: 10,
          currentAction: 'test',
          elapsedMs: 0,
        },
      });
      const next = workflowReducer(withProgress, {
        type: 'SET_PROGRESS',
        progress: null,
      });
      expect(next.progress).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should set error message', () => {
      const next = workflowReducer(state, {
        type: 'SET_ERROR',
        message: 'Something went wrong',
      });
      expect(next.errorMessage).toBe('Something went wrong');
    });

    it('should clear error message', () => {
      const withError = workflowReducer(state, {
        type: 'SET_ERROR',
        message: 'Error',
      });
      const next = workflowReducer(withError, {
        type: 'SET_ERROR',
        message: null,
      });
      expect(next.errorMessage).toBeNull();
    });
  });

  describe('upload and merge', () => {
    it('should set uploaded items', () => {
      const items = [
        {
          id: 'file-1',
          file: new File([''], 'test.pdf'),
          name: 'test.pdf',
          sizeMB: '0.01',
          arrayBuffer: new ArrayBuffer(0),
        },
      ];
      const next = workflowReducer(state, {
        type: 'SET_UPLOADED_ITEMS',
        items,
      });
      expect(next.uploadedItems).toHaveLength(1);
      expect(next.uploadedItems[0].name).toBe('test.pdf');
    });

    it('should set merge result', () => {
      const blob = new Blob(['pdf data'], { type: 'application/pdf' });
      const bytes = new Uint8Array([1, 2, 3]);
      const urls = ['data:image/jpeg;base64,abc'];
      const next = workflowReducer(state, {
        type: 'SET_MERGE_RESULT',
        blob,
        bytes,
        pageDataUrls: urls,
      });
      expect(next.mergedPdfBlob).toBe(blob);
      expect(next.mergedPdfBytes).toBe(bytes);
      expect(next.mergedPageDataUrls).toEqual(urls);
    });
  });

  describe('page exclusion toggling', () => {
    it('should toggle a page as excluded', () => {
      const next = workflowReducer(state, {
        type: 'TOGGLE_PAGE_EXCLUDED',
        pageIndex: 0,
      });
      expect(next.excludedPages.has(0)).toBe(true);
    });

    it('should toggle a page back to included', () => {
      const excluded = workflowReducer(state, {
        type: 'TOGGLE_PAGE_EXCLUDED',
        pageIndex: 0,
      });
      const included = workflowReducer(excluded, {
        type: 'TOGGLE_PAGE_EXCLUDED',
        pageIndex: 0,
      });
      expect(included.excludedPages.has(0)).toBe(false);
    });

    it('should set excluded pages via SET_EXCLUDED_PAGES', () => {
      const next = workflowReducer(state, {
        type: 'SET_EXCLUDED_PAGES',
        pages: new Set([1, 2, 3]),
      });
      expect(next.excludedPages.has(1)).toBe(true);
      expect(next.excludedPages.has(2)).toBe(true);
      expect(next.excludedPages.has(3)).toBe(true);
      expect(next.excludedPages.size).toBe(3);
    });
  });

  describe('layout config updates', () => {
    it('should update layout config partially', () => {
      const next = workflowReducer(state, {
        type: 'UPDATE_LAYOUT_CONFIG',
        patch: { gridFormat: '1x2' },
      });
      expect(next.layoutConfig.gridFormat).toBe('1x2');
      expect(next.layoutConfig.paperSize).toBe('A4');
    });

    it('should set layout config fully', () => {
      const config = {
        ...initialLayoutConfig,
        gridFormat: '2x4' as const,
        paperSize: 'LETTER' as const,
      };
      const next = workflowReducer(state, {
        type: 'SET_LAYOUT_CONFIG',
        config,
      });
      expect(next.layoutConfig.gridFormat).toBe('2x4');
      expect(next.layoutConfig.paperSize).toBe('LETTER');
    });

    it('should set layout dirty flag', () => {
      const next = workflowReducer(state, {
        type: 'SET_LAYOUT_DIRTY',
        dirty: true,
      });
      expect(next.layoutDirty).toBe(true);
    });
  });

  describe('layout result', () => {
    it('should set layout result with blob, previews, and metrics', () => {
      const blob = new Blob(['pdf']);
      const previews = ['preview1', 'preview2'];
      const metrics = {
        totalOriginalSizeMB: 1,
        totalOptimizedSizeMB: 0.5,
        originalInkCoveragePct: 30,
        optimizedInkCoveragePct: 15,
        inkSavedPct: 50,
        processingTimeMs: 1000,
        pagesPerSecond: 10,
        throughputMPixelsPerSec: 5,
      };
      const next = workflowReducer(state, {
        type: 'SET_LAYOUT_RESULT',
        blob,
        previews,
        metrics,
      });
      expect(next.finalPrintPdfBlob).toBe(blob);
      expect(next.finalSheetPreviews).toEqual(previews);
      expect(next.finalMetrics).toEqual(metrics);
    });
  });

  describe('engine and params (user preferences)', () => {
    it('should set master params', () => {
      const params = { ...state.masterParams, preset: 'PW_DARK_SLIDE' as const };
      const next = workflowReducer(state, {
        type: 'SET_MASTER_PARAMS',
        params,
      });
      expect(next.masterParams.preset).toBe('PW_DARK_SLIDE');
    });
  });

  describe('feedback state', () => {
    it('should set rating', () => {
      const next = workflowReducer(state, { type: 'SET_RATING', rating: 4 });
      expect(next.rating).toBe(4);
    });

    it('should set feedback text', () => {
      const next = workflowReducer(state, {
        type: 'SET_FEEDBACK_TEXT',
        text: 'Great app!',
      });
      expect(next.feedbackText).toBe('Great app!');
    });

    it('should set feedback submitted', () => {
      const next = workflowReducer(state, {
        type: 'SET_FEEDBACK_SUBMITTED',
        submitted: true,
      });
      expect(next.feedbackSubmitted).toBe(true);
    });
  });

  describe('timing diagnostics', () => {
    it('should set timing values', () => {
      const next = workflowReducer(state, {
        type: 'SET_TIMING',
        analysisTimeMs: 100,
        optimizationTimeMs: 500,
        layoutTimeMs: 200,
      });
      expect(next.analysisTimeMs).toBe(100);
      expect(next.optimizationTimeMs).toBe(500);
      expect(next.layoutTimeMs).toBe(200);
    });

    it('should set partial timing values', () => {
      const next = workflowReducer(state, {
        type: 'SET_TIMING',
        optimizationTimeMs: 300,
      });
      expect(next.analysisTimeMs).toBeUndefined();
      expect(next.optimizationTimeMs).toBe(300);
    });
  });

  describe('RESET_WORKFLOW', () => {
    it('should reset all transient state to initial values', () => {
      const populated = workflowReducer(state, {
        type: 'SET_PHASE',
        phase: 2,
      });
      const items = [
        {
          id: 'f1',
          file: new File([''], 't.pdf'),
          name: 't.pdf',
          sizeMB: '0.01',
          arrayBuffer: new ArrayBuffer(0),
        },
      ];
      const withItems = workflowReducer(populated, {
        type: 'SET_UPLOADED_ITEMS',
        items,
      });
      const withMerge = workflowReducer(withItems, {
        type: 'SET_MERGE_RESULT',
        blob: new Blob(['']),
        bytes: new Uint8Array([1]),
        pageDataUrls: ['url1'],
      });
      const withPages = workflowReducer(withMerge, {
        type: 'SET_PROCESSED_PAGES',
        pages: [
          {
            pageIndex: 0,
            thumbnailDataUrl: 'thumb1',
            profile: {} as any,
            parameters: state.masterParams,
            inkCoverageBeforePct: 10,
            inkCoverageAfterPct: 5,
          },
        ],
      });

      const reset = workflowReducer(withPages, { type: 'RESET_WORKFLOW' });

      expect(reset.currentPhase).toBe(1);
      expect(reset.uploadedItems).toEqual([]);
      expect(reset.mergedPdfBlob).toBeNull();
      expect(reset.mergedPdfBytes).toBeNull();
      expect(reset.mergedPageDataUrls).toEqual([]);
      expect(reset.pageProfiles).toEqual([]);
      expect(reset.docProfile).toBeNull();
      expect(reset.processedPages).toEqual([]);
      expect(reset.optimized1UpBlob).toBeNull();
      expect(reset.selectedPageIndex).toBe(0);
      expect(reset.excludedPages.size).toBe(0);
      expect(reset.finalPrintPdfBlob).toBeNull();
      expect(reset.finalSheetPreviews).toEqual([]);
      expect(reset.finalMetrics).toBeNull();
      expect(reset.layoutDirty).toBe(false);
      expect(reset.analysisTimeMs).toBeUndefined();
      expect(reset.optimizationTimeMs).toBeUndefined();
      expect(reset.layoutTimeMs).toBeUndefined();
      expect(reset.feedbackSubmitted).toBe(false);
      expect(reset.feedbackText).toBe('');
      expect(reset.isProcessing).toBe(false);
      expect(reset.progress).toBeNull();
      expect(reset.errorMessage).toBeNull();
    });

    it('should preserve masterParams on reset', () => {
      const darkParams = {
        ...state.masterParams,
        preset: 'PW_DARK_SLIDE' as const,
      };
      const setParams = workflowReducer(state, {
        type: 'SET_MASTER_PARAMS',
        params: darkParams,
      });
      const reset = workflowReducer(setParams, { type: 'RESET_WORKFLOW' });
      expect(reset.masterParams.preset).toBe('PW_DARK_SLIDE');
    });

    it('should reset layoutConfig to defaults', () => {
      const changed = workflowReducer(state, {
        type: 'UPDATE_LAYOUT_CONFIG',
        patch: { gridFormat: '2x4', paperSize: 'LETTER' },
      });
      const reset = workflowReducer(changed, { type: 'RESET_WORKFLOW' });
      expect(reset.layoutConfig.gridFormat).toBe('2x2');
      expect(reset.layoutConfig.paperSize).toBe('A4');
      expect(reset.layoutConfig.orientation).toBe('PORTRAIT');
    });
  });
});
