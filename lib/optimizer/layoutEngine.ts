import { GridFormat, LayoutConfig, Orientation, PaperSize } from './types';

export interface SheetDimensions { widthPx: number; heightPx: number; dpi: number; }

export class LayoutEngine {
  public static getSheetDimensions(paperSize: PaperSize, orientation: Orientation, dpi: number = 200): SheetDimensions {
    let wIn = 8.27, hIn = 11.69;
    if (paperSize === 'LETTER') { wIn = 8.5; hIn = 11.0; }
    else if (paperSize === 'LEGAL') { wIn = 8.5; hIn = 14.0; }
    if (orientation === 'LANDSCAPE') { const t = wIn; wIn = hIn; hIn = t; }
    return { widthPx: Math.round(wIn * dpi), heightPx: Math.round(hIn * dpi), dpi };
  }

  public static getGridDimensions(format: GridFormat): { cols: number; rows: number; totalPerSheet: number } {
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
  }

  public static composeSheet(slideImages: ImageData[], sheetIndex: number, totalSheets: number, config: LayoutConfig): HTMLCanvasElement {
    const { cols, rows } = this.getGridDimensions(config.gridFormat);
    const dpi = 300;
    const dims = this.getSheetDimensions(config.paperSize, config.orientation, dpi);
    const canvas = document.createElement('canvas');
    canvas.width = dims.widthPx; canvas.height = dims.heightPx;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, dims.widthPx, dims.heightPx);

    const mmPx = dpi / 25.4;
    const mT = Math.round((config.outerMarginMm?.top ?? config.marginMm ?? 2) * mmPx);
    const mL = Math.round((config.outerMarginMm?.left ?? config.marginMm ?? 5) * mmPx);
    const mR = Math.round((config.outerMarginMm?.right ?? config.marginMm ?? 3) * mmPx);
    const mB = Math.round((config.outerMarginMm?.bottom ?? config.marginMm ?? 2) * mmPx);
    const mI = Math.round((config.innerMarginMm ?? config.spacingMm ?? 1) * mmPx);
    const footerH = config.showPageNumbers ? Math.max(20, Math.round(mB * 1.5)) : 0;
    const availW = dims.widthPx - mL - mR - (cols - 1) * mI;
    const availH = dims.heightPx - mT - mB - (rows - 1) * mI - footerH;
    const cellW = Math.max(10, Math.floor(availW / cols));
    const cellH = Math.max(10, Math.floor(availH / rows));

    for (let i = 0; i < slideImages.length; i++) {
      const slide = slideImages[i];
      const col = i % cols, row = Math.floor(i / cols);
      const cellX = mL + col * (cellW + mI), cellY = mT + row * (cellH + mI);
      const scale = Math.min(cellW / slide.width, cellH / slide.height);
      const dW = Math.floor(slide.width * scale), dH = Math.floor(slide.height * scale);
      const dX = cellX + Math.floor((cellW - dW) / 2), dY = cellY + Math.floor((cellH - dH) / 2);
      const tmp = document.createElement('canvas');
      tmp.width = slide.width; tmp.height = slide.height;
      tmp.getContext('2d')!.putImageData(slide, 0, 0);
      ctx.drawImage(tmp, dX, dY, dW, dH);
      tmp.width = 0; tmp.height = 0;
      if (config.showSlideBorders ?? true) {
        ctx.strokeStyle = '#D2D2D2';
        ctx.lineWidth = Math.max(1, Math.round(dpi / 150));
        ctx.strokeRect(cellX - 1, cellY - 1, cellW + 2, cellH + 2);
      }
    }

    if (config.showPageNumbers) {
      ctx.fillStyle = '#64748B';
      ctx.font = `500 ${Math.round(dpi * 0.08)}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(`Sheet ${sheetIndex + 1} of ${totalSheets}  \u2022  PW Notes Print Optimizer`,
        dims.widthPx / 2, dims.heightPx - Math.max(10, Math.round(mB * 0.4)));
    }
    return canvas;
  }
}
