import { describe, expect, it } from 'vitest';
import {
  MIN_SERIES_SIZE,
  naturalCompare,
  numberToRoman,
  parseFileName,
  planSmartOrder,
  romanToNumber,
  signatureFor,
} from '../../lib/rearrange';
import type { RearrangeableItem } from '../../lib/rearrange';

const item = (id: string, name: string): RearrangeableItem => ({ id, name });

const ids = (items: RearrangeableItem[]) => items.map((i) => i.id);
const names = (items: RearrangeableItem[]) => items.map((i) => i.name);

describe('rearrange: naturalCompare', () => {
  it('orders digit runs numerically, not lexicographically', () => {
    expect(naturalCompare('file 2', 'file 10')).toBeLessThan(0);
    expect(naturalCompare('file 10', 'file 2')).toBeGreaterThan(0);
    expect(naturalCompare('calculus 9', 'calculus 13')).toBeLessThan(0);
  });

  it('handles zero padding without changing numeric order', () => {
    expect(naturalCompare('lecture 02', 'lecture 10')).toBeLessThan(0);
    expect(naturalCompare('lecture 007', 'lecture 2')).toBeGreaterThan(0);
    expect(naturalCompare('x 007', 'x 7')).toBe(0);
  });

  it('is case-insensitive and separator tolerant', () => {
    expect(naturalCompare('Notes A', 'notes a')).toBe(0);
    expect(naturalCompare('abc', 'abd')).toBeLessThan(0);
  });

  it('shorter prefix sorts first', () => {
    expect(naturalCompare('maths', 'maths 2')).toBeLessThan(0);
  });
});

describe('rearrange: roman numerals', () => {
  it('converts canonical numerals', () => {
    expect(romanToNumber('I')).toBe(1);
    expect(romanToNumber('ii')).toBe(2);
    expect(romanToNumber('XIV')).toBe(14);
    expect(romanToNumber('XCIX')).toBe(99);
    expect(romanToNumber('MMXXIV')).toBe(2024);
  });

  it('rejects non-canonical and non-roman words', () => {
    expect(romanToNumber('IIII')).toBe(-1);
    expect(romanToNumber('IC')).toBe(-1);
    expect(romanToNumber('CIVIL')).toBe(-1);
    expect(romanToNumber('MIX')).toBe(-1);
    expect(romanToNumber('ABC')).toBe(-1);
    expect(romanToNumber('')).toBe(-1);
  });

  it('round-trips through numberToRoman', () => {
    for (const v of [1, 4, 9, 14, 40, 90, 400, 999, 3999]) {
      expect(romanToNumber(numberToRoman(v))).toBe(v);
    }
  });
});

describe('rearrange: parseFileName', () => {
  it('strips the extension and finds plain numbers', () => {
    const p = parseFileName('Calculus 3.pdf');
    expect(p.stem).toBe('Calculus 3');
    const nums = p.tokens.filter((t) => t.kind === 'number');
    expect(nums).toHaveLength(1);
    expect(nums[0].value).toBe(3);
  });

  it('detects ordinals', () => {
    const p = parseFileName('21st Lecture.pdf');
    const ord = p.tokens.find((t) => t.kind === 'ordinal');
    expect(ord?.value).toBe(21);
  });

  it('detects canonical roman tokens but not look-alike words', () => {
    expect(parseFileName('Algebra II.pdf').tokens.some((t) => t.kind === 'roman' && t.value === 2)).toBe(true);
    expect(parseFileName('Civil Notes.pdf').tokens.every((t) => t.kind === 'text')).toBe(true);
  });

  it('keeps decimal numbers as one token', () => {
    const p = parseFileName('Chapter 1.2 Slides.pdf');
    const num = p.tokens.find((t) => t.kind === 'number');
    expect(num?.value).toBeCloseTo(1.2);
  });

  it('tolerates empty and extension-only names', () => {
    expect(parseFileName('').tokens).toHaveLength(0);
    expect(parseFileName('.pdf').tokens).toHaveLength(0);
  });
});

describe('rearrange: signatureFor', () => {
  it('drops presentation noise words', () => {
    const stem = 'Basic Maths and Calculus 13 Class Notes';
    expect(signatureFor(stem, 25, 27)).toBe('basic calculus maths');
  });

  it('is independent of word order', () => {
    const a = parseFileName('Physics Part 3.pdf');
    const b = parseFileName('Part 3 Physics.pdf');
    const ta = a.tokens.find((t) => t.kind === 'number');
    const tb = b.tokens.find((t) => t.kind === 'number');
    expect(ta && tb).toBeTruthy();
    expect(signatureFor(a.stem, ta!.start, ta!.end)).toBe(signatureFor(b.stem, tb!.start, tb!.end));
  });

  it('falls back to noise words when nothing else remains', () => {
    expect(signatureFor('Class Notes 1', 12, 13)).toBe('class notes');
    expect(signatureFor('Lecture 02', 8, 10)).toBe('lecture');
  });

  it('returns empty string when no words remain', () => {
    expect(signatureFor('123', 0, 3)).toBe('');
  });
});

describe('rearrange: planSmartOrder', () => {
  it('sorts the 13-part calculus series naturally', () => {
    const input = [13, 3, 1, 7, 2].map((i) =>
      item(`c${i}`, `Basic Maths and Calculus ${i} Class Notes.pdf`),
    );
    const plan = planSmartOrder(input);
    expect(plan.changed).toBe(true);
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0].memberIds).toHaveLength(5);
    expect(names(plan.orderedItems)).toEqual([
      'Basic Maths and Calculus 1 Class Notes.pdf',
      'Basic Maths and Calculus 2 Class Notes.pdf',
      'Basic Maths and Calculus 3 Class Notes.pdf',
      'Basic Maths and Calculus 7 Class Notes.pdf',
      'Basic Maths and Calculus 13 Class Notes.pdf',
    ]);
  });

  it('keeps standalone files in their relative positions', () => {
    const input = [
      item('a', 'Random Syllabus.pdf'),
      item('c3', 'Basic Maths and Calculus 3 Class Notes.pdf'),
      item('b', 'Physics Formula Book.pdf'),
      item('c1', 'Basic Maths and Calculus 1 Class Notes.pdf'),
      item('c2', 'Basic Maths and Calculus 2 Class Notes.pdf'),
    ];
    const plan = planSmartOrder(input);
    expect(names(plan.orderedItems)).toEqual([
      'Random Syllabus.pdf',
      'Basic Maths and Calculus 1 Class Notes.pdf',
      'Basic Maths and Calculus 2 Class Notes.pdf',
      'Basic Maths and Calculus 3 Class Notes.pdf',
      'Physics Formula Book.pdf',
    ]);
  });

  it('reports no change for already-sorted input', () => {
    const input = Array.from({ length: 13 }, (_, k) =>
      item(`c${k + 1}`, `Basic Maths and Calculus ${k + 1} Class Notes.pdf`),
    );
    const plan = planSmartOrder(input);
    expect(plan.changed).toBe(false);
    expect(ids(plan.orderedItems)).toEqual(ids(input));
    expect(plan.groups).toHaveLength(1);
  });

  it('groups roman-numeral series', () => {
    const input = [item('r2', 'Algebra II.pdf'), item('r1', 'Algebra I.pdf'), item('r3', 'Algebra III.pdf')];
    const plan = planSmartOrder(input);
    expect(names(plan.orderedItems)).toEqual(['Algebra I.pdf', 'Algebra II.pdf', 'Algebra III.pdf']);
  });

  it('groups ordinal series', () => {
    const input = [item('o21', '21st Lecture.pdf'), item('o3', '3rd Lecture.pdf'), item('o2', '2nd Lecture.pdf')];
    const plan = planSmartOrder(input);
    expect(names(plan.orderedItems)).toEqual(['2nd Lecture.pdf', '3rd Lecture.pdf', '21st Lecture.pdf']);
  });

  it('groups zero-padded lecture numbers', () => {
    const input = [item('l2', 'Lecture 02.pdf'), item('l10', 'Lecture 10.pdf'), item('l7', 'Lecture 007.pdf')];
    const plan = planSmartOrder(input);
    expect(names(plan.orderedItems)).toEqual(['Lecture 02.pdf', 'Lecture 007.pdf', 'Lecture 10.pdf']);
  });

  it('groups marker-based names (Part N)', () => {
    const input = [item('p3', 'Mechanics Part 3.pdf'), item('p1', 'Mechanics Part 1.pdf'), item('p2', 'Mechanics Part 2.pdf')];
    const plan = planSmartOrder(input);
    expect(names(plan.orderedItems)).toEqual([
      'Mechanics Part 1.pdf',
      'Mechanics Part 2.pdf',
      'Mechanics Part 3.pdf',
    ]);
  });

  it('does not treat calendar years as series indices', () => {
    const input = [item('y24', 'Notes 2024.pdf'), item('y23', 'Notes 2023.pdf'), item('y22', 'Notes 2022.pdf')];
    const plan = planSmartOrder(input);
    expect(plan.groups).toHaveLength(0);
    expect(plan.changed).toBe(false);
    expect(ids(plan.orderedItems)).toEqual(ids(input));
  });

  it('needs at least MIN_SERIES_SIZE members to form a series', () => {
    expect(MIN_SERIES_SIZE).toBe(2);
    const input = [item('s1', 'Optics Summary 1.pdf'), item('x', 'Unrelated File.pdf')];
    const plan = planSmartOrder(input);
    expect(plan.groups).toHaveLength(0);
    expect(plan.changed).toBe(false);
  });

  it('is stable for identical names', () => {
    const input = [item('i1', 'Same Name.pdf'), item('i2', 'Same Name.pdf'), item('i3', 'Same Name.pdf')];
    const plan = planSmartOrder(input);
    expect(ids(plan.orderedItems)).toEqual(['i1', 'i2', 'i3']);
  });

  it('handles empty and single-item input safely', () => {
    expect(planSmartOrder([]).changed).toBe(false);
    const single = planSmartOrder([item('only', 'Solo.pdf')]);
    expect(single.changed).toBe(false);
    expect(single.orderedIds).toEqual(['only']);
  });

  it('does not mutate the input array', () => {
    const input = [item('b', 'Series 2.pdf'), item('a', 'Series 1.pdf')];
    const snapshot = ids(input);
    planSmartOrder(input);
    expect(ids(input)).toEqual(snapshot);
  });

  it('handles a large batch quickly (performance smoke)', () => {
    const big: RearrangeableItem[] = [];
    for (let s = 0; s < 25; s += 1) {
      for (let i = 20; i >= 1; i -= 1) {
        big.push(item(`s${s}-${i}`, `Subject ${s} Class Notes ${i}.pdf`));
      }
    }
    const start = performance.now();
    const plan = planSmartOrder(big);
    const elapsed = performance.now() - start;
    expect(plan.groups.length).toBe(25);
    expect(elapsed).toBeLessThan(500);
    // every series must come out ascending
    for (const g of plan.groups) {
      const values = g.memberIds.map((id) => Number(id.split('-')[1]));
      expect(values).toEqual([...values].sort((a, b) => a - b));
    }
  });
});
