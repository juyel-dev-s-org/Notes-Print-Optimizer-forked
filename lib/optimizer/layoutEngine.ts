import { GridFormat, LayoutConfig, Orientation, PaperSize } from './types';
import { memoryManager } from './memoryManager';

export interface SheetDimensions { widthPx: number; heightPx: number; dpi: number; }
export interface SheetCompositionGeometry {
  dims: SheetDimensions;
  cols: number;
  rows: number;
  marginTop: number;
  marginLeft: number;
  marginRight: number;
  marginBottom: number;
  marginInner: number;
  footerHeight: number;
  footerFontSize: number;
  footerBaseline: number;
  cellWidth: number;
  cellHeight: number;
}

/** Keep the worker and main-thread export paths at the same print quality. */
export const PRINT_LAYOUT_DPI = 300;

export class LayoutEngine {
  public static getSheetDimensions(paperSize: PaperSize, orientation: Orientation, dpi: number = 200): SheetDimensions {
    let wIn = 8.27, hIn = 11.69;
    if (paperSize === 'LETTER') { wIn = 8.5; hIn = 11.0; }
    else if (paperSize === 'LEGAL') { wIn = 8.5; hIn = 14.0; }
    if (orientation === 'LANDSCAPE') { const t = wIn; wIn = hIn; hIn = t; }
    return { widthPx: Math.round(wIn * dpi), heightPx: Math.round(hIn * dpi), dpi };
  }

  /**
   * Grid geometry for a format. On LANDSCAPE sheets asymmetric grids are
   * transposed ('2x3' -> 3 cols x 2 rows) so cells stay slide-shaped
   * instead of stretching across the wide sheet.
   */
  public static getGridDimensions(format: GridFormat, orientation?: Orientation): { cols: number; rows: number; totalPerSheet: number } {
    const base = (() => {
      switch (format) {
        case '1x2': case '2up': return { cols: 1, rows: 2, totalPerSheet: 2 };
        case '2x2': case '4up': return { cols: 2, rows: 2, totalPerSheet: 4 };
        case '2x3': case '6up': return { cols: 2, rows: 3, totalPerSheet: 6 };
        case '2x4': case '8up': return { cols: 2, rows: 4, totalPerSheet: 8 };
        case '2x5': case '10up': return { cols: 2, rows: 5, totalPerSheet: 10 };
        case '2x1': return { cols: 2, rows: 1, totalPerSheet: 2 };
        case '3x3': return { cols: 3, rows: 3, totalPerSheet: 9 };
        case '1x1': case 'original': default: return { cols: 1, rows: 1, totalPerSheet: 1 };
      }
    })();
    if (orientation === 'LANDSCAPE' && base.cols !== base.rows) {
      return { cols: base.rows, rows: base.cols, totalPerSheet: base.totalPerSheet };
    }
    return base;
  }

  public static getSheetCompositionGeometry(config: LayoutConfig): SheetCompositionGeometry {
    const { cols, rows } = this.getGridDimensions(config.gridFormat, config.orientation);
    const dims = this.getSheetDimensions(config.paperSize, config.orientation, PRINT_LAYOUT_DPI);
    const mmPx = dims.dpi / 25.4;
    const marginTop = Math.round((config.outerMarginMm?.top ?? config.marginMm ?? 2) * mmPx);
    const marginLeft = Math.round((config.outerMarginMm?.left ?? config.marginMm ?? 5) * mmPx);
    const marginRight = Math.round((config.outerMarginMm?.right ?? config.marginMm ?? 3) * mmPx);
    const marginBottom = Math.round((config.outerMarginMm?.bottom ?? config.marginMm ?? 2) * mmPx);
    const marginInner = Math.round((config.innerMarginMm ?? config.spacingMm ?? 1) * mmPx);
    const footerHeight = config.showPageNumbers ? Math.max(20, Math.round(marginBottom * 1.5)) : 0;
    const availableWidth = dims.widthPx - marginLeft - marginRight - (cols - 1) * marginInner;
    const availableHeight = dims.heightPx - marginTop - marginBottom - (rows - 1) * marginInner - footerHeight;

    return {
      dims, cols, rows, marginTop, marginLeft, marginRight, marginBottom, marginInner,
      footerHeight,
      footerFontSize: Math.round(dims.dpi * 0.08),
      footerBaseline: dims.heightPx - Math.max(10, Math.round(marginBottom * 0.4)),
      cellWidth: Math.max(10, Math.floor(availableWidth / cols)),
      cellHeight: Math.max(10, Math.floor(availableHeight / rows)),
    };
  }

  public static getSheetFooterText(sheetIndex: number, totalSheets: number): string {
    return `Sheet ${sheetIndex + 1} of ${totalSheets}  \u2022  Print Optimizer`;
  }

  public static composeSheet(slideImages: ImageData[], sheetIndex: number, totalSheets: number, config: LayoutConfig): HTMLCanvasElement {
    const geometry = this.getSheetCompositionGeometry(config);
    const { dims, cols, marginTop, marginLeft, marginInner, cellWidth, cellHeight } = geometry;
    const canvas = document.createElement('canvas');
    canvas.width = dims.widthPx; canvas.height = dims.heightPx;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, dims.widthPx, dims.heightPx);

    let tmpCanvas: HTMLCanvasElement | null = null;
    let tmpCtx: CanvasRenderingContext2D | null = null;

    for (let i = 0; i < slideImages.length; i++) {
      const slide = slideImages[i];
      const col = i % cols, row = Math.floor(i / cols);
      const cellX = marginLeft + col * (cellWidth + marginInner), cellY = marginTop + row * (cellHeight + marginInner);
      const scale = Math.min(cellWidth / slide.width, cellHeight / slide.height);
      const dW = Math.floor(slide.width * scale), dH = Math.floor(slide.height * scale);
      const dX = cellX + Math.floor((cellWidth - dW) / 2), dY = cellY + Math.floor((cellHeight - dH) / 2);

      if (!tmpCanvas || tmpCanvas.width !== slide.width || tmpCanvas.height !== slide.height) {
        if (tmpCanvas) memoryManager.disposeCanvas(tmpCanvas);
        tmpCanvas = memoryManager.acquireCanvas(slide.width, slide.height);
        tmpCtx = tmpCanvas.getContext('2d', { willReadFrequently: true });
      }
      if (tmpCtx) {
        tmpCtx.putImageData(slide, 0, 0);
        ctx.drawImage(tmpCanvas, dX, dY, dW, dH);
      }

      if (config.showSlideBorders ?? true) {
        ctx.strokeStyle = '#D2D2D2';
        ctx.lineWidth = Math.max(1, Math.round(dims.dpi / 150));
        ctx.strokeRect(cellX - 1, cellY - 1, cellWidth + 2, cellHeight + 2);
      }
    }

    if (tmpCanvas) {
      memoryManager.disposeCanvas(tmpCanvas);
    }

    if (config.showPageNumbers) {
      ctx.fillStyle = '#64748B';
      ctx.font = `500 ${geometry.footerFontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(this.getSheetFooterText(sheetIndex, totalSheets), dims.widthPx / 2, geometry.footerBaseline);
    }
    return canvas;
  }
}
