/**
 * EnhanceHandoffService — bridge from the Enhance Light PDF tool into the
 * main pipeline's LAYOUT phase without re-running the optimizer.
 *
 * The enhance tool already produced final print-ready page images (JPEG
 * data URLs). N-Up layout is pure geometry, so instead of routing the PDF
 * back through INITIALIZING/OPTIMIZING we simply publish those enhanced
 * JPEGs into the same IndexedDB page store the optimizer uses, then hand
 * the LAYOUT screen a matching ProcessedPage[] manifest.
 */

import { pwOptimizerStorage } from '../optimizer/storage';
import { ParameterGenerator } from '../optimizer/parameterGenerator';
import type {
  PageClassification,
  PageProfile,
  ProcessedPage,
} from '../optimizer/types';

/** Minimal shape the enhance tool contributes per page. */
export interface HandoffPageInput {
  /** Final enhanced page image (JPEG data URL). */
  dataUrl: string;
  width: number;
  height: number;
}

export class EnhanceHandoffService {
  /** Distinct id namespace so cache entries never collide with optimizer docs. */
  static buildPdfId(): string {
    return `pw_enh_${Date.now()}`;
  }

  /** dataURL -> Blob via pure base64 decode (works in jsdom/unit tests). */
  static dataUrlToJpegBlob(dataUrl: string): Blob {
    const [meta, base64] = dataUrl.split(',');
    const mime = meta?.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    const binary = atob(base64 ?? '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  /**
   * Neutral page stats: the LAYOUT phase consumes only width/height for grid
   * math, so the histogram-derived fields are honest placeholders describing
   * what enhance guarantees (light background, faint-ink notes).
   */
  static buildProcessedPages(pages: HandoffPageInput[], pdfId: string): ProcessedPage[] {
    const parameters = ParameterGenerator.getPresetParameters('LIGHT_HANDWRITTEN');
    return pages.map((page, index): ProcessedPage => ({
      pageIndex: index,
      thumbnailDataUrl: page.dataUrl,
      profile: EnhanceHandoffService.neutralProfile(index, page.width, page.height),
      parameters,
      inkCoverageBeforePct: 8,
      inkCoverageAfterPct: 8,
      width: page.width,
      height: page.height,
      storageKey: pdfId,
    }));
  }

  /** Writes every enhanced JPEG under one pdfId for loadOptimizedImageData(). */
  static async persistPages(pages: HandoffPageInput[], pdfId: string): Promise<void> {
    await pwOptimizerStorage.storePagesBatch(
      pages.map((page, index) => ({
        pdfId,
        pageIndex: index,
        originalBlob: null,
        optimizedBlob: EnhanceHandoffService.dataUrlToJpegBlob(page.dataUrl),
      })),
    );
  }

  private static neutralProfile(pageIndex: number, width: number, height: number): PageProfile {
    const classification: PageClassification = 'HANDWRITTEN_NOTES';
    return {
      pageIndex,
      width,
      height,
      averageBrightness: 235,
      contrast: 45,
      inkDensity: 0.08,
      darkBackgroundRatio: 0,
      lightBackgroundRatio: 1,
      dominantHue: 0,
      hasTopBanner: false,
      topBannerHeightPct: 0,
      hasBottomBanner: false,
      bottomBannerHeightPct: 0,
      estimatedNoise: 0,
      strokeThickness: 1,
      classification,
    };
  }
}
