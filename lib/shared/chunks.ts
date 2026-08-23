/**
 * Page-chunk planner for "split every N pages" mode.
 * Pure math shared by the live preview and the splitting engine so the
 * promise shown to the user is exactly what gets executed.
 */

export interface PageChunk {
  /** 1-based inclusive. */
  start: number;
  end: number;
}

/** Splits 1..pageCount into consecutive windows of `perFile` pages each. */
export function planChunks(pageCount: number, perFile: number): PageChunk[] {
  if (!Number.isFinite(pageCount) || pageCount <= 0) return [];
  const size = Math.floor(perFile);
  if (!Number.isFinite(size) || size < 1) return [];
  const chunks: PageChunk[] = [];
  for (let start = 1; start <= pageCount; start += size) {
    chunks.push({ start, end: Math.min(start + size - 1, pageCount) });
  }
  return chunks;
}

/**
 * Divides 1..pageCount into exactly `parts` consecutive windows, spreading
 * the remainder across the leading parts (23÷4 → 6·6·6·5). Requesting more
 * parts than pages caps at one page per part.
 */
export function planEvenChunks(pageCount: number, parts: number): PageChunk[] {
  if (!Number.isFinite(pageCount) || pageCount <= 0) return [];
  const requested = Math.floor(parts);
  if (!Number.isFinite(requested) || requested < 1) return [];
  const n = Math.min(requested, pageCount);
  const base = Math.floor(pageCount / n);
  const remainder = pageCount % n;

  const chunks: PageChunk[] = [];
  let start = 1;
  for (let i = 0; i < n; i++) {
    const size = base + (i < remainder ? 1 : 0);
    chunks.push({ start, end: start + size - 1 });
    start += size;
  }
  return chunks;
}
