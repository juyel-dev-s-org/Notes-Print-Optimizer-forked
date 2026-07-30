/**
 * Shared PDF.js singleton loader (M-1).
 *
 * Replaces CDN script-tag injection with bundled pdfjs-dist@4.10.38.
 * Uses dynamic import() for SSR safety — never top-level.
 * Worker is served from the app origin via webpack asset URL.
 *
 * Usage:
 *   const pdfjsLib = await getPdfjsLib();
 *   const doc = await pdfjsLib.getDocument({ data }).promise;
 */

type PdfjsModule = typeof import('pdfjs-dist');

let cached: PdfjsModule | null = null;
let pending: Promise<PdfjsModule> | null = null;

/**
 * Returns the pdfjs-dist module, initializing it exactly once.
 * Concurrent callers share the same in-flight promise (singleton).
 */
export async function getPdfjsLib(): Promise<PdfjsModule> {
  if (cached) return cached;
  if (pending) return pending;

  pending = (async () => {
    try {
      const pdfjsLib = await import('pdfjs-dist');

      /* Configure worker — use CDN since static export can't serve it locally */
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

      cached = pdfjsLib;
      return pdfjsLib;
    } catch (err) {
      /* Reset so a subsequent call can retry after transient failure */
      pending = null;
      throw new Error(
        `PDF.js failed to load: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  })();

  return pending;
}
