import { PageProfile, ProcessingParameters } from './types';
import { WORKER_SCRIPT } from './worker/worker.generated';
import type { WorkerProcessResult, QueuedTask, ProcessingParams } from './worker/protocol';

interface PooledWorker {
  worker: Worker;
  busy: boolean;
  currentTask: QueuedTask | null;
}

class PersistentWorkerPool {
  private workers: PooledWorker[] = [];
  private taskQueue: QueuedTask[] = [];
  private initialized = false;
  private blobUrl: string | null = null;
  private useWorkers: boolean;

  constructor() {
    this.useWorkers = typeof window !== 'undefined' && typeof Worker !== 'undefined';
  }

  private initialize(): void {
    if (this.initialized || !this.useWorkers) return;
    try {
      const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const poolSize = isMobile ? Math.min(2, cores) : Math.min(8, Math.max(1, cores - 1));

      const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
      this.blobUrl = URL.createObjectURL(blob);

      for (let i = 0; i < poolSize; i++) {
        const worker = new Worker(this.blobUrl);
        const pooled: PooledWorker = { worker, busy: false, currentTask: null };
        worker.onmessage = (e: MessageEvent) => this.onMsg(pooled, e);
        worker.onerror = () => this.onErr(pooled);
        this.workers.push(pooled);
      }
      this.initialized = true;
    } catch {
      this.useWorkers = false;
      this.workers = [];
    }
  }

  private onMsg(p: PooledWorker, e: MessageEvent): void {
    const msg = e.data;
    const task = p.currentTask;
    if (!task) return;

    if (msg.type === 'PAGE_PROCESSED') {
      task.resolve({
        pageIndex: msg.pageIndex,
        optimizedImageData: new ImageData(new Uint8ClampedArray(msg.buffer), msg.width, msg.height),
        inkCoverageBeforePct: msg.inkCoverageBeforePct,
        inkCoverageAfterPct: msg.inkCoverageAfterPct,
      });
    } else if (msg.type === 'PAGE_ERROR') {
      task.reject(new Error(msg.error || 'Worker processing failed'));
    }
    p.busy = false;
    p.currentTask = null;
    this.dispatchNext();
  }

  private onErr(p: PooledWorker): void {
    if (p.currentTask) p.currentTask.reject(new Error('Worker error'));
    p.busy = false;
    p.currentTask = null;
    try {
      const idx = this.workers.indexOf(p);
      if (idx !== -1 && this.blobUrl) {
        p.worker.terminate();
        const nw = new Worker(this.blobUrl);
        const np: PooledWorker = { worker: nw, busy: false, currentTask: null };
        nw.onmessage = (e: MessageEvent) => this.onMsg(np, e);
        nw.onerror = () => this.onErr(np);
        this.workers[idx] = np;
      }
    } catch {
      const idx = this.workers.indexOf(p);
      if (idx !== -1) this.workers.splice(idx, 1);
    }
    this.dispatchNext();
  }

  private dispatchNext(): void {
    if (this.taskQueue.length === 0) return;
    const idle = this.workers.find(w => !w.busy);
    if (!idle) return;
    this.send(idle, this.taskQueue.shift()!);
  }

  private send(p: PooledWorker, task: QueuedTask): void {
    p.busy = true;
    p.currentTask = task;
    p.worker.postMessage({
      type: 'PROCESS_PAGE',
      pageIndex: task.pageIndex,
      width: task.width,
      height: task.height,
      buffer: task.buffer,
      params: {
        invertMode: task.params.invertMode,
        bannerCropTopPct: task.params.bannerCropTopPct,
        bannerCropBottomPct: task.params.bannerCropBottomPct,
        strokeEnhancement: task.params.strokeEnhancement,
        sharpenAmount: task.params.sharpenAmount,
      } satisfies ProcessingParams,
      profile: task.profile,
    }, [task.buffer]);
  }

  public async processPage(
    pageIndex: number,
    imageData: ImageData,
    params: ProcessingParameters,
    profile: PageProfile
  ): Promise<WorkerProcessResult> {
    this.initialize();

    if (!this.useWorkers || this.workers.length === 0) {
      throw new Error('No workers available');
    }

    return new Promise((resolve, reject) => {
      const workerBuffer = imageData.data.buffer.slice(0);
      const task: QueuedTask = {
        pageIndex,
        buffer: workerBuffer,
        width: imageData.width, height: imageData.height,
        params, profile, resolve, reject,
      };
      const idle = this.workers.find(w => !w.busy);
      if (idle) this.send(idle, task);
      else this.taskQueue.push(task);
    });
  }

  public cancelTask(pageIndex?: number): void {
    if (pageIndex === undefined) {
      this.taskQueue = [];
      for (const p of this.workers) {
        if (p.busy && p.currentTask) {
          try { p.worker.postMessage({ type: 'CANCEL' }); } catch { /* noop */ }
          p.currentTask.reject(new Error('Cancelled'));
          p.busy = false;
          p.currentTask = null;
        }
      }
      return;
    }
    const queuedIdx = this.taskQueue.findIndex(t => t.pageIndex === pageIndex);
    if (queuedIdx !== -1) {
      const task = this.taskQueue.splice(queuedIdx, 1)[0];
      task.reject(new Error('Cancelled'));
      return;
    }
    for (const p of this.workers) {
      if (p.busy && p.currentTask && p.currentTask.pageIndex === pageIndex) {
        try { p.worker.postMessage({ type: 'CANCEL' }); } catch { /* noop */ }
        p.currentTask.reject(new Error('Cancelled'));
        p.busy = false;
        p.currentTask = null;
        this.dispatchNext();
        return;
      }
    }
  }

  public getStats() {
    return {
      poolSize: this.workers.length,
      busyCount: this.workers.filter(w => w.busy).length,
      queueLength: this.taskQueue.length,
      initialized: this.initialized,
    };
  }

  public destroy(): void {
    for (const p of this.workers) {
      try { p.worker.postMessage({ type: 'TERMINATE' }); p.worker.terminate(); } catch { /* noop */ }
    }
    this.workers = [];
    this.taskQueue = [];
    this.initialized = false;
    if (this.blobUrl) { URL.revokeObjectURL(this.blobUrl); this.blobUrl = null; }
  }
}

export const workerPool = new PersistentWorkerPool();
