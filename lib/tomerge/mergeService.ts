/**
 * MergeService — combines PDFs in order into a single document via pdf-lib.
 * pdf-lib loads buffers without transferring ownership (no worker), so the
 * caller's ArrayBuffers stay intact; progress fires per completed file and
 * cancellation is checked between files.
 */

import { PDFDocument } from 'pdf-lib';
import type { UploadedPdfItem } from '../workflow/types';

export class MergeService {
  static async merge(
    items: UploadedPdfItem[],
    onProgress: (done: number, total: number, label: string) => void,
    signal?: AbortSignal,
  ): Promise<{ bytes: Uint8Array; pages: number }> {
    const out = await PDFDocument.create();

    for (let i = 0; i < items.length; i++) {
      if (signal?.aborted) throw new Error('Processing cancelled.');
      const item = items[i];
      onProgress(i, items.length, `Adding ${item.name}…`);

      const src = await PDFDocument.load(item.arrayBuffer.slice(0), {
        ignoreEncryption: false,
      });
      const copied = await out.copyPages(src, src.getPageIndices());
      copied.forEach((page) => out.addPage(page));
    }

    if (out.getPageCount() === 0) throw new Error('No pages found in the selected PDFs.');
    onProgress(items.length, items.length, 'Building final document…');

    const bytes = await out.save();
    return { bytes, pages: out.getPageCount() };
  }
}
