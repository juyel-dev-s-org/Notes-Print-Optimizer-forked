/**
 * Side-effect handlers for menu actions that mutate app/browser state.
 * Kept separate from the config so `menu.config.ts` stays pure data.
 */

/**
 * Best-effort privacy action: clear service-worker caches, the optimizer's
 * IndexedDB cache and any tracked blob URLs. Heavy modules are imported
 * lazily so the drawer itself stays cheap.
 *
 * Returns a result object so callers can distinguish full success from a
 * partial/total failure (every step is best-effort and never throws).
 */
export async function clearAppCaches(): Promise<{ ok: boolean; message: string }> {
  let clearedCaches = 0;
  let failedSteps = 0;
  const TOTAL_STEPS = 4;

  // 1. Browser Cache Storage (service worker / static caches)
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
      clearedCaches = keys.length;
    }
  } catch { failedSteps++; }

  // 2. Optimizer IndexedDB cache + tracked blob URLs (lazy, decoupled)
  try {
    const { pwOptimizerStorage } = await import('../optimizer/storage');
    pwOptimizerStorage.clearCache();
  } catch { failedSteps++; }
  try {
    const { memoryManager } = await import('../optimizer/memoryManager');
    memoryManager.revokeAllBlobUrls();
  } catch { failedSteps++; }

  // 3. In-memory markdown cache used by the drawer
  try {
    const { clearContentCache } = await import('./contentLoader');
    clearContentCache();
  } catch { failedSteps++; }

  const allFailed = failedSteps === TOTAL_STEPS;
  const message = allFailed
    ? 'Could not clear cache - browser storage may be unavailable.'
    : clearedCaches > 0
      ? `Cleared ${clearedCaches} cache${clearedCaches === 1 ? '' : 's'}.`
      : 'Cache cleared.';

  return { ok: !allFailed, message };
}
