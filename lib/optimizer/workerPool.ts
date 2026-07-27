/**
 * Persistent Web Worker Pool - Long-lived workers reused across pages.
 */
import { PageProfile, ProcessingParameters } from './types';
import { ImageProcessingKernels } from './pixelKernels';

export interface WorkerProcessResult {
  pageIndex: number; optimizedImageData: ImageData;
  inkCoverageBeforePct: number; inkCoverageAfterPct: number;
}
interface QueuedTask {
  pageIndex: number; buffer: ArrayBuffer; width: number; height: number;
  params: ProcessingParameters; profile: PageProfile;
  resolve: (r: WorkerProcessResult) => void; reject: (e: Error) => void;
}
interface PooledWorker { worker: Worker; busy: boolean; currentTask: QueuedTask | null; }

class PersistentWorkerPool {
  private workers: PooledWorker[] = [];
  private taskQueue: QueuedTask[] = [];
  private initialized = false;
  private workerUrl: URL | null = null;
  private useWorkers: boolean;

  constructor() { this.useWorkers = typeof window !== 'undefined' && typeof Worker !== 'undefined'; }

  private initialize(): void {
    if (this.initialized || !this.useWorkers) return;
    try {
      const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const poolSize = isMobile ? 1 : Math.min(4, Math.max(1, cores - 1));
      this.workerUrl = new URL('./workers/pageProcessor.worker.ts', import.meta.url);
      for (let i = 0; i < poolSize; i++) {
        const worker = new Worker(this.workerUrl, { type: 'module' });
        const pooled: PooledWorker = { worker, busy: false, currentTask: null };
        worker.onmessage = (e: MessageEvent) => this.onMsg(pooled, e);
        worker.onerror = (err) => this.onErr(pooled, err);
        this.workers.push(pooled);
      }
      this.initialized = true;
    } catch { this.useWorkers = false; this.workers = []; }
  }

  private onMsg(p: PooledWorker, e: MessageEvent): void {
    const msg = e.data; const task = p.currentTask; if (!task) return;
    if (msg.type === 'PAGE_PROCESSED') {
      task.resolve({ pageIndex: msg.pageIndex,
        optimizedImageData: new ImageData(new Uint8ClampedArray(msg.buffer), msg.width, msg.height),
        inkCoverageBeforePct: msg.inkCoverageBeforePct, inkCoverageAfterPct: msg.inkCoverageAfterPct });
    } else if (msg.type === 'PAGE_ERROR') { this.fallback(task); }
    p.busy = false; p.currentTask = null; this.dispatchNext();
  }

  private onErr(p: PooledWorker, _e: ErrorEvent): void {
    if (p.currentTask) this.fallback(p.currentTask);
    p.busy = false; p.currentTask = null;
    try { const idx = this.workers.indexOf(p);
      if (idx !== -1 && this.workerUrl) { p.worker.terminate();
        const nw = new Worker(this.workerUrl, { type: 'module' });
        const np: PooledWorker = { worker: nw, busy: false, currentTask: null };
        nw.onmessage = (e: MessageEvent) => this.onMsg(np, e);
        nw.onerror = (e2) => this.onErr(np, e2); this.workers[idx] = np; }
    } catch { const idx = this.workers.indexOf(p); if (idx !== -1) this.workers.splice(idx, 1); }
    this.dispatchNext();
  }

  private fallback(task: QueuedTask): void {
    try { const img = new ImageData(new Uint8ClampedArray(task.buffer), task.width, task.height);
      const ib = ImageProcessingKernels.calculateInkCoverage(img);
      const opt = ImageProcessingKernels.processImage(img, task.params, task.profile);
      const ia = ImageProcessingKernels.calculateInkCoverage(opt);
      task.resolve({ pageIndex: task.pageIndex, optimizedImageData: opt, inkCoverageBeforePct: ib, inkCoverageAfterPct: ia });
    } catch (e) { task.reject(e instanceof Error ? e : new Error(String(e))); }
  }

  private dispatchNext(): void {
    if (this.taskQueue.length === 0) return;
    const idle = this.workers.find(w => !w.busy); if (!idle) return;
    this.send(idle, this.taskQueue.shift()!);
  }

  private send(p: PooledWorker, task: QueuedTask): void {
    p.busy = true; p.currentTask = task;
    p.worker.postMessage({ type: 'PROCESS_PAGE', pageIndex: task.pageIndex, width: task.width,
      height: task.height, buffer: task.buffer, params: task.params, profile: task.profile }, [task.buffer]);
  }

  public async processPage(pageIndex: number, imageData: ImageData, params: ProcessingParameters, profile: PageProfile): Promise<WorkerProcessResult> {
    this.initialize();
    if (!this.useWorkers || this.workers.length === 0) {
      return new Promise((resolve, reject) => {
        this.fallback({ pageIndex, buffer: imageData.data.buffer.slice(0), width: imageData.width,
          height: imageData.height, params, profile, resolve, reject }); }); }
    return new Promise((resolve, reject) => {
      const task: QueuedTask = { pageIndex, buffer: imageData.data.buffer.slice(0), width: imageData.width,
        height: imageData.height, params, profile, resolve, reject };
      const idle = this.workers.find(w => !w.busy);
      if (idle) this.send(idle, task); else this.taskQueue.push(task); });
  }

  public getStats() { return { poolSize: this.workers.length, busyCount: this.workers.filter(w => w.busy).length,
    queueLength: this.taskQueue.length, initialized: this.initialized }; }

  public destroy(): void {
    for (const p of this.workers) { try { p.worker.postMessage({ type: 'TERMINATE' }); p.worker.terminate(); } catch { /* */ } }
    this.workers = []; this.taskQueue = []; this.initialized = false;
  }
}

export const workerPool = new PersistentWorkerPool();
