import { describe, it, expect, beforeEach, afterEach } from 'vitest';

function makeWorker(): any {
  const w: any = {
    postMessage: (msg: any) => { w._lastMsg = msg; w._lastTaskId = msg?.task?.taskId; },
    terminate: () => { w._terminated = true; },
    _terminated: false,
    _lastMsg: null,
    _lastTaskId: null,
    _triggerError: () => { if (w.onerror) w.onerror(new ErrorEvent('error')); },
    _triggerMessage: (data: any) => { if (w.onmessage) w.onmessage({ data }); },
  };
  return w;
}

describe('Phase 8.6: Worker crash recovery', () => {
  let pool: any;
  let workers: any[];
  let factory: any;

  beforeEach(async () => {
    workers = [];
    factory = () => {
      const w = makeWorker();
      workers.push(w);
      return w;
    };
    const { WorkerPool } = await import('../../lib/workers/pool');
    pool = new WorkerPool(factory);
  });

  afterEach(() => {
    if (pool) pool.destroy();
  });

  it('should process a task successfully', async () => {
    const task = pool.submitPixelTask({
      pageIndex: 1, buffer: new ArrayBuffer(100), width: 10, height: 10,
      params: { invertMode: 'none', sharpenAmount: 0 },
      profile: { classification: 'LIGHT_SLIDE', darkBackgroundRatio: 0 },
    }, 5000);
    const worker = workers[0];
    const taskId = worker._lastTaskId;
    if (taskId) {
      worker._triggerMessage({
        type: 'PIXEL_PROCESSED', taskId,
        pageIndex: 1, buffer: new ArrayBuffer(100),
        width: 10, height: 10, inkBefore: 5, inkAfter: 2,
      });
    }
    const result = await task;
    expect(result.pageIndex).toBe(1);
  });

  it('should reject if all retries exhausted', async () => {
    const { WorkerPool } = await import('../../lib/workers/pool');
    const crashFactory = () => {
      const w = makeWorker();
      setTimeout(() => w._triggerError(), 5);
      return w;
    };
    const failPool = new WorkerPool(crashFactory);
    try {
      const promise = failPool.submitPixelTask({
        pageIndex: 1, buffer: new ArrayBuffer(100), width: 10, height: 10,
        params: { invertMode: 'none', sharpenAmount: 0 },
        profile: { classification: 'LIGHT_SLIDE', darkBackgroundRatio: 0 },
      }, 5000);
      await expect(promise).rejects.toThrow('Worker crashed');
    } finally {
      failPool.destroy();
    }
  });
});
