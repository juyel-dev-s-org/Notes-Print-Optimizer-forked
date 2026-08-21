import { memoryManager } from '../optimizer/memoryManager';
import type { UploadedPdfItem } from '../workflow/types';

/** @deprecated Use UploadedPdfItem from workflow/types.ts */
export type UploadedItem = UploadedPdfItem;

export const MAX_FILE_SIZE_MB = 100;
export const MAX_TOTAL_SIZE_MB = 500;

/**
 * Sniffs the leading bytes of a File for the PDF magic marker (%PDF-).
 * The PDF spec allows up to 1024 bytes of leading garbage, so scan the
 * first kilobyte rather than only the first five bytes.
 */
export async function isLikelyPdfFile(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  for (let i = 0; i + 4 < head.length; i++) {
    if (
      head[i] === 0x25 && head[i + 1] === 0x50 &&
      head[i + 2] === 0x44 && head[i + 3] === 0x46 && head[i + 4] === 0x2d
    ) {
      return true;
    }
  }
  return false;
}

export interface PdfValidationResult {
  validFiles: File[];
  skipped: string[];
  error: string | null;
}

/**
 * Shared validator for PDF uploads — used by both the main UploadArea
 * and the Enhance tool. Keeps per-file / total-size / magic-byte checks
 * in one place so limits stay consistent.
 */
export async function validatePdfFiles(files: File[], maxFiles = 10): Promise<PdfValidationResult> {
  const validFiles: File[] = [];
  const skipped: string[] = [];
  let totalSize = 0;

  for (const file of files) {
    if (validFiles.length >= maxFiles) {
      skipped.push(`${file.name} (over ${maxFiles} file limit)`);
      continue;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      skipped.push(`${file.name} (over ${MAX_FILE_SIZE_MB} MB)`);
      continue;
    }
    const looksLikePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isPdf = looksLikePdf && (await isLikelyPdfFile(file));
    if (!isPdf) {
      skipped.push(file.name);
      continue;
    }
    validFiles.push(file);
    totalSize += file.size;
  }

  if (totalSize > MAX_TOTAL_SIZE_MB * 1024 * 1024) {
    return {
      validFiles: [],
      skipped,
      error: `Combined size exceeds the ${MAX_TOTAL_SIZE_MB} MB limit. Please upload fewer or smaller files.`,
    };
  }

  return { validFiles, skipped, error: null };
}

export class UploadService {
  static async readFiles(files: File[]): Promise<UploadedItem[]> {
    let counter = 0;
    const items: UploadedItem[] = [];
    for (const file of files) {
      counter++;
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        throw new Error(`"${file.name}" exceeds the ${MAX_FILE_SIZE_MB} MB per-file limit.`);
      }
      const buffer = await file.arrayBuffer();
      items.push({
        id: `file-${counter}-${file.name.replace(/[^a-zA-Z0-9]/g, '')}`,
        file, name: file.name,
        sizeMB: (file.size / (1024 * 1024)).toFixed(2),
        arrayBuffer: buffer,
      });
    }
    return items;
  }

  static async mergeAndPreview(items: UploadedItem[]): Promise<{ pdfBlob: Blob; pdfBytes: Uint8Array; thumbnails: string[] } | null> {
    if (items.length === 0) return null;
    // Defer pdf-lib (via PdfExporter) until a merge is actually requested.
    const { PdfExporter } = await import('../optimizer/pdfExporter');
    const buffers = items.map(it => it.arrayBuffer);
    const { pdfBytes, pdfBlob } = await PdfExporter.mergePdfBuffers(buffers);
    const pdfjsLib = await PdfExporter.initPdfJs();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;
    const renderCount = Math.min(totalPages, 12);
    const thumbnails: string[] = [];
    for (let i = 1; i <= renderCount; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 0.3 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b || new Blob()), 'image/jpeg', 0.6));
      thumbnails.push(memoryManager.createTrackedBlobUrl(blob));
    }
    return { pdfBlob, pdfBytes, thumbnails };
  }
}
