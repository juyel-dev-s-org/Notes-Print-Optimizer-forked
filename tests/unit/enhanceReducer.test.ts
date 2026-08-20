/**
 * Unit tests for the Enhance tool reducer (pure state machine) and
 * output file-naming helper.
 */

import { describe, expect, it } from 'vitest';
import { enhanceReducer, buildEnhanceFileName } from '@/lib/enhance/enhanceReducer';
import { INITIAL_ENHANCE_STATE } from '@/lib/enhance/types';
import type { EnhancePageResult, EnhanceSettings } from '@/lib/enhance/types';

const settings: EnhanceSettings = { darken: 45, contrast: 35, sharpen: 25, cleanBackground: true, grayscale: false };

const page = (index: number): EnhancePageResult => ({
  index,
  width: 100,
  height: 140,
  dataUrl: `data:image/jpeg;base64,enhanced${index}`,
  originalDataUrl: `data:image/jpeg;base64,original${index}`,
});

describe('buildEnhanceFileName', () => {
  it('single source keeps the base name', () => {
    expect(buildEnhanceFileName([{ name: 'physics notes.pdf' }])).toBe('physics notes-enhanced.pdf');
  });

  it('multiple sources use the generic name', () => {
    expect(buildEnhanceFileName([{ name: 'a.pdf' }, { name: 'b.pdf' }])).toBe('enhanced-print.pdf');
  });
});

describe('enhanceReducer', () => {
  it('RESET returns the initial state', () => {
    const mid = enhanceReducer(INITIAL_ENHANCE_STATE, {
      type: 'SET_FILES',
      files: [],
      step: 'enhance',
    });
    const reset = enhanceReducer(mid, { type: 'RESET' });
    expect(reset).toEqual(INITIAL_ENHANCE_STATE);
  });

  it('SET_FILES moves to the enhance step and clears stale results', () => {
    const s = enhanceReducer({ ...INITIAL_ENHANCE_STATE, results: [page(0)], pdfBlob: new Blob() }, {
      type: 'SET_FILES',
      files: [],
      step: 'enhance',
    });
    expect(s.step).toBe('enhance');
    expect(s.results).toEqual([]);
    expect(s.pdfBlob).toBeNull();
  });

  it('SET_STEP navigates without touching results', () => {
    const withResults = enhanceReducer({ ...INITIAL_ENHANCE_STATE, results: [page(0)] }, {
      type: 'SET_STEP', step: 'enhance',
    });
    const back = enhanceReducer(withResults, { type: 'SET_STEP', step: 'upload' });
    expect(back.step).toBe('upload');
    expect(back.results).toHaveLength(1);
  });

  it('SET_SETTINGS updates settings and invalidates the export', () => {
    const s = enhanceReducer({ ...INITIAL_ENHANCE_STATE, pdfBlob: new Blob() }, {
      type: 'SET_SETTINGS', settings: { ...settings, darken: 80 },
    });
    expect(s.settings.darken).toBe(80);
    expect(s.pdfBlob).toBeNull();
  });

  it('processing lifecycle ends in the enhance step with results', () => {
    let s = enhanceReducer(INITIAL_ENHANCE_STATE, { type: 'PROCESS_START' });
    expect(s.isProcessing).toBe(true);
    expect(s.progress?.total).toBe(1);
    s = enhanceReducer(s, { type: 'PROCESS_PROGRESS', progress: { current: 2, total: 3, phase: 'x.pdf · page 2/3' } });
    expect(s.progress?.current).toBe(2);
    s = enhanceReducer(s, { type: 'PROCESS_COMPLETE', results: [page(0), page(1)], fileName: 'notes-enhanced.pdf' });
    expect(s.isProcessing).toBe(false);
    expect(s.progress).toBeNull();
    expect(s.results).toHaveLength(2);
    expect(s.step).toBe('enhance');
    expect(s.selectedIndex).toBe(0);
    expect(s.fileName).toBe('notes-enhanced.pdf');
  });

  it('PROCESS_ERROR clears busy flags and keeps files', () => {
    let s = enhanceReducer(INITIAL_ENHANCE_STATE, { type: 'PROCESS_START' });
    s = enhanceReducer(s, { type: 'PROCESS_ERROR', error: 'Failed to read page.' });
    expect(s.isProcessing).toBe(false);
    expect(s.error).toBe('Failed to read page.');
    expect(s.files).toEqual([]);
  });

  it('export lifecycle sets the blob and moves to export step', () => {
    let s = enhanceReducer({ ...INITIAL_ENHANCE_STATE, results: [page(0)] }, { type: 'EXPORT_START' });
    expect(s.exportBusy).toBe(true);
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    s = enhanceReducer(s, { type: 'EXPORT_COMPLETE', blob, fileName: 'notes-enhanced.pdf' });
    expect(s.exportBusy).toBe(false);
    expect(s.pdfBlob).toBe(blob);
    expect(s.step).toBe('export');
  });

  it('EXPORT_ERROR keeps results so retry is possible', () => {
    let s = enhanceReducer({ ...INITIAL_ENHANCE_STATE, results: [page(0)] }, { type: 'EXPORT_START' });
    s = enhanceReducer(s, { type: 'EXPORT_ERROR', error: 'Build failed.' });
    expect(s.exportBusy).toBe(false);
    expect(s.results).toHaveLength(1);
    expect(s.error).toBe('Build failed.');
  });
});