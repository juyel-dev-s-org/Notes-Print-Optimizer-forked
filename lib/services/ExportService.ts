import type { ProcessedPage } from '../optimizer/types';

export class ExportService {
  static downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  static async exportOptimized1Up(processedPages: ProcessedPage[]): Promise<Blob> {
    const { PdfExporter } = await import('../optimizer/pdfExporter');
    return PdfExporter.export1UpOptimizedPdf(processedPages);
  }
}
