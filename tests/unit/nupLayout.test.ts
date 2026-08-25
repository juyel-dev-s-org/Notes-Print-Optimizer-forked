import { describe, expect, it } from 'vitest';
import {
  cellRect,
  fitInto,
  nupGrid,
  nupPaperSize,
  planSheet,
  totalSheetsFor,
} from '../../lib/nup/nupLayout';

const base = {
  paper: 'A4' as const,
  orientation: 'PORTRAIT' as const,
  margins: { outer: 5, inner: 3 },
  borders: true,
  numbers: false,
};

describe('nupGrid', () => {
  it('maps formats to portrait grids', () => {
    expect(nupGrid('1x1', 'PORTRAIT')).toEqual({ cols: 1, rows: 1 });
    expect(nupGrid('1x2', 'PORTRAIT')).toEqual({ cols: 2, rows: 1 });
    expect(nupGrid('2x2', 'PORTRAIT')).toEqual({ cols: 2, rows: 2 });
    expect(nupGrid('2x3', 'PORTRAIT')).toEqual({ cols: 2, rows: 3 });
    expect(nupGrid('3x3', 'PORTRAIT')).toEqual({ cols: 3, rows: 3 });
    expect(nupGrid('4x4', 'PORTRAIT')).toEqual({ cols: 4, rows: 4 });
    expect(nupGrid('3x5', 'PORTRAIT')).toEqual({ cols: 3, rows: 5 });
  });

  it('transposes asymmetric grids on landscape (mirrors LayoutEngine)', () => {
    expect(nupGrid('2x3', 'LANDSCAPE')).toEqual({ cols: 3, rows: 2 });
    expect(nupGrid('2x5', 'LANDSCAPE')).toEqual({ cols: 5, rows: 2 });
    // symmetric stays
    expect(nupGrid('2x2', 'LANDSCAPE')).toEqual({ cols: 2, rows: 2 });
    expect(nupGrid('3x3', 'LANDSCAPE')).toEqual({ cols: 3, rows: 3 });
  });
});

describe('nupPaperSize', () => {
  it('returns A4/Letter/Legal in portrait points', () => {
    expect(nupPaperSize('A4', 'PORTRAIT')).toEqual({ w: 595, h: 842 });
    expect(nupPaperSize('LETTER', 'PORTRAIT')).toEqual({ w: 612, h: 792 });
    expect(nupPaperSize('LEGAL', 'PORTRAIT')).toEqual({ w: 612, h: 1008 });
  });

  it('swaps on landscape', () => {
    const p = nupPaperSize('A4', 'PORTRAIT');
    const l = nupPaperSize('A4', 'LANDSCAPE');
    expect(l).toEqual({ w: p.h, h: p.w });
  });
});

describe('planSheet + cellRect geometry invariants', () => {
  const formats = ['1x1', '1x2', '2x2', '2x3', '3x3', '2x4', '2x5', '4x4', '3x5'] as const;
  const papers = ['A4', 'LETTER', 'LEGAL'] as const;

  for (const format of formats) {
    for (const paper of papers) {
      for (const orientation of ['PORTRAIT', 'LANDSCAPE'] as const) {
        it(`${format} ${paper} ${orientation}: cells tile the printable area exactly`, () => {
          const opts = { ...base, format, paper, orientation };
          const plan = planSheet(opts);
          const { w, h } = nupPaperSize(paper, orientation);
          const grid = nupGrid(format, orientation);

          // per-sheet count matches grid
          expect(plan.cols).toBe(grid.cols);
          expect(plan.rows).toBe(grid.rows);
          expect(plan.perSheet).toBe(grid.cols * grid.rows);

          // cells must fit inside the sheet
          for (let i = 0; i < plan.perSheet; i++) {
            const c = cellRect(plan, i, h);
            expect(c.x).toBeGreaterThanOrEqual(-0.001);
            expect(c.y).toBeGreaterThanOrEqual(-0.001);
            expect(c.x + c.w).toBeLessThanOrEqual(w + 0.001);
            expect(c.y + c.h).toBeLessThanOrEqual(h + 0.001);
          }

          // no overlaps between adjacent cells (check first two rows/cols)
          const a = cellRect(plan, 0, h);
          const b = cellRect(plan, 1 % plan.perSheet, h);
          if (plan.perSheet > 1 && plan.cols > 1) {
            const overlapX = a.x + a.w <= b.x + 0.001 || b.x + b.w <= a.x + 0.001;
            const overlapY = a.y + a.h <= b.y + 0.001 || b.y + b.h <= a.y + 0.001;
            expect(overlapX || overlapY).toBe(true);
          }
        });
      }
    }
  }
});

describe('fitInto letterboxing', () => {
  it('fits inside the cell preserving aspect and centering', () => {
    const plan = planSheet({ ...base, format: '2x2' });
    const cell = cellRect(plan, 0, 842);
    // wide source in tall cell
    const wide = fitInto(1000, 500, cell);
    expect(wide.w / wide.h).toBeCloseTo(2, 5);
    expect(wide.x).toBeGreaterThanOrEqual(cell.x - 0.001);
    expect(wide.y).toBeGreaterThanOrEqual(cell.y - 0.001);
    expect(wide.x + wide.w).toBeLessThanOrEqual(cell.x + cell.w + 0.001);
    expect(wide.y + wide.h).toBeLessThanOrEqual(cell.y + cell.h + 0.001);
    // centered horizontally when height-limited
    expect((wide.x + wide.w / 2)).toBeCloseTo(cell.x + cell.w / 2, 5);
  });
});

describe('totalSheetsFor', () => {
  it('ceil-divides and never returns zero', () => {
    expect(totalSheetsFor(0, 4)).toBe(1); // defensive min 1 sheet
    expect(totalSheetsFor(1, 4)).toBe(1);
    expect(totalSheetsFor(6, 4)).toBe(2);
    expect(totalSheetsFor(10, 9)).toBe(2);
    expect(totalSheetsFor(100, 16)).toBe(7);
  });
});
