import { WorkerManager } from './WorkerManager';
import type { WorkerType } from './protocol';

const wm = WorkerManager.getInstance();

/**
 * Webpack emits + bundles workers only when the `new Worker(new URL(<literal>, import.meta.url))`
 * pattern is statically analyzable. The URL modules must use literal paths —
 * dynamic template URLs would not be bundled and would 404 at runtime.
 */
function createWorker(type: WorkerType): Worker | null {
  try {
    if (type === 'pixel') {
      return new Worker(new URL('./pixel.worker.ts', import.meta.url), { type: 'module' });
    }
    if (type === 'compose') {
      return new Worker(new URL('./compose.worker.ts', import.meta.url), { type: 'module' });
    }
    return null;
  } catch {
    return null;
  }
}

try {
  if (typeof URL !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.url) {
    wm.registerWorkerFactory(createWorker);
  }
} catch {
  /* worker URLs not available in this environment */
}
