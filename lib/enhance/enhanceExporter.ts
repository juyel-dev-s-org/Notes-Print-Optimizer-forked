/**
 * enhanceExporter — builds the print-ready PDF from enhanced page images.
 *
 * Follows the same embedding pattern as the main flow's 1-up export
 * (pdf-lib + embedJpg) with an identical page size per source page, so
 * printed output matches the original geometry 1:1.
 */

import { PDFDocument } from 'pdf-lib';
import { memoryManager } from '@/lib/optimizer/memoryManager';
import type { EnhancePageResult } from './types';

export interface EnhanceExportProgress {
  current: number;
  total: number;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export class EnhanceExporter {
  /**
   * Assembles one A4-sized-per-original-geometry page per enhanced page.
   * Returns the PDF as a Blob ready for download.
   */
  public static async exportPdf(
    results: EnhancePageResult[],
    onProgress?: (p: EnhanceExportProgress) => void,
  ): Promise<Blob> {
    const pdfDoc = await PDFDocument.create();
    for (let i = 0; i < results.length; i++) {
      if (onProgress) onProgress({ current: i, total: results.length });
      const page = results[i];
      const embedded = await pdfDoc.embedJpg(dataUrlToBytes(page.dataUrl));
      const pdfPage = pdfDoc.addPage([page.width, page.height]);
      pdfPage.drawImage(embedded, { x: 0, y: 0, width: page.width, height: page.height });
      await memoryManager.yieldToUI();
    }
    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  }
}