/**
 * SplitService — page extraction and fixed-size bursting via pdf-lib.
 *
 * The source document is loaded ONCE and reused across every output part
 * (copyPages is cheap metadata work; re-parsing per part would be the
 * wasteful alternative). Buffers are copied defensively before load so the
 * caller's memory stays pristine regardless of pdf-lib internals.
 */

import { PDFDocument } from 'pdf-lib';
import type { PageChunk } from '../shared/chunks';

export interface SplitPart {
  index: number;
  bytes: Uint8Array;
  pages: number;
}

export class SplitService {
  static async extract(bytes: Uint8Array, window: { start: number; end: number }): Promise<{ bytes: Uint8Array; pages: number }> {
    const src = await PDFDocument.load(bytes.slice(0));
    const indices: number[] = [];
    for (let p = window.start; p <= window.end; p++) indices.push(p - 1);
    if (indices.length === 0) throw new Error('No pages in the selected range.');

    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, indices);
    copied.forEach((page) => out.addPage(page));
    return { bytes: await out.save(), pages: out.getPageCount() };
  }

  static async splitEvery(
    bytes: Uint8Array,
    chunks: PageChunk[],
    onPart?: (done: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<SplitPart[]> {
    const src = await PDFDocument.load(bytes.slice(0));
    const parts: SplitPart[] = [];

    for (let i = 0; i < chunks.length; i++) {
      if (signal?.aborted) throw new Error('Processing cancelled.');
      const chunk = chunks[i];
      const out = await PDFDocument.create();
      const indices: number[] = [];
      for (let p = chunk.start; p <= chunk.end; p++) indices.push(p - 1);
      const copied = await out.copyPages(src, indices);
      copied.forEach((page) => out.addPage(page));
      parts.push({ index: i, bytes: await out.save(), pages: out.getPageCount() });
      onPart?.(i + 1, chunks.length);
    }
    return parts;
  }
}
