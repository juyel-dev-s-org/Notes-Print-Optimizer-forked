/**
 * Side-effect handlers for menu actions that mutate app/browser state.
 * Kept separate from the config so `menu.config.ts` stays pure data.
 */

/**
 * Best-effort privacy action: clear service-worker caches, the optimizer's
 * IndexedDB cache and any tracked blob URLs. Heavy modules are imported
 * lazily so the drawer itself stays cheap.
 */
export async function clearAppCaches(): Promise<string> {
  let clearedCaches = 0;

  // 1. Browser Cache Storage (service worker / static caches)
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
      clearedCaches = keys.length;
    }
  } catch { /* non-fatal */ }

  // 2. Optimizer IndexedDB cache + tracked blob URLs (lazy, decoupled)
  try {
    const { pwOptimizerStorage } = await import('../optimizer/storage');
    pwOptimizerStorage.clearCache();
  } catch { /* non-fatal */ }
  try {
    const { memoryManager } = await import('../optimizer/memoryManager');
    memoryManager.revokeAllBlobUrls();
  } catch { /* non-fatal */ }

  // 3. In-memory markdown cache used by the drawer
  try {
    const { clearContentCache } = await import('./contentLoader');
    clearContentCache();
  } catch { /* non-fatal */ }

  return clearedCaches > 0
    ? `Cleared ${clearedCaches} cache${clearedCaches === 1 ? '' : 's'}.`
    : 'Cache cleared.';
}
