/**
 * Shared workflow phase helpers — kept pure and tiny so all three platform
 * UIs (desktop / tablet / mobile) stay in sync.
 */

/** Build the full exclude set (all pages or none) for "Exclude All" toggles. */
export function buildExcludedSet(pageCount: number, exclude: boolean): Set<number> {
  const next = new Set<number>();
  if (exclude) {
    for (let i = 0; i < pageCount; i++) next.add(i);
  }
  return next;
}