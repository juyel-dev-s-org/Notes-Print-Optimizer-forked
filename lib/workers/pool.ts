/**
 * WorkerPool - Managed worker pool with size limits and health checks.
 *
 * Production optimizations:
 *  - MAX_WORKERS_PER_TYPE cap prevents unbounded worker spawning
 *  - Idle worker reclamation after timeout (frees memory on low-end devices)
 *  - Transferable-first message passing (zero-copy buffer handoff)
 *  - Health check with PING/PONG and automatic crash recovery
 */
import type { WorkerType, WorkerInfo, TaskEntry, WorkerRequest, WorkerResponse, PixelTask, ComposeTask } from './protocol';
import { generateTaskId } from './protocol';

const DEFAULT_TIMEOUT_MS = 30_000;
const HEALTH_CHECK_INTERVAL_MS = 15_000;
const MAX_RETRIES = 2;
const PING_TIMEOUT_MS = 3_000;
const MAX_WORKERS_PER_TYPE = 4;
const IDLE_RECLAIM_MS = 60_000;

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

  private countByType(type: WorkerType): number {
    return this.workers.filter(w => w.type === type).length;
  }

  private spawnWorker(type: WorkerType): WorkerInfo | null {
    if (this.destroyed) return null;
    /* Enforce pool size limit per worker type */
    if (this.countByType(type) >= MAX_WORKERS_PER_TYPE) return null;

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
        this.scheduleTimeout(entry);
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
        this.scheduleTimeout(entry);
        this.taskQueue.unshift(entry);
      } else {
        entry.reject(new Error('Worker crashed'));
      }
    }

    this.retireWorker(info);

    if (this.destroyed) return;

    const replacement = this.spawnWorker(info.type);
    if (replacement) {
      this.dispatchNext();
    }
  }

  private dispatchNext(): void {
    if (this.destroyed) return;

    while (this.taskQueue.length > 0) {
      const entry = this.taskQueue[0];
      const worker = this.findIdleWorker(this.taskTypeToWorkerType(entry.type as TaskEntry['type']));
      if (!worker) break;

      this.taskQueue.shift();
      this.sendTask(worker, entry);
    }
  }

  /** Maps task types (PROCESS_PIXEL/COMPOSE_SHEET) to the worker types the factory understands (pixel/compose). */
  private taskTypeToWorkerType(type: TaskEntry['type']): WorkerType {
    return type === 'PROCESS_PIXEL' ? 'pixel' : 'compose';
  }

  private findIdleWorker(type: WorkerType): WorkerInfo | null {
    const candidates = this.workers.filter(w => w.type === type && !w.busy && w.healthy);

    if (candidates.length > 0) {
      return candidates[0];
    }

    /* Only spawn if under limit */
    return this.spawnWorker(type);
  }

  private sendTask(info: WorkerInfo, entry: TaskEntry): void {
    info.busy = true;
    info.taskId = entry.taskId;
    this.pending.set(entry.taskId, entry);

    const msg = this.buildMessage(entry);

    if (!msg) {
      entry.reject(new Error(`Unknown task type: ${entry.type}`));
      this.pending.delete(entry.taskId);
      info.busy = false;
      info.taskId = null;
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

    try {
      info.worker.postMessage(msg, transferables);
    } catch (e) {
      // postMessage can throw DataCloneError if buffer is detached (e.g., after a retry attempt)
      entry.reject(e instanceof Error ? e : new Error('postMessage failed'));
      this.pending.delete(entry.taskId);
      info.busy = false;
      info.taskId = null;
      this.dispatchNext();
    }
  }

  /** Builds a structured-clone-safe message: the TaskEntry carries resolve/reject
      closures and must never be postMessage'd to a worker. */
  private buildMessage(entry: TaskEntry): WorkerRequest | null {
    if (entry.type === 'PROCESS_PIXEL') {
      const task = entry as TaskEntry & PixelTask;
      return {
        type: 'PROCESS_PIXEL' as const,
        task: {
          taskId: task.taskId,
          pageIndex: task.pageIndex,
          buffer: task.buffer,
          width: task.width,
          height: task.height,
          params: task.params,
          profile: task.profile,
        } satisfies PixelTask,
      };
    }
    if (entry.type === 'COMPOSE_SHEET') {
      const task = entry as TaskEntry & ComposeTask;
      return {
        type: 'COMPOSE_SHEET' as const,
        task: {
          taskId: task.taskId,
          sheetIndex: task.sheetIndex,
          totalSheets: task.totalSheets,
          pageBuffers: task.pageBuffers,
          pageWidths: task.pageWidths,
          pageHeights: task.pageHeights,
          cols: task.cols,
          rows: task.rows,
          dims: task.dims,
          marginTop: task.marginTop,
          marginLeft: task.marginLeft,
          marginRight: task.marginRight,
          marginBottom: task.marginBottom,
          marginInner: task.marginInner,
          footerHeight: task.footerHeight,
          footerFontSize: task.footerFontSize,
          footerBaseline: task.footerBaseline,
          showSlideBorders: task.showSlideBorders,
          showPageNumbers: task.showPageNumbers,
        } satisfies ComposeTask,
      };
    }
    return null;
  }

  private setupHealthCheck(): void {
    if (this.healthTimer) return;
    this.healthTimer = setInterval(() => {
      const now = Date.now();
      for (const info of [...this.workers]) {
        if (info.busy) continue;

        /* Reclaim idle workers after timeout (frees memory) */
        if (now - info.lastPong > IDLE_RECLAIM_MS && this.countByType(info.type) > 1) {
          this.retireWorker(info);
          continue;
        }

        if (now - info.lastPong > HEALTH_CHECK_INTERVAL_MS + PING_TIMEOUT_MS) {
          this.retireWorker(info);
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

      const rawReject = reject;
      const rawResolve = resolve;
      entry.reject = (reason: Error) => { this.clearTaskTimeout(entry); rawReject(reason); };
      entry.resolve = (val: any) => { this.clearTaskTimeout(entry); rawResolve(val); };

      this.scheduleTimeout(entry);
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
    whiteBoxRegions?: Array<{ x: number; y: number; width: number; height: number }>;
  }> {
    return this.submitTask<PixelTask>(task, 'PROCESS_PIXEL', timeout);
  }

  /**
   * Spawns a single idle worker of the given type ahead of time so the first
   * task does not pay the spawn + lazy-init cost. No-op when the factory
   * cannot create a worker (unregistered URL, unsupported environment).
   */
  prewarm(type: WorkerType): void {
    if (this.destroyed) return;
    if (this.countByType(type) === 0) {
      this.spawnWorker(type);
    }
  }

  private scheduleTimeout(entry: TaskEntry): void {
    this.clearTaskTimeout(entry);
    entry.timerId = setTimeout(() => {
      entry.timerId = null;
      const idx = this.taskQueue.indexOf(entry);
      if (idx !== -1) {
        /* Queued task that could not be dispatched (no worker available) must reject,
           otherwise its promise stays pending forever (submitPixelTask/submitComposeTask hang). */
        this.taskQueue.splice(idx, 1);
        entry.reject(new Error(`Task ${entry.type} timed out after ${entry.timeout}ms (no worker available)`));
        return;
      }
      if (this.pending.get(entry.taskId) === entry) {
        this.pending.delete(entry.taskId);
        const worker = this.workers.find((info) => info.taskId === entry.taskId);
        if (worker) {
          this.retireWorker(worker);
          this.spawnWorker(worker.type);
        }
        entry.reject(new Error(`Task ${entry.type} timed out after ${entry.timeout}ms`));
        this.dispatchNext();
      }
    }, entry.timeout);
  }

  private clearTaskTimeout(entry: TaskEntry): void {
    if (entry.timerId) {
      clearTimeout(entry.timerId);
      entry.timerId = null;
    }
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
      maxPerType: MAX_WORKERS_PER_TYPE,
    };
  }

  destroy(): void {
    this.destroyed = true;
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    for (const entry of this.taskQueue) {
      this.clearTaskTimeout(entry);
      entry.reject(new Error('Pool destroyed'));
    }
    this.taskQueue = [];
    for (const entry of this.pending.values()) {
      this.clearTaskTimeout(entry);
      entry.reject(new Error('Pool destroyed'));
    }
    this.pending.clear();
    for (const info of [...this.workers]) {
      this.retireWorker(info, true);
    }
  }

  /** Remove a worker without allowing stale callbacks to revive the pool. */
  private retireWorker(info: WorkerInfo, sendTerminate = false): void {
    info.healthy = false;
    info.busy = false;
    info.taskId = null;
    info.worker.onmessage = null;
    info.worker.onerror = null;
    const idx = this.workers.indexOf(info);
    if (idx !== -1) this.workers.splice(idx, 1);
    try {
      if (sendTerminate) info.worker.postMessage({ type: 'TERMINATE' });
      info.worker.terminate();
    } catch (error) {
      console.warn('[WorkerPool] Non-fatal error:', error);
    }
  }
}
