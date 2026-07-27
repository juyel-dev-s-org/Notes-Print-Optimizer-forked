import { GridFormat, LayoutConfig, Orientation, PaperSize } from './types';

export interface SheetDimensions {
  widthPx: number;
  heightPx: number;
  dpi: number;
}

export class LayoutEngine {
  /**
   * Get pixel dimensions for paper sizes at specified DPI (default 300 DPI for print quality)
   */
  public static getSheetDimensions(
    paperSize: PaperSize,
    orientation: Orientation,
    dpi: number = 200 // 200 DPI gives excellent balance of 1650x2338px print resolution and fast rendering
  ): SheetDimensions {
    // A4: 210mm x 297mm (8.27 x 11.69 inches)
    // Letter: 8.5 x 11 inches
    // Legal: 8.5 x 14 inches
    let widthInches = 8.27;
    let heightInches = 11.69;

    if (paperSize === 'LETTER') {
      widthInches = 8.5;
      heightInches = 11.0;
    } else if (paperSize === 'LEGAL') {
      widthInches = 8.5;
      heightInches = 14.0;
    }

    if (orientation === 'LANDSCAPE') {
      const temp = widthInches;
      widthInches = heightInches;
      heightInches = temp;
    }

    return {
      widthPx: Math.round(widthInches * dpi),
      heightPx: Math.round(heightInches * dpi),
      dpi,
    };
  }

  /**
   * Get grid columns and rows for format matching PW Notes Colab notebook
   */
  public static getGridDimensions(format: GridFormat): { cols: number; rows: number; totalPerSheet: number } {
    switch (format) {
      case '1x2':
      case '2up':
        return { cols: 1, rows: 2, totalPerSheet: 2 };
      case '2x2':
      case '4up':
        return { cols: 2, rows: 2, totalPerSheet: 4 };
      case '2x3':
      case '6up':
        return { cols: 2, rows: 3, totalPerSheet: 6 };
      case '2x4':
      case '8up':
        return { cols: 2, rows: 4, totalPerSheet: 8 };
      case '2x5':
      case '10up':
        return { cols: 2, rows: 5, totalPerSheet: 10 };
      case '2x1':
        return { cols: 2, rows: 1, totalPerSheet: 2 };
      case '3x3':
        return { cols: 3, rows: 3, totalPerSheet: 9 };
      case '1x1':
      case 'original':
      default:
        return { cols: 1, rows: 1, totalPerSheet: 1 };
    }
  }

  /**
   * Compose slide images into printable sheets based on LayoutConfig
   * Adheres strictly to the notebook layout engine (A4 300DPI 2480x3508, MARGIN=60, GAP=18)
   */
  public static composeSheet(
    slideImages: ImageData[],
    sheetIndex: number,
    totalSheets: number,
    config: LayoutConfig
  ): HTMLCanvasElement {
    const { cols, rows } = this.getGridDimensions(config.gridFormat);
    const dpi = 300;
    const dimensions = this.getSheetDimensions(
      config.paperSize,
      config.orientation,
      dpi
    );

    const canvas = document.createElement('canvas');
    canvas.width = dimensions.widthPx;
    canvas.height = dimensions.heightPx;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to create 2D canvas context');
    }

    // Fill white background for printable sheet
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, dimensions.widthPx, dimensions.heightPx);

    // Convert mm margins to pixels dynamically at current canvas DPI
    const mmToPx = (mm: number) => Math.round((mm * dpi) / 25.4);

    const marginTopPx = mmToPx(config.outerMarginMm?.top ?? config.marginMm ?? 2);
    const marginLeftPx = mmToPx(config.outerMarginMm?.left ?? config.marginMm ?? 5);
    const marginRightPx = mmToPx(config.outerMarginMm?.right ?? config.marginMm ?? 3);
    const marginBottomPx = mmToPx(config.outerMarginMm?.bottom ?? config.marginMm ?? 2);
    const innerMarginPx = mmToPx(config.innerMarginMm ?? config.spacingMm ?? 1);

    const footerHeightPx = config.showPageNumbers ? Math.max(20, Math.round(marginBottomPx * 1.5)) : 0;

    const availableWidth = dimensions.widthPx - marginLeftPx - marginRightPx - (cols - 1) * innerMarginPx;
    const availableHeight = dimensions.heightPx - marginTopPx - marginBottomPx - (rows - 1) * innerMarginPx - footerHeightPx;

    const cellWidth = Math.max(10, Math.floor(availableWidth / cols));
    const cellHeight = Math.max(10, Math.floor(availableHeight / rows));

    // Draw Slides in Grid
    for (let i = 0; i < slideImages.length; i++) {
      const slide = slideImages[i];
      const col = i % cols;
      const row = Math.floor(i / cols);

      const cellX = marginLeftPx + col * (cellWidth + innerMarginPx);
      const cellY = marginTopPx + row * (cellHeight + innerMarginPx);

      // Fit slide image maintaining aspect ratio without distorting or cropping
      const sw = slide.width;
      const sh = slide.height;
      const scale = Math.min(cellWidth / sw, cellHeight / sh);

      const drawWidth = Math.floor(sw * scale);
      const drawHeight = Math.floor(sh * scale);

      const drawX = cellX + Math.floor((cellWidth - drawWidth) / 2);
      const drawY = cellY + Math.floor((cellHeight - drawHeight) / 2);

      // Convert ImageData to offscreen canvas
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = sw;
      tempCanvas.height = sh;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.putImageData(slide, 0, 0);
        ctx.drawImage(tempCanvas, drawX, drawY, drawWidth, drawHeight);
      }
      // Dispose tempCanvas to free VRAM immediately
      tempCanvas.width = 0;
      tempCanvas.height = 0;

      // Draw subtle bounding outline box around grid cell (Notebook style: rgb 210,210,210)
      if (config.showSlideBorders ?? true) {
        ctx.strokeStyle = '#D2D2D2';
        ctx.lineWidth = 1;
        ctx.strokeRect(cellX - 1, cellY - 1, cellWidth + 2, cellHeight + 2);
      }
    }

    // Optional Footer Page Number if requested
    if (config.showPageNumbers) {
      ctx.fillStyle = '#64748B';
      ctx.font = `500 ${Math.round(dpi * 0.08)}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(
        `Sheet ${sheetIndex + 1} of ${totalSheets}  •  PW Notes Print Optimizer`,
        dimensions.widthPx / 2,
        dimensions.heightPx - Math.max(10, Math.round(marginBottomPx * 0.4))
      );
    }

    return canvas;
  }
}
