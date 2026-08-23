/**
 * Shared page-range validation used by any tool that slices documents.
 */

export interface PageWindow {
  /** 1-based inclusive. */
  start: number;
  /** 1-based inclusive. */
  end: number;
}

/**
 * Validates the selected page window. Returns 1-based inclusive bounds or
 * null when the selection is incomplete/invalid (CTA stays disabled).
 */
export function resolveRange(
  mode: 'all' | 'custom',
  from: string,
  to: string,
  pageCount: number | null,
): PageWindow | null {
  if (!pageCount || pageCount <= 0) return null;
  if (mode === 'all') return { start: 1, end: pageCount };
  const f = Number.parseInt(from, 10);
  const t = Number.parseInt(to, 10);
  if (!Number.isFinite(f) || !Number.isFinite(t)) return null;
  if (f < 1 || t < 1 || f > t || t > pageCount) return null;
  return { start: f, end: t };
}
