import { afterEach, describe, expect, it, vi } from 'vitest';
import { PdfExporter } from '../../lib/optimizer/pdfExporter';
import { LayoutEngine } from '../../lib/optimizer/layoutEngine';
import type { LayoutConfig } from '../../lib/optimizer/types';

const layoutConfig: LayoutConfig = {
  paperSize: 'A4',
  orientation: 'PORTRAIT',
  gridFormat: '1x1',
  marginMm: 2,
  spacingMm: 1,
  outerMarginMm: { top: 2, right: 2, bottom: 2, left: 2 },
  innerMarginMm: 1,
  headerTitle: '',
  showSlideBorders: true,
  showPageNumbers: false,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PdfExporter composition fallback', () => {
  it('preserves sheet dimensions after releasing the fallback canvas', async () => {
    const jpegBlob = {
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    } as Blob;
    const canvas = {
      width: 2481,
      height: 3507,
      toBlob: (callback: BlobCallback) => callback(jpegBlob),
    } as unknown as HTMLCanvasElement;
    vi.spyOn(LayoutEngine, 'composeSheet').mockReturnValue(canvas);

    const compose = (PdfExporter as unknown as {
      composeSheetWithWorker: (
        pages: ImageData[], sheetIndex: number, totalSheets: number, config: LayoutConfig,
      ) => Promise<{ jpegBuffer: ArrayBuffer; width: number; height: number }>;
    }).composeSheetWithWorker;

    const result = await compose([new ImageData(new Uint8ClampedArray(4), 1, 1)], 0, 1, layoutConfig);

    expect(result.width).toBe(2481);
    expect(result.height).toBe(3507);
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    expect(result.jpegBuffer.byteLength).toBeGreaterThan(0);
  });
});
