/**
 * Unit tests for the STORE-only ZIP writer and the images reducer.
 */

import { describe, expect, it } from 'vitest';
import { buildZip, crc32 } from '@/lib/toimages/zipWriter';
import {
  INITIAL_IMAGES_STATE,
  imagesReducer,
} from '@/lib/toimages/imagesReducer';
import { buildPageImageName, sanitizeBaseName } from '@/lib/shared/filename';

const enc = (s: string) => new TextEncoder().encode(s);
/** Minimal reader for our own archives (asserts structural correctness). */
function readEntries(zip: Uint8Array): Array<{ name: string; size: number; method: number }> {
  const view = new DataView(zip.buffer);
  // Find EOCD from the tail.
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  expect(eocd).toBeGreaterThanOrEqual(0);
  const count = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);

  const out: Array<{ name: string; size: number; method: number }> = [];
  let off = cdOffset;
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(off, true)).toBe(0x02014b50);
    const nameLen = view.getUint16(off + 28, true);
    const size = view.getUint32(off + 24, true);
    const localOff = view.getUint32(off + 42, true);
    const name = new TextDecoder().decode(zip.slice(localOff + 30, localOff + 30 + nameLen));
    out.push({ name, size, method: view.getUint16(off + 10, true) });
    off += 46 + nameLen;
  }
  return out;
}

describe('crc32', () => {
  it('matches the canonical "hello" vector', () => {
    expect(crc32(enc('hello'))).toBe(0x3610a686);
  });

  it('is zero for empty input', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe('buildZip', () => {
  it('produces a PK archive with correct entries, names and sizes', () => {
    const zip = buildZip([
      { name: 'doc-p01.jpg', data: enc('image-one') },
      { name: 'doc-p02.jpg', data: enc('image-two-bytes') },
    ]);
    expect(zip[0]).toBe(0x50); // 'P'
    expect(zip[1]).toBe(0x4b); // 'K'

    const entries = readEntries(zip);
    expect(entries).toEqual([
      { name: 'doc-p01.jpg', size: 9, method: 0 },
      { name: 'doc-p02.jpg', size: 15, method: 0 },
    ]);
  });

  it('stores payload bytes verbatim (STORE, no compression)', () => {
    const payload = enc('verbatim-bytes');
    const zip = buildZip([{ name: 'a.bin', data: payload }]);
    const view = new DataView(zip.buffer);
    // Local header: data begins at 30 + nameLen.
    const nameLen = view.getUint16(26, true);
    const stored = zip.slice(30 + nameLen, 30 + nameLen + payload.length);
    expect(Array.from(stored)).toEqual(Array.from(payload));
  });

  it('handles many entries and preserves order', () => {
    const entries = Array.from({ length: 40 }, (_, i) => ({
      name: `notes-p${String(i + 1).padStart(2, '0')}.jpg`,
      data: enc(`page-${i}`),
    }));
    const names = readEntries(buildZip(entries)).map((e) => e.name);
    expect(names[0]).toBe('notes-p01.jpg');
    expect(names[39]).toBe('notes-p40.jpg');
  });
});

describe('imagesReducer & naming', () => {
  it('SET_FILE lands on options and clears results', () => {
    const s = imagesReducer(INITIAL_IMAGES_STATE, {
      type: 'SET_FILE',
      source: { name: 'a.pdf', baseName: 'a', sizeMB: '2', bytes: new Uint8Array() },
    });
    expect(s.step).toBe('options');
    expect(s.results).toEqual([]);
  });

  it('conversion lifecycle accumulates pages onto done', () => {
    let s = imagesReducer(
      { ...INITIAL_IMAGES_STATE, source: { name: 'a.pdf', baseName: 'a', sizeMB: '2', bytes: new Uint8Array() } },
      { type: 'CONVERT_START', total: 3 },
    );
    expect(s.isBusy).toBe(true);
    s = imagesReducer(s, { type: 'CONVERT_PROGRESS', current: 2 });
    expect(s.progress?.current).toBe(2);
    const results = [
      { name: 'a-p01.jpg', blob: new Blob(), thumbDataUrl: '' },
      { name: 'a-p02.jpg', blob: new Blob(), thumbDataUrl: '' },
    ];
    s = imagesReducer(s, { type: 'CONVERT_COMPLETE', results });
    expect(s.isBusy).toBe(false);
    expect(s.results).toHaveLength(2);
    expect(s.step).toBe('done');
  });

  it('format/dpi/quality setters update options independently', () => {
    let s = imagesReducer(INITIAL_IMAGES_STATE, { type: 'SET_FORMAT', format: 'image/png' });
    s = imagesReducer(s, { type: 'SET_DPI', dpi: 'high' });
    s = imagesReducer(s, { type: 'SET_QUALITY', quality: 0.8 });
    expect(s.format).toBe('image/png');
    expect(s.dpi).toBe('high');
    expect(s.quality).toBe(0.8);
  });

  it('buildPageImageName zero-pads page numbers', () => {
    expect(buildPageImageName('notes', 0, 'jpg')).toBe('notes-p01.jpg');
    expect(buildPageImageName('notes', 11, 'png')).toBe('notes-p12.png');
  });

  it('sanitizeBaseName strips hostile characters', () => {
    expect(sanitizeBaseName('bad:name?.pdf')).toBe('badname.pdf');
  });
});
