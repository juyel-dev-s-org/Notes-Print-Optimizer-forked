/**
 * pixel.worker - Web Worker for pixel processing.
 *
 * Production optimizations:
 *  - Removed dead bufferedPages array (was never consumed, leaked memory)
 *  - Direct postMessage with transferable buffer (zero-copy to main thread)
 *  - Lazy WASM initialization (only on first task)
 */
import { processPage, calculateInkCoverage, setWasmKernelsHooks } from '../kernels';
import { ensureWasmKernels } from '../wasm/loader';
import type { WorkerRequest, WorkerResponse } from './protocol';

let initialized = false;

async function ensureInit(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    const kernels = await ensureWasmKernels();
    setWasmKernelsHooks(kernels);
  } catch {
    /* WASM not available, JS fallback will be used */
  }
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;

  if (msg.type === 'PING') {
    (self as any).postMessage({ type: 'PONG' } satisfies WorkerResponse);
    return;
  }

  if (msg.type === 'TERMINATE') {
    self.close();
    return;
  }

  if (msg.type === 'PROCESS_PIXEL') {
    const { task } = msg;
    try {
      await ensureInit();
      const srcData = new Uint8ClampedArray(task.buffer);
      const result = processPage(srcData, task.width, task.height, task.params, task.profile);

      /* Zero-copy ink coverage on raw buffers */
      const inkBefore = calculateInkCoverage(srcData);
      const inkAfter = calculateInkCoverage(result.buffer);

      const response: WorkerResponse = {
        type: 'PIXEL_PROCESSED',
        taskId: task.taskId,
        pageIndex: task.pageIndex,
        buffer: result.buffer,
        width: result.width,
        height: result.height,
        inkBefore,
        inkAfter,
      };
      /* Transfer buffer ownership to main thread (zero-copy) */
      (self as any).postMessage(response, [result.buffer]);
    } catch (err: any) {
      (self as any).postMessage({ type: 'ERROR', taskId: task.taskId, error: err?.message ?? String(err) } satisfies WorkerResponse);
    }
    return;
  }

  if (msg.type === 'GET_BUFFER_STATS') {
    (self as any).postMessage({
      type: 'BUFFER_STATS',
      bufferedCount: 0,
      maxBuffered: 0,
    } satisfies WorkerResponse);
    return;
  }

  if (msg.type === 'CANCEL') {
    return;
  }
};
