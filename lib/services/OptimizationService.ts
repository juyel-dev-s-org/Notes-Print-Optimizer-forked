import type { EngineVersion } from '../optimizer/engine/types';
import { getProcessingEngine } from '../optimizer/engine';
import type { ProcessedPage, LayoutConfig, OptimizationMetrics, PresetMode, DocumentProfile } from '../optimizer/types';
import { metricsBus } from '../metrics/MetricsBus';

export class OptimizationService {
  async processDocument(
    pdfBuffer: ArrayBuffer,
    pdfId: string,
    presetMode: PresetMode = 'AUTO_ADAPTIVE',
    engineVersion?: EngineVersion,
    onProgress?: (current: number, total: number, action: string) => void,
    onPageOptimized?: (pageIndex: number, thumbnailUrl: string, inkBeforePct: number, inkAfterPct: number) => void,
  ): Promise<{ processedPages: ProcessedPage[]; docProfile: DocumentProfile }> {
    const engine = getProcessingEngine(engineVersion);
    const wrappedOnPageOptimized = (pageIndex: number, thumbnailUrl: string, inkBeforePct: number, inkAfterPct: number) => {
      metricsBus.emit({
        type: 'page:processed', timestamp: Date.now(),
        pageIndex, inkBeforePct, inkAfterPct,
      });
      onPageOptimized?.(pageIndex, thumbnailUrl, inkBeforePct, inkAfterPct);
    };
    const result = await engine.processDocument(
      { pdfBuffer, pdfId, presetMode },
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
