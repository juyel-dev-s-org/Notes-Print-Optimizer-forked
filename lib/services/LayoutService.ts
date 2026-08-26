import { memoryManager } from '../optimizer/memoryManager';
import type { ProcessedPage, LayoutConfig, OptimizationMetrics, GridFormat, OuterMarginConfig } from '../optimizer/types';

export class LayoutService {
  static async compilePrintLayout(
    activePages: ProcessedPage[],
    config: LayoutConfig,
    onProgress?: (current: number, total: number, action: string) => void,
    opts?: { keepOriginalPages?: Set<number>; manualWhiteBoxRegions?: Record<number, import('../kernels/whiteBox').WhiteBoxRegion[]>; mergedPdfBytes?: Uint8Array | null },
  ): Promise<{ finalPdfBlob: Blob; sheetPreviews: string[]; metrics: OptimizationMetrics }> {
    /* Free only the previous sheet previews — a blanket revoke here used to
       kill live thumbnails (merged/processed pages) whose URLs are still
       referenced by state, producing ERR_FILE_NOT_FOUND on the next paint. */
    memoryManager.revokeTaggedBlobUrls('sheet-preview');
    if (activePages.length === 0) throw new Error('No pages to layout');
    // Defer pdf-lib (via PdfExporter) until layout/export is actually requested.
    const { PdfExporter } = await import('../optimizer/pdfExporter');
    return PdfExporter.compileSheetsAndExportPdf(activePages, config, onProgress, opts as never);
  }

  static updateGridFormat(config: LayoutConfig, format: GridFormat): LayoutConfig {
    return { ...config, gridFormat: format };
  }

  static toggleOrientation(config: LayoutConfig): LayoutConfig {
    const orientation = config.orientation === 'PORTRAIT' ? 'LANDSCAPE' : 'PORTRAIT';
    return { ...config, orientation };
  }

  static toggleBorders(config: LayoutConfig): LayoutConfig {
    return { ...config, showSlideBorders: !config.showSlideBorders };
  }

  static togglePageNumbers(config: LayoutConfig): LayoutConfig {
    return { ...config, showPageNumbers: !config.showPageNumbers };
  }

  static updateOuterMargins(config: LayoutConfig, outerMargins: OuterMarginConfig): LayoutConfig {
    return { ...config, outerMarginMm: outerMargins };
  }

  static updateInnerMargin(config: LayoutConfig, innerMarginMm: number): LayoutConfig {
    return { ...config, innerMarginMm };
  }

  static getActivePages(processedPages: ProcessedPage[], excludedPages: Set<number>): ProcessedPage[] {
    return processedPages.filter(p => !excludedPages.has(p.pageIndex));
  }
}
