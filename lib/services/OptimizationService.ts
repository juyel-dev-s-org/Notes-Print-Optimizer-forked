import type { ProcessedPage, LayoutConfig, OptimizationMetrics, PresetMode, DocumentProfile, ProcessingParameters } from '../optimizer/types';
import { metricsBus } from '../metrics/MetricsBus';

export class OptimizationService {
  async processDocument(
    pdfBuffer: ArrayBuffer,
    pdfId: string,
    presetMode: PresetMode = 'AUTO_ADAPTIVE',
    onProgress?: (current: number, total: number, action: string) => void,
    onPageOptimized?: (pageIndex: number, thumbnailUrl: string, inkBeforePct: number, inkAfterPct: number) => void,
    customParams?: Partial<ProcessingParameters>,
  ): Promise<{ processedPages: ProcessedPage[]; docProfile: DocumentProfile }> {
    // Defer the processing engine until a document is actually processed.
    const { getProcessingEngine } = await import('../optimizer/engine');
    const engine = getProcessingEngine();
    const wrappedOnPageOptimized = (pageIndex: number, thumbnailUrl: string, inkBeforePct: number, inkAfterPct: number) => {
      metricsBus.emit({
        type: 'page:processed', timestamp: Date.now(),
        pageIndex, inkBeforePct, inkAfterPct,
      });
      onPageOptimized?.(pageIndex, thumbnailUrl, inkBeforePct, inkAfterPct);
    };
    const result = await engine.processDocument(
      { pdfBuffer, pdfId, presetMode, customParams },
      {},
      onProgress,
      wrappedOnPageOptimized,
    );
    return { processedPages: result.processedPages, docProfile: result.docProfile };
  }

  async compileSheets(
    processedPages: ProcessedPage[],
    layoutConfig: LayoutConfig,
    onProgress?: (current: number, total: number, action: string) => void,
  ): Promise<{ finalPdfBlob: Blob; sheetPreviews: string[]; metrics: OptimizationMetrics }> {
    const { PdfExporter } = await import('../optimizer/pdfExporter');
    return PdfExporter.compileSheetsAndExportPdf(processedPages, layoutConfig, onProgress);
  }
}
