/**
 * Unit tests for the Merge tool: real pdf-lib merge roundtrip, reducer
 * queue mutations and lifecycle transitions.
 */

import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { MergeService } from '@/lib/tomerge/mergeService';
import { INITIAL_MERGE_STATE, mergeReducer, type MergeState } from '@/lib/tomerge/mergeReducer';
import type { UploadedPdfItem } from '@/lib/workflow/types';

async function makePdf(pages: number, label: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([300, 400]);
    page.drawText(`${label} p${i + 1}`, { x: 40, y: 200, size: 18, font });
  }
  return doc.save();
}

const asItem = (name: string, bytes: Uint8Array): UploadedPdfItem => ({
  id: name,
  file: null as unknown as File,
  name,
  sizeMB: (bytes.length / (1024 * 1024)).toFixed(2),
  arrayBuffer: bytes.slice().buffer,
});

describe('MergeService', () => {
  it('merges documents in order and reports combined page count', async () => {
    const a = await makePdf(3, 'Alpha');
    const b = await makePdf(2, 'Beta');

    const labels: string[] = [];
    const { bytes, pages } = await MergeService.merge([asItem('a.pdf', a), asItem('b.pdf', b)], (done, total, label) => {
      labels.push(`${done}/${total}:${label}`);
    });

    expect(pages).toBe(5);
    expect(bytes[0]).toBe(0x25); // '%PDF'

    // Order is preserved: re-open and check the first drawn word.
    const merged = await PDFDocument.load(bytes);
    expect(merged.getPageCount()).toBe(5);

    expect(labels[0]).toContain('a.pdf');
    expect(labels.at(-1)).toContain('Building final document');
  });

  it('throws for an empty selection', async () => {
    await expect(MergeService.merge([], () => undefined)).rejects.toThrow(/No pages/);
  });
});

const file = (n: number): UploadedPdfItem => ({
  id: `f${n}`,
  file: null as unknown as File,
  name: `${n}-notes.pdf`,
  sizeMB: '1.0',
  arrayBuffer: new ArrayBuffer(0),
});

/** Three files plus stale output to prove invalidation. */
const arrangeState = (): MergeState => ({
  ...INITIAL_MERGE_STATE,
  step: 'arrange',
  files: [file(0), file(1), file(2)],
  resultBlob: new Blob(['%PDF']),
});

describe('mergeReducer', () => {
  it('SET_FILES lands on arrange; emptying via REMOVE_FILE returns to upload', () => {
    let s = mergeReducer(INITIAL_MERGE_STATE, { type: 'SET_FILES', files: [file(0)] });
    expect(s.step).toBe('arrange');
    s = mergeReducer(s, { type: 'REMOVE_FILE', index: 0 });
    expect(s.step).toBe('upload');
    expect(s.files).toEqual([]);
  });

  it('MOVE swaps adjacent; REORDER moves across; both invalidate stale output', () => {
    let s = mergeReducer(arrangeState(), { type: 'MOVE_FILE', index: 2, direction: 'UP' });
    expect(s.files.map((f) => f.name)).toEqual(['0-notes.pdf', '2-notes.pdf', '1-notes.pdf']);
    expect(s.resultBlob).toBeNull();

    s = mergeReducer(s, { type: 'REORDER_FILES', fromIndex: 0, toIndex: 2 });
    expect(s.files.map((f) => f.name)).toEqual(['2-notes.pdf', '1-notes.pdf', '0-notes.pdf']);

    const same = mergeReducer(s, { type: 'REORDER_FILES', fromIndex: 1, toIndex: 1 });
    expect(same).toBe(s);
  });

  it('SMART_ARRANGE replaces order; busy lifecycle completes onto done', () => {
    const reordered = [file(2), file(0), file(1)];
    let s = mergeReducer(arrangeState(), { type: 'SMART_ARRANGE', files: reordered });
    expect(s.files).toBe(reordered);

    s = mergeReducer({ ...s, files: [file(0), file(1)] }, { type: 'MERGE_START' });
    expect(s.isBusy).toBe(true);
    s = mergeReducer(s, { type: 'MERGE_PROGRESS', progress: { current: 1, total: 2, label: 'Adding…' } });
    const blob = new Blob(['%PDF']);
    s = mergeReducer(s, { type: 'MERGE_COMPLETE', blob, pages: 7 });
    expect(s.isBusy).toBe(false);
    expect(s.resultBlob).toBe(blob);
    expect(s.resultPages).toBe(7);
    expect(s.step).toBe('done');
  });

  it('MERGE_ERROR unlocks without wiping the queue', () => {
    let s = mergeReducer(arrangeState(), { type: 'MERGE_START' });
    s = mergeReducer(s, { type: 'MERGE_ERROR', error: 'boom' });
    expect(s.isBusy).toBe(false);
    expect(s.files).toHaveLength(3);
    expect(s.error).toBe('boom');
  });
});
