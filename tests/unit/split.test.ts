/**
 * Unit tests for the Split tool: chunk planner, real pdf-lib
 * extraction/bursting roundtrips (order verified via per-page geometry)
 * and reducer transitions.
 */

import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { planChunks } from '@/lib/shared/chunks';
import { resolveRange } from '@/lib/shared/range';
import { SplitService } from '@/lib/tosplit/splitService';
import {
  INITIAL_SPLIT_STATE,
  buildPartName,
  splitReducer,
  type SplitState,
} from '@/lib/tosplit/splitReducer';

/** Each page gets a unique height so extracted order is assertable. */
async function makeDoc(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([300, 400 + i]);
    page.drawText(`page-${i + 1}`, { x: 20, y: 40, size: 12, font });
  }
  return doc.save();
}

describe('planChunks', () => {
  it('splits evenly and keeps a smaller tail', () => {
    expect(planChunks(23, 5)).toEqual([
      { start: 1, end: 5 },
      { start: 6, end: 10 },
      { start: 11, end: 15 },
      { start: 16, end: 20 },
      { start: 21, end: 23 },
    ]);
  });

  it('whole document fits when perFile >= pageCount', () => {
    expect(planChunks(10, 20)).toEqual([{ start: 1, end: 10 }]);
  });

  it('returns nothing for invalid inputs', () => {
    expect(planChunks(0, 5)).toEqual([]);
    expect(planChunks(10, 0)).toEqual([]);
    expect(planChunks(-3, 2)).toEqual([]);
  });
});

describe('SplitService', () => {
  it('extract keeps the original page order (geometry proves it)', async () => {
    const bytes = await makeDoc(5);
    const out = await SplitService.extract(bytes.slice(0), { start: 2, end: 4 });
    expect(out.pages).toBe(3);
    expect(out.bytes[0]).toBe(0x25); // '%'

    const reopened = await PDFDocument.load(out.bytes);
    const heights = reopened.getPages().map((p) => p.getHeight());
    expect(heights).toEqual([401, 402, 403]); // original pages 2..4
  });

  it('burst produces consecutive parts whose sizes sum to the total', async () => {
    const bytes = await makeDoc(7);
    const parts = await SplitService.splitEvery(bytes.slice(0), planChunks(7, 3));
    expect(parts.map((p) => p.pages)).toEqual([3, 3, 1]);

    let seen = 0;
    for (const part of parts) {
      const doc = await PDFDocument.load(part.bytes);
      for (let i = 0; i < doc.getPageCount(); i++) {
        seen += 1;
        expect(doc.getPage(i).getHeight()).toBe(400 + part.index * 3 + i);
      }
    }
    expect(seen).toBe(7);
  });
});

describe('resolveRange (shared)', () => {
  it('validates custom windows', () => {
    expect(resolveRange('custom', '3', '4', 10)).toEqual({ start: 3, end: 4 });
    expect(resolveRange('custom', '4', '3', 10)).toBeNull();
  });
});

const source = (): SplitState => ({
  ...INITIAL_SPLIT_STATE,
  step: 'options',
  pageCount: 9,
  source: { name: 'doc.pdf', baseName: 'doc', sizeMB: '2.0', bytes: new Uint8Array([1]) },
});

describe('splitReducer', () => {
  it('digit guards keep inputs numeric', () => {
    let s = splitReducer(source(), { type: 'SET_RANGE_FROM', value: 'x1y2' });
    expect(s.rangeFrom).toBe('12');
    s = splitReducer(s, { type: 'SET_PER_FILE', value: '99999' });
    expect(s.perFile).toBe('9999');
  });

  it('extract lifecycle completes onto done as single output', () => {
    let s = splitReducer(source(), { type: 'RUN_START', progress: { pct: 30, label: 'cutting' } });
    expect(s.isBusy).toBe(true);
    const blob = new Blob(['%PDF']);
    s = splitReducer(s, { type: 'RUN_COMPLETE', kind: 'single', outputs: [{ name: '', blob, pages: 3 }] });
    expect(s.isBusy).toBe(false);
    expect(s.kind).toBe('single');
    expect(s.step).toBe('done');
    expect(s.outputs[0].name).toBe('');
  });

  it('multi burst names parts in sequence', () => {
    const outputs = [0, 1, 2].map((i) => ({ name: buildPartName('notes', i), blob: new Blob(), pages: 3 }));
    const s = splitReducer(source(), { type: 'RUN_COMPLETE', kind: 'multi', outputs });
    expect(s.outputs.map((o) => o.name)).toEqual(['notes-part01.pdf', 'notes-part02.pdf', 'notes-part03.pdf']);
  });

  it('RUN_ERROR clears busy but keeps options context', () => {
    let s = splitReducer(source(), { type: 'RUN_START', progress: { pct: 10, label: 'x' } });
    s = splitReducer(s, { type: 'RUN_ERROR', error: 'boom' });
    expect(s.isBusy).toBe(false);
    expect(s.error).toBe('boom');
    expect(s.step).toBe('options');
  });
});
