import type { WorkerType, WorkerInfo, TaskEntry, WorkerRequest, WorkerResponse, PixelTask, ComposeTask } from './protocol';
import { generateTaskId } from './protocol';

const DEFAULT_TIMEOUT_MS = 30_000;
const HEALTH_CHECK_INTERVAL_MS = 15_000;
const MAX_RETRIES = 2;
const PING_TIMEOUT_MS = 3_000;

export type WorkerFactory = (type: WorkerType) => Worker | null;

export class WorkerPool {
  private workers: WorkerInfo[] = [];
  private taskQueue: TaskEntry[] = [];
  private pending = new Map<string, TaskEntry>();
  private factory: WorkerFactory;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  constructor(factory: WorkerFactory) {
    this.factory = factory;
  }

  private spawnWorker(type: WorkerType): WorkerInfo | null {
    const w = this.factory(type);
    if (!w) return null;

    const info: WorkerInfo = { worker: w, type, busy: false, taskId: null, healthy: true, lastPong: Date.now() };

    w.onmessage = (e: MessageEvent<WorkerResponse>) => this.handleMessage(info, e);
    w.onerror = () => this.handleCrash(info);

    this.workers.push(info);
    return info;
  }

  private handleMessage(info: WorkerInfo, e: MessageEvent<WorkerResponse>): void {
    const msg = e.data;

    if (msg.type === 'PONG') {
      info.lastPong = Date.now();
      return;
    }

    if (msg.type === 'BUFFER_STATS') {
      return;
    }

    const entry = this.pending.get(msg.taskId);
    if (!entry) return;

    this.pending.delete(msg.taskId);
    info.busy = false;
    info.taskId = null;

    if (msg.type === 'ERROR') {
      if (entry.retriesLeft > 0) {
        entry.retriesLeft--;
        this.taskQueue.unshift(entry);
        this.dispatchNext();
        return;
      }
      entry.reject(new Error(msg.error));
    } else if (msg.type === 'PIXEL_PROCESSED') {
      entry.resolve({
        pageIndex: msg.pageIndex,
        buffer: msg.buffer,
        width: msg.width,
        height: msg.height,
        inkCoverageBeforePct: msg.inkBefore,
        inkCoverageAfterPct: msg.inkAfter,
      });
    } else if (msg.type === 'SHEET_COMPOSED') {
      entry.resolve({
        sheetIndex: msg.sheetIndex,
        jpegBuffer: msg.buffer,
        width: msg.width,
        height: msg.height,
      });
    } else if (msg.type === 'PAGE_RENDERED') {
      entry.resolve({
        pageIndex: msg.pageIndex,
        buffer: msg.buffer,
        width: msg.width,
        height: msg.height,
      });
    }

    this.dispatchNext();
  }

  private handleCrash(info: WorkerInfo): void {
    const taskId = info.taskId;
    const entry = taskId ? this.pending.get(taskId) : null;
    if (entry && taskId) {
      this.pending.delete(taskId);
      if (entry.retriesLeft > 0) {
        entry.retriesLeft--;
        this.taskQueue.unshift(entry);
      } else {
        entry.reject(new Error('Worker crashed'));
      }
    }

    info.healthy = false;
    const idx = this.workers.indexOf(info);
    if (idx !== -1) {
      try { info.worker.terminate(); } catch (error) { console.warn('[WorkerPool] Non-fatal error:', error); }
      this.workers.splice(idx, 1);
    }

    const replacement = this.spawnWorker(info.type);
    if (replacement) {
      this.dispatchNext();
    }
  }

  private dispatchNext(): void {
    if (this.destroyed) return;

    while (this.taskQueue.length > 0) {
      const entry = this.taskQueue[0];
      const worker = this.findIdleWorker(entry.type as unknown as WorkerType);
      if (!worker) break;

      this.taskQueue.shift();
      this.sendTask(worker, entry);
    }
  }

  private findIdleWorker(type: WorkerType): WorkerInfo | null {
    const candidates = this.workers.filter(w => w.type === type && !w.busy && w.healthy);

    if (candidates.length > 0) {
      return candidates[0];
    }

    return this.spawnWorker(type);
  }

  private sendTask(info: WorkerInfo, entry: TaskEntry): void {
    info.busy = true;
    info.taskId = entry.taskId;
    this.pending.set(entry.taskId, entry);

    const msg = entry.type === 'PROCESS_PIXEL'
      ? { type: 'PROCESS_PIXEL' as const, task: entry as unknown as PixelTask }
      : entry.type === 'COMPOSE_SHEET'
      ? { type: 'COMPOSE_SHEET' as const, task: entry as unknown as ComposeTask }
      : null;

    if (!msg) {
      entry.reject(new Error(`Unknown task type: ${entry.type}`));
      return;
    }

    const transferables: Transferable[] = [];
    if ('task' in msg && msg.task && 'buffer' in msg.task) {
      transferables.push(msg.task.buffer);
    }
    if ('task' in msg && msg.task && 'pageBuffers' in msg.task) {
      for (const buf of (msg.task as ComposeTask).pageBuffers) {
        transferables.push(buf);
      }
    }

    info.worker.postMessage(msg, transferables);
  }

  private setupHealthCheck(): void {
    if (this.healthTimer) return;
    this.healthTimer = setInterval(() => {
      const now = Date.now();
      for (const info of this.workers) {
        if (info.busy) continue;
        if (now - info.lastPong > HEALTH_CHECK_INTERVAL_MS + PING_TIMEOUT_MS) {
          info.healthy = false;
          try { info.worker.terminate(); } catch (error) { console.warn('[WorkerPool] Non-fatal error:', error); }
          const idx = this.workers.indexOf(info);
          if (idx !== -1) this.workers.splice(idx, 1);
          this.spawnWorker(info.type);
        } else {
          try { info.worker.postMessage({ type: 'PING' }); } catch (error) { console.warn('[WorkerPool] Non-fatal error:', error); }
        }
      }
      this.dispatchNext();
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  private submitTask<T extends PixelTask | ComposeTask>(
    task: Omit<T, 'taskId'>,
    type: 'PROCESS_PIXEL' | 'COMPOSE_SHEET',
    timeout = DEFAULT_TIMEOUT_MS
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const entry = {
        taskId: generateTaskId(),
        type,
        resolve,
        reject,
        startTime: Date.now(),
        timeout,
        retriesLeft: MAX_RETRIES,
        ...task,
      } as TaskEntry & T;

      const clear = this.scheduleTimeout(entry);
      entry.reject = (reason: Error) => { clear(); reject(reason); };
      entry.resolve = (val: any) => { clear(); resolve(val); };

      this.taskQueue.push(entry);
      this.setupHealthCheck();
      this.dispatchNext();
    });
  }

  submitPixelTask(task: Omit<PixelTask, 'taskId'>, timeout = DEFAULT_TIMEOUT_MS): Promise<{
    pageIndex: number;
    buffer: ArrayBuffer;
    width: number;
    height: number;
    inkCoverageBeforePct: number;
    inkCoverageAfterPct: number;
  }> {
    return this.submitTask<PixelTask>(task, 'PROCESS_PIXEL', timeout);
  }

  private scheduleTimeout(entry: TaskEntry): () => void {
    const timer = setTimeout(() => {
      const idx = this.taskQueue.indexOf(entry);
      if (idx !== -1) this.taskQueue.splice(idx, 1);
      if (this.pending.get(entry.taskId) === entry) {
        this.pending.delete(entry.taskId);
        entry.reject(new Error(`Task ${entry.type} timed out after ${entry.timeout}ms`));
      }
    }, entry.timeout);
    return () => clearTimeout(timer);
  }

  submitComposeTask(task: Omit<ComposeTask, 'taskId'>, timeout = DEFAULT_TIMEOUT_MS): Promise<{
    sheetIndex: number;
    jpegBuffer: ArrayBuffer;
    width: number;
    height: number;
  }> {
    return this.submitTask<ComposeTask>(task, 'COMPOSE_SHEET', timeout);
  }

  getStats() {
    return {
      poolSize: this.workers.length,
      busyCount: this.workers.filter(w => w.busy).length,
      healthyCount: this.workers.filter(w => w.healthy).length,
      queueLength: this.taskQueue.length,
      pendingCount: this.pending.size,
    };
  }

  destroy(): void {
    this.destroyed = true;
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    for (const info of this.workers) {
      try { info.worker.postMessage({ type: 'TERMINATE' }); info.worker.terminate(); } catch (error) { console.warn('[WorkerPool] Non-fatal error:', error); }
    }
    this.workers = [];
    this.taskQueue = [];
    for (const entry of this.pending.values()) {
      entry.reject(new Error('Pool destroyed'));
    }
    this.pending.clear();
  }
}
