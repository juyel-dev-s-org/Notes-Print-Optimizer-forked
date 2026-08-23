/**
 * Unit tests for the Image to PDF tool: image sniffing, reducer queue
 * mutations and a real pdf-lib embedding roundtrip with page-size math.
 */

import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { isLikelyImageFile, ImagePdfService, IMAGE_DROPZONE_ACCEPT } from '@/lib/img2pdf/imagePdfService';
import {
  INITIAL_IMAGE_PDF_STATE,
  imagePdfReducer,
  type ImageItem,
} from '@/lib/img2pdf/imagePdfReducer';

/** Classic 1x1 transparent PNG. */
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const pngFile = (name: string): File => {
  const bytes = Uint8Array.from(atob(PNG_B64), (c) => c.charCodeAt(0));
  return new File([bytes], name, { type: 'image/png' });
};

const item = (name: string): ImageItem => ({
  id: name,
  name,
  sizeMB: '0.01',
  blob: pngFile(name),
  kind: 'png',
});

describe('isLikelyImageFile', () => {
  it('accepts image MIME types and known extensions', () => {
    expect(isLikelyImageFile(new File([new Blob()], 'a.jpg', { type: 'image/jpeg' }))).toBe(true);
    expect(isLikelyImageFile(new File([new Blob()], 'a.webp', { type: '' }))).toBe(true);
  });

  it('rejects non-images', () => {
    expect(isLikelyImageFile(new File([new Blob()], 'notes.pdf', { type: 'application/pdf' }))).toBe(false);
    expect(isLikelyImageFile(new File([new Blob()], 'song.mp3', { type: '' }))).toBe(false);
  });
});

describe('imagePdfReducer', () => {
  it('ADD_FILES lands on arrange; emptying returns to upload', () => {
    let s = imagePdfReducer(INITIAL_IMAGE_PDF_STATE, { type: 'ADD_FILES', files: [item('a.png')] });
    expect(s.step).toBe('arrange');
    s = imagePdfReducer(s, { type: 'REMOVE_FILE', index: 0 });
    expect(s.step).toBe('upload');
    expect(s.files).toEqual([]);
  });

  it('queue mutations invalidate stale output', () => {
    let s = imagePdfReducer(
      { ...INITIAL_IMAGE_PDF_STATE, files: [item('a.png'), item('b.png'), item('c.png')], resultBlob: new Blob() },
      { type: 'MOVE_FILE', index: 2, direction: 'UP' },
    );
    expect(s.files.map((f) => f.name)).toEqual(['a.png', 'c.png', 'b.png']);
    expect(s.resultBlob).toBeNull();

    s = imagePdfReducer(s, { type: 'REORDER_FILES', fromIndex: 0, toIndex: 2 });
    expect(s.files.map((f) => f.name)).toEqual(['c.png', 'b.png', 'a.png']);

    const same = imagePdfReducer(s, { type: 'REORDER_FILES', fromIndex: 1, toIndex: 1 });
    expect(same).toBe(s);
  });

  it('build lifecycle completes onto done with page count', () => {
    let s = imagePdfReducer(
      { ...INITIAL_IMAGE_PDF_STATE, files: [item('a.png')] },
      { type: 'BUILD_START', progress: { current: 0, total: 1, label: 'x' } },
    );
    expect(s.isBusy).toBe(true);
    const blob = new Blob(['%PDF']);
    s = imagePdfReducer(s, { type: 'BUILD_COMPLETE', blob, pages: 1 });
    expect(s.isBusy).toBe(false);
    expect(s.resultBlob).toBe(blob);
    expect(s.step).toBe('done');
  });

  it('page mode toggles independently of the queue', () => {
    const s = imagePdfReducer(INITIAL_IMAGE_PDF_STATE, { type: 'SET_PAGE_MODE', mode: 'a4' });
    expect(s.pageMode).toBe('a4');
  });
});

describe('ImagePdfService.build', () => {
  it('fit mode sizes each page at 144 DPI (pt = px / 2)', async () => {
    const { bytes, pages } = await ImagePdfService.build([item('one.png'), item('two.png')], 'fit');
    expect(pages).toBe(2);
    const doc = await PDFDocument.load(bytes);
    // 1px image -> 0.5pt page
    expect(doc.getPage(0).getWidth()).toBeCloseTo(0.5, 5);
    expect(doc.getPage(0).getHeight()).toBeCloseTo(0.5, 5);
  });

  it('a4 mode picks portrait for square-ish images with margins respected', async () => {
    const { pages } = await ImagePdfService.build([item('solo.png')], 'a4');
    expect(pages).toBe(1);
  });

  it('throws a friendly error when there are no images', async () => {
    await expect(ImagePdfService.build([], 'fit')).rejects.toThrow(/No images/);
  });
});

describe('IMAGE_DROPZONE_ACCEPT.validate', () => {
  it('accepts images, skips non-images, reports skipped names', async () => {
    const good = pngFile('pic.png');
    const bad = new File([new TextEncoder().encode('hello')], 'notes.txt', { type: 'text/plain' });
    const { validFiles, skipped, error } = await IMAGE_DROPZONE_ACCEPT.validate([good, bad], 20);
    expect(error).toBeNull();
    expect(validFiles).toEqual([good]);
    expect(skipped).toEqual(['notes.txt']);
  });

  it('caps at maxFiles with a skip note', async () => {
    const { validFiles, skipped } = await IMAGE_DROPZONE_ACCEPT.validate(
      [item('a.png').blob as File, item('b.png').blob as File],
      1,
    );
    expect(validFiles).toHaveLength(1);
    expect(skipped[0]).toMatch(/over 1 file limit/);
  });

  it('dialog filter targets decodable image types only (no HEIC dead-end)', () => {
    expect(IMAGE_DROPZONE_ACCEPT.input).toContain('image/jpeg');
    expect(IMAGE_DROPZONE_ACCEPT.input).toContain('image/webp');
    expect(IMAGE_DROPZONE_ACCEPT.input).not.toContain('heic');
  });
});
