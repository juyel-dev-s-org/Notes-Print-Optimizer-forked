import { WorkerManager } from './WorkerManager';

const wm = WorkerManager.getInstance();

function registerWorker(type: 'pixel' | 'compose' | 'render'): void {
  try {
    const ext = import.meta.url?.endsWith('.ts') ? '.ts' : '.js';
    const url = new URL(`./${type}.worker${ext}`, import.meta.url).href;
    wm.registerWorkerUrl(type, url);
  } catch { /* worker not available */ }
}

try {
  if (typeof URL !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.url) {
    registerWorker('pixel');
    registerWorker('compose');
    registerWorker('render');
  }
} catch {
  /* workers not supported in this environment */
}
