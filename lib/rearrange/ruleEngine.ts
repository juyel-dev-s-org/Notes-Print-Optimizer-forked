/**
 * Smart PDF Rearrangement - rule engine.
 *
 * Detects related PDF file series ("Basic Maths and Calculus 1..13 Class
 * Notes") and produces a suggested order:
 *
 *  1. Parse every name into tokens (parser).
 *  2. For each numeric/ordinal/roman token, derive the series signature that
 *     would result if that token were the volume index (normalizer).
 *  3. Score candidates by group size; a file joins the largest series it can
 *     belong to (minimum MIN_SERIES_SIZE members). Ties prefer indices near
 *     the end of the name ("Subject 3 Class Notes"), then right-most tokens.
 *  4. Emit: series members are gathered at the position of their earliest
 *     occurrence and sorted by index; all other files keep their relative
 *     order. Deterministic, stable and O(n log n).
 */

import { parseFileName } from './parser';
import { signatureFor, titleCase } from './normalizer';
import { naturalCompare } from './sorter';
import type {
  ParsedFileName,
  RearrangePlan,
  RearrangeableItem,
  SeriesCandidate,
  SeriesGroup,
} from './types';

/** Minimum number of members before a signature counts as a series. */
export const MIN_SERIES_SIZE = 2;

/** Plausible volume/part range - huge numbers are ids, not indices. */
const MAX_INDEX_VALUE = 10000;

/** Calendar years are metadata, not episode numbers. */
const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

/** Everything after a trailing index token must be punctuation/whitespace. */
const TRAILING_RE = /^[^A-Za-z0-9\u00C0-\u024F]*$/;

interface InternalGroup {
  signature: string;
  members: Array<{ itemIndex: number; value: number }>;
  firstIndex: number;
}

/** True when no letter/digit follows the token end. */
function isTrailing(stem: string, tokenEnd: number): boolean {
  return TRAILING_RE.test(stem.slice(tokenEnd));
}

/** Collect series-index candidates for one parsed name. */
function candidatesFor(parsed: ParsedFileName): SeriesCandidate[] {
  const out: SeriesCandidate[] = [];
  for (const token of parsed.tokens) {
    if (token.kind === 'text' || token.value === undefined) continue;
    const value = token.value;
    if (!Number.isFinite(value) || value <= 0 || value > MAX_INDEX_VALUE) continue;
    if (value >= YEAR_MIN && value <= YEAR_MAX) continue;
    const signature = signatureFor(parsed.stem, token.start, token.end);
    if (!signature) continue;
    out.push({
      signature,
      value,
      trailing: isTrailing(parsed.stem, token.end),
      start: token.start,
      span: token.end - token.start,
    });
  }
  return out;
}

/**
 * Plan the smart ordering for a list of uploaded PDFs.
 * Pure function: the input array is never mutated.
 */
export function planSmartOrder<T extends RearrangeableItem>(items: T[]): RearrangePlan<T> {
  const n = items.length;
  if (n === 0) {
    return { orderedItems: [], orderedIds: [], groups: [], changed: false };
  }
  if (n === 1) {
    return { orderedItems: [items[0]], orderedIds: [items[0].id], groups: [], changed: false };
  }

  const parsed = items.map((item) => parseFileName(item.name));
  const candidates = parsed.map((p) => candidatesFor(p));

  // Signature -> how many files could possibly belong to it.
  const signatureCounts = new Map<string, number>();
  for (const list of candidates) {
    const seen = new Set<string>();
    for (const c of list) {
      if (seen.has(c.signature)) continue;
      seen.add(c.signature);
      signatureCounts.set(c.signature, (signatureCounts.get(c.signature) ?? 0) + 1);
    }
  }

  // Assign each file to its strongest candidate.
  const chosen = new Array<SeriesCandidate | null>(n).fill(null);
  for (let i = 0; i < n; i += 1) {
    let best: SeriesCandidate | null = null;
    for (const c of candidates[i]) {
      const size = signatureCounts.get(c.signature) ?? 0;
      if (size < MIN_SERIES_SIZE) continue;
      if (!best) { best = c; continue; }
      const bestSize = signatureCounts.get(best.signature) ?? 0;
      if (size > bestSize) { best = c; continue; }
      if (size === bestSize) {
        if (c.trailing && !best.trailing) { best = c; continue; }
        if (c.trailing === best.trailing && c.start > best.start) { best = c; }
      }
    }
    chosen[i] = best;
  }

  // Build groups from the assignments.
  const groupMap = new Map<string, InternalGroup>();
  for (let i = 0; i < n; i += 1) {
    const c = chosen[i];
    if (!c) continue;
    let group = groupMap.get(c.signature);
    if (!group) {
      group = { signature: c.signature, members: [], firstIndex: i };
      groupMap.set(c.signature, group);
    }
    group.members.push({ itemIndex: i, value: c.value });
    if (i < group.firstIndex) group.firstIndex = i;
  }
  for (const [signature, group] of Array.from(groupMap.entries())) {
    if (group.members.length < MIN_SERIES_SIZE) groupMap.delete(signature);
  }

  // Sort members inside each group: index asc, then name, then input order.
  for (const group of groupMap.values()) {
    group.members.sort((a, b) => {
      if (a.value !== b.value) return a.value - b.value;
      const byName = naturalCompare(items[a.itemIndex].name, items[b.itemIndex].name);
      if (byName !== 0) return byName;
      return a.itemIndex - b.itemIndex;
    });
  }

  // Emit the final order (series gathered at their earliest occurrence).
  const emitted = new Set<string>();
  const itemGroup = new Array<string | null>(n).fill(null);
  for (const [signature, group] of groupMap.entries()) {
    for (const m of group.members) itemGroup[m.itemIndex] = signature;
  }

  const orderedItems: T[] = [];
  const groups: SeriesGroup[] = [];
  for (let i = 0; i < n; i += 1) {
    const signature = itemGroup[i];
    if (!signature) {
      orderedItems.push(items[i]);
      continue;
    }
    if (emitted.has(signature)) continue;
    emitted.add(signature);
    const group = groupMap.get(signature)!;
    const memberIds: string[] = [];
    for (const m of group.members) {
      orderedItems.push(items[m.itemIndex]);
      memberIds.push(items[m.itemIndex].id);
    }
    groups.push({ signature, title: titleCase(signature), memberIds });
  }

  const orderedIds = orderedItems.map((item) => item.id);
  let changed = false;
  for (let i = 0; i < n; i += 1) {
    if (orderedIds[i] !== items[i].id) { changed = true; break; }
  }

  return { orderedItems, orderedIds, groups, changed };
}
