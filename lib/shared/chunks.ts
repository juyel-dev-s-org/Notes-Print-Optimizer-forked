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
