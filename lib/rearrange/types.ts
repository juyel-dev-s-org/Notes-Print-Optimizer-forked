/**
 * Smart PDF Rearrangement - shared types.
 *
 * Pure type module: no runtime dependencies, safe for tests and workers.
 */

/** A single lexical token extracted from a PDF file name. */
export interface FileNameToken {
  /** Token kind: plain text, numeric index candidate, ordinal or roman numeral. */
  kind: 'text' | 'number' | 'ordinal' | 'roman';
  /** Exact raw substring as it appears in the file name. */
  raw: string;
  /** Numeric value for number/ordinal/roman tokens (undefined for text). */
  value?: number;
  /** Inclusive start offset inside the (extension-stripped) file name. */
  start: number;
  /** Exclusive end offset inside the (extension-stripped) file name. */
  end: number;
}

/** Result of parsing one file name. */
export interface ParsedFileName {
  /** Original full file name including extension. */
  raw: string;
  /** File name without trailing extension. */
  stem: string;
  /** Ordered token stream covering the stem. */
  tokens: FileNameToken[];
}

/** One (file -> series) assignment candidate produced by the parser. */
export interface SeriesCandidate {
  /** Normalized signature shared by all members of the series. */
  signature: string;
  /** Detected volume/part number. */
  value: number;
  /** True when the index token sits at (or very near) the end of the name. */
  trailing: boolean;
  /** Start offset of the index token (right-most wins tie-breaks). */
  start: number;
  /** Character span of the index token. */
  span: number;
}

/** A detected series group (>= MIN_SERIES_SIZE members). */
export interface SeriesGroup {
  /** Normalized signature key. */
  signature: string;
  /** Human-readable series title (title-cased signature). */
  title: string;
  /** Item ids in ascending series order. */
  memberIds: string[];
}

/** Minimal item shape required by the rearrangement engine. */
export interface RearrangeableItem {
  id: string;
  name: string;
}

/** Full output of the rule engine. */
export interface RearrangePlan<T extends RearrangeableItem = RearrangeableItem> {
  /** Items in the suggested order (new array; originals untouched). */
  orderedItems: T[];
  /** Ordered ids (kept separate for cheap diffing). */
  orderedIds: string[];
  /** Detected series, in the order they appear in the output. */
  groups: SeriesGroup[];
  /** True when the suggested order differs from the input order. */
  changed: boolean;
}
