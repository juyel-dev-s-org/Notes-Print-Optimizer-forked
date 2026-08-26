import { describe, it, expect } from 'vitest';
import { workflowReducer, initialState } from '../../../lib/workflow/workflowReducer';
import type { ProcessedPage } from '../../../lib/optimizer/types';

function page(pageIndex: number, classification: ProcessedPage['profile']['classification']): ProcessedPage {
  return {
    pageIndex,
    thumbnailDataUrl: '',
    profile: {
      pageIndex, width: 100, height: 140, averageBrightness: 128, contrast: 30,
      inkDensity: 0.2, darkBackgroundRatio: 0.1, lightBackgroundRatio: 0.8,
      dominantHue: 0, hasTopBanner: false, topBannerHeightPct: 0,
      hasBottomBanner: false, bottomBannerHeightPct: 0, estimatedNoise: 10,
      strokeThickness: 1.8, classification,
    },
    parameters: {} as ProcessedPage['parameters'],
    inkCoverageBeforePct: 40,
    inkCoverageAfterPct: 5,
  };
}

describe('keepOriginalPages (white-page guard)', () => {
  it('auto-seeds LIGHT_SLIDE pages on SET_PROCESSED_PAGES and nothing else', () => {
    let s = initialState;
    s = workflowReducer(s, { type: 'SET_PROCESSED_PAGES', pages: [
      page(0, 'DARK_SLIDE'),
      page(1, 'LIGHT_SLIDE'),
      page(2, 'MIXED'),
      page(3, 'LIGHT_SLIDE'),
    ] });
    expect([...s.keepOriginalPages].sort()).toEqual([1, 3]);
  });

  it('TOGGLE_KEEP_ORIGINAL_PAGE adds and removes', () => {
    let s = initialState;
    s = workflowReducer(s, { type: 'SET_PROCESSED_PAGES', pages: [page(0, 'DARK_SLIDE')] });
    s = workflowReducer(s, { type: 'TOGGLE_KEEP_ORIGINAL_PAGE', pageIndex: 0 });
    expect(s.keepOriginalPages.has(0)).toBe(true);
    s = workflowReducer(s, { type: 'TOGGLE_KEEP_ORIGINAL_PAGE', pageIndex: 0 });
    expect(s.keepOriginalPages.has(0)).toBe(false);
  });

  it('SET_KEEP_ORIGINAL_PAGES replaces the whole set', () => {
    let s = initialState;
    s = workflowReducer(s, { type: 'SET_KEEP_ORIGINAL_PAGES', pages: new Set([2, 5]) });
    expect([...s.keepOriginalPages].sort()).toEqual([2, 5]);
  });

  it('RESET_WORKFLOW clears the set', () => {
    let s = initialState;
    s = workflowReducer(s, { type: 'SET_KEEP_ORIGINAL_PAGES', pages: new Set([1]) });
    s = workflowReducer(s, { type: 'RESET_WORKFLOW' });
    expect(s.keepOriginalPages.size).toBe(0);
  });
});
