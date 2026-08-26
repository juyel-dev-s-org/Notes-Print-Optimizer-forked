/**
 * pixel.worker - Web Worker for pixel processing.
 *
 * Production optimizations:
 *  - Removed dead bufferedPages array (was never consumed, leaked memory)
 *  - Direct postMessage with transferable buffer (zero-copy to main thread)
 *  - Lazy WASM initialization (only on first task)
 */
import { calculateInkCoverage, setWasmKernelsHooks } from '../kernels';
import { processPageWithWhiteBoxHeal } from '../kernels/whiteBox';
import { ensureWasmKernels } from '../wasm/loader';
import type { WorkerRequest, WorkerResponse } from './protocol';

const workerSelf = self as unknown as DedicatedWorkerGlobalScope;
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

workerSelf.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;

  if (msg.type === 'PING') {
    workerSelf.postMessage({ type: 'PONG' } satisfies WorkerResponse);
    return;
  }

  if (msg.type === 'TERMINATE') {
    workerSelf.close();
    return;
  }

  if (msg.type === 'PROCESS_PIXEL') {
    const { task } = msg;
    try {
      await ensureInit();
      const srcData = new Uint8ClampedArray(task.buffer);
      /* Kernel process + auto white-box heal (dark pages). Regions travel
         with the result for UI badges / future manual editor. */
      const healed = processPageWithWhiteBoxHeal(srcData, task.width, task.height, task.params, task.profile);
      const result = { buffer: healed.buffer, width: healed.width, height: healed.height };

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
        whiteBoxRegions: healed.whiteBoxRegions,
      };
      /* Transfer buffer ownership to main thread (zero-copy) */
      workerSelf.postMessage(response, [result.buffer]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      workerSelf.postMessage({ type: 'ERROR', taskId: task.taskId, error: message } satisfies WorkerResponse);
    }
    return;
  }

  if (msg.type === 'GET_BUFFER_STATS') {
    workerSelf.postMessage({
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
