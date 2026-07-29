import { describe, it, expect } from 'vitest';
import { LayoutEngine } from '../../lib/optimizer/layoutEngine';
import { GridFormat, Orientation, PaperSize } from '../../lib/optimizer/types';

describe('LayoutEngine', () => {
  describe('getGridDimensions', () => {
    it('should return correct dimensions for 1x2 format', () => {
      const dims = LayoutEngine.getGridDimensions('1x2');
      expect(dims.cols).toBe(1);
      expect(dims.rows).toBe(2);
      expect(dims.totalPerSheet).toBe(2);
    });

    it('should return correct dimensions for 2x2 format', () => {
      const dims = LayoutEngine.getGridDimensions('2x2');
      expect(dims.cols).toBe(2);
      expect(dims.rows).toBe(2);
      expect(dims.totalPerSheet).toBe(4);
    });

    it('should return correct dimensions for 2x4 format', () => {
      const dims = LayoutEngine.getGridDimensions('2x4');
      expect(dims.cols).toBe(2);
      expect(dims.rows).toBe(4);
      expect(dims.totalPerSheet).toBe(8);
    });

    it('should default to 1x1 for unknown formats', () => {
      const dims = LayoutEngine.getGridDimensions('unknown' as GridFormat);
      expect(dims.cols).toBe(1);
      expect(dims.rows).toBe(1);
      expect(dims.totalPerSheet).toBe(1);
    });
  });

  describe('getSheetDimensions', () => {
    it('should return correct A4 portrait dimensions at 200 DPI', () => {
      const dims = LayoutEngine.getSheetDimensions('A4', 'PORTRAIT', 200);
      expect(dims.widthPx).toBe(1654); // 8.27 * 200
      expect(dims.heightPx).toBe(2338); // 11.69 * 200
      expect(dims.dpi).toBe(200);
    });

    it('should swap width and height for landscape orientation', () => {
      const portrait = LayoutEngine.getSheetDimensions('A4', 'PORTRAIT', 200);
      const landscape = LayoutEngine.getSheetDimensions('A4', 'LANDSCAPE', 200);
      expect(landscape.widthPx).toBe(portrait.heightPx);
      expect(landscape.heightPx).toBe(portrait.widthPx);
    });

    it('should return correct LETTER dimensions', () => {
      const dims = LayoutEngine.getSheetDimensions('LETTER', 'PORTRAIT', 150);
      expect(dims.widthPx).toBe(1275); // 8.5 * 150
      expect(dims.heightPx).toBe(1650); // 11.0 * 150
    });
  });
});
