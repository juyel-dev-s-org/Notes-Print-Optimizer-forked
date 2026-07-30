import {
  processPage,
  calculateInkCoverage,
} from './kernels';
import type { WorkerRequest, WorkerResponse } from './protocol';

let cancelled = false;

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === 'TERMINATE') { (self as any).close(); return; }
  if (msg.type === 'CANCEL') { cancelled = true; return; }
  if (msg.type !== 'PROCESS_PAGE') return;

  cancelled = false;

  try {
    const srcData = new Uint8ClampedArray(msg.buffer);
    const inkBefore = calculateInkCoverage(srcData);
    const result = processPage(srcData, msg.width, msg.height, msg.params, msg.profile);
    if (cancelled) return;
    const outData = new Uint8ClampedArray(result.buffer);
    const inkAfter = calculateInkCoverage(outData);

    const response: WorkerResponse = {
      type: 'PAGE_PROCESSED',
      pageIndex: msg.pageIndex,
      buffer: result.buffer,
      width: result.width,
      height: result.height,
      inkCoverageBeforePct: inkBefore,
      inkCoverageAfterPct: inkAfter,
    };
    (self as any).postMessage(response, [result.buffer]);
  } catch (err) {
    if (cancelled) return;
    const response: WorkerResponse = {
      type: 'PAGE_ERROR',
      pageIndex: msg.pageIndex,
      error: String(err),
    };
    (self as any).postMessage(response);
  }
};