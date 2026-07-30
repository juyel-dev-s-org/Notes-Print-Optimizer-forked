import { processPage, calculateInkCoverage, setWasmKernelsHooks } from '../kernels';
import { ensureWasmKernels } from '../wasm/loader';
import type { WorkerRequest, WorkerResponse } from './protocol';

let initialized = false;
let wasmLoaded = false;

async function ensureInit(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    const kernels = await ensureWasmKernels();
    setWasmKernelsHooks(kernels);
    wasmLoaded = true;
  } catch {
    wasmLoaded = false;
  }
}

const MAX_BUFFERED_PAGES = 3;
type BufferItem = { pageIndex: number; buffer: ArrayBuffer; width: number; height: number; inkBefore: number; inkAfter: number };
const bufferedPages: BufferItem[] = [];
let bufferHead = 0;

function pushBuffer(item: BufferItem): void {
  if (bufferedPages.length < MAX_BUFFERED_PAGES) {
    bufferedPages.push(item);
  } else {
    bufferedPages[bufferHead % MAX_BUFFERED_PAGES] = item;
  }
  bufferHead++;
}

function tryPopBuffer(): BufferItem | null {
  if (bufferedPages.length === 0) return null;
  const oldest = bufferedPages.shift()!;
  if (bufferHead > 0) bufferHead--;
  return oldest;
}

function getBufferCount(): number {
  return bufferedPages.length;
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
      const inkBefore = calculateInkCoverage(srcData);
      const inkAfter = calculateInkCoverage(new Uint8ClampedArray(result.buffer));

      pushBuffer({
        pageIndex: task.pageIndex,
        buffer: result.buffer,
        width: result.width,
        height: result.height,
        inkBefore,
        inkAfter,
      });

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
      (self as any).postMessage(response, [result.buffer]);
    } catch (err: any) {
      (self as any).postMessage({ type: 'ERROR', taskId: task.taskId, error: err?.message ?? String(err) } satisfies WorkerResponse);
    }
    return;
  }

  if (msg.type === 'GET_BUFFER_STATS') {
    (self as any).postMessage({
      type: 'BUFFER_STATS',
      bufferedCount: getBufferCount(),
      maxBuffered: MAX_BUFFERED_PAGES,
    } satisfies WorkerResponse);
    return;
  }

  if (msg.type === 'CANCEL') {
    return;
  }
};
