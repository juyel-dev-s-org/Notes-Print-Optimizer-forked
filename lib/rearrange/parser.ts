/**
 * Smart PDF Rearrangement - file name parser.
 *
 * Single-pass tokenizer that converts a PDF file name into an ordered stream
 * of text / number / ordinal / roman tokens with character offsets. The rule
 * engine consumes these tokens to locate series-index candidates.
 *
 * Design constraints: zero dependencies, no locale-sensitive APIs, O(name)
 * per file, allocations limited to the token array.
 */

import type { FileNameToken, ParsedFileName } from './types';

/** Trailing file extension (".pdf", ".PDF", ...). */
const EXTENSION_RE = /\.[a-z0-9]{1,10}$/i;

/** Characters accepted as letters (ASCII + Latin Extended). */
const LETTER_RE = /[A-Za-z\u00C0-\u024F]/;

const ROMAN_RE = /^[IVXLCDM]+$/;
const ROMAN_VALUES: Record<string, number> = {
  I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000,
};

const ROMAN_TABLE: Array<[number, string]> = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

/** Encode 1..3999 as a canonical roman numeral (validation helper). */
export function numberToRoman(value: number): string {
  let rest = value;
  let out = '';
  for (const [numeral, glyph] of ROMAN_TABLE) {
    while (rest >= numeral) {
      out += glyph;
      rest -= numeral;
    }
  }
  return out;
}

/**
 * Convert a roman numeral string to an integer.
 * Returns -1 for anything that is not a canonical roman numeral (1..3999),
 * which keeps ordinary words ("civil", "mix") out of the index pool.
 */
export function romanToNumber(raw: string): number {
  const s = raw.toUpperCase();
  if (!ROMAN_RE.test(s)) return -1;
  let total = 0;
  for (let i = 0; i < s.length; i += 1) {
    const value = ROMAN_VALUES[s[i]];
    const next = i + 1 < s.length ? ROMAN_VALUES[s[i + 1]] : 0;
    total += value < next ? -value : value;
  }
  if (total < 1 || total > 3999) return -1;
  return numberToRoman(total) === s ? total : -1;
}

/** Strip the trailing extension ("Class Notes.pdf" -> "Class Notes"). */
export function stripExtension(fileName: string): string {
  return fileName.replace(EXTENSION_RE, '');
}

/**
 * Tokenize a file name into an ordered token stream.
 * Offsets refer to the extension-stripped stem.
 */
export function parseFileName(rawName: string): ParsedFileName {
  const stem = stripExtension(String(rawName ?? '').trim());
  const tokens: FileNameToken[] = [];
  const n = stem.length;
  let i = 0;

  while (i < n) {
    const ch = stem[i];

    if (ch >= '0' && ch <= '9') {
      // Numeric run, optionally with one decimal point ("1.2").
      let j = i + 1;
      let sawDot = false;
      while (j < n) {
        const c = stem[j];
        if (c >= '0' && c <= '9') { j += 1; continue; }
        if (c === '.' && !sawDot && j + 1 < n && stem[j + 1] >= '0' && stem[j + 1] <= '9') {
          sawDot = true; j += 1; continue;
        }
        break;
      }

      // Ordinal suffix ("3rd", "21st") - integer runs of <= 3 digits only,
      // and only when not glued to a following word ("3rdparty").
      let end = j;
      if (!sawDot && j - i <= 3 && j + 2 <= n) {
        const suffix = stem.slice(j, j + 2).toLowerCase();
        const after = j + 2 < n ? stem[j + 2] : '';
        const isOrdinal = suffix === 'st' || suffix === 'nd' || suffix === 'rd' || suffix === 'th';
        if (isOrdinal && !LETTER_RE.test(after)) end = j + 2;
      }

      const rawTok = stem.slice(i, end);
      if (end > j) {
        tokens.push({ kind: 'ordinal', raw: rawTok, value: parseInt(rawTok, 10), start: i, end });
      } else {
        tokens.push({ kind: 'number', raw: rawTok, value: parseFloat(rawTok), start: i, end });
      }
      i = end;
      continue;
    }

    if (LETTER_RE.test(ch)) {
      let j = i + 1;
      while (j < n && LETTER_RE.test(stem[j])) j += 1;
      const word = stem.slice(i, j);
      const roman = romanToNumber(word);
      if (roman !== -1) {
        tokens.push({ kind: 'roman', raw: word, value: roman, start: i, end: j });
      } else {
        tokens.push({ kind: 'text', raw: word, start: i, end: j });
      }
      i = j;
      continue;
    }

    i += 1; // separators / punctuation are skipped (offsets stay accurate)
  }

  return { raw: rawName, stem, tokens };
}
