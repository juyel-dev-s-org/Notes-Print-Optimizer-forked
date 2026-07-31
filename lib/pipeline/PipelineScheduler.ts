/**
 * PipelineScheduler - Priority heap scheduler with retry & backpressure.
 */
export interface SchedulerOptions { maxConcurrency: number; yieldIntervalMs: number; maxRetries: number; baseRetryDelayMs: number; queueHighWaterMark: number; }
interface QueueEntry { task: () => Promise<void>; priority: number; reject: (err: Error) => void; retriesLeft: number; attempt: number; }

class PriorityHeap {
  private heap: QueueEntry[] = [];
  get size(): number { return this.heap.length; }
  push(entry: QueueEntry): void { this.heap.push(entry); this.bubbleUp(this.heap.length - 1); }
  pop(): QueueEntry | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0]; const last = this.heap.pop()!;
    if (this.heap.length > 0) { this.heap[0] = last; this.sinkDown(0); }
    return top;
  }
  drain(): QueueEntry[] { return this.heap.splice(0); }
  private higher(a: QueueEntry, b: QueueEntry): boolean { return a.priority > b.priority; }
  private bubbleUp(i: number): void { while (i > 0) { const p = (i-1)>>1; if (this.higher(this.heap[i], this.heap[p])) { [this.heap[i], this.heap[p]] = [this.heap[p], this.heap[i]]; i = p; } else break; } }
  private sinkDown(i: number): void { const n = this.heap.length; while (true) { let best = i; const l = 2*i+1; const r = 2*i+2; if (l < n && this.higher(this.heap[l], this.heap[best])) best = l; if (r < n && this.higher(this.heap[r], this.heap[best])) best = r; if (best === i) break; [this.heap[i], this.heap[best]] = [this.heap[best], this.heap[i]]; i = best; } }
}

export class PipelineScheduler {
  private queue = new PriorityHeap();
  private inFlight = 0;
  private aborted = false;
  private draining = false;
  private readonly maxConcurrency: number;
  private readonly yieldIntervalMs: number;
  private readonly maxRetries: number;
  private readonly baseRetryDelayMs: number;
  private readonly queueHighWaterMark: number;
  private dispatchScheduled = false;

  constructor(opts: Partial<SchedulerOptions> = {}) {
    this.maxConcurrency = opts.maxConcurrency ?? 4;
    this.yieldIntervalMs = opts.yieldIntervalMs ?? 16;
    this.maxRetries = opts.maxRetries ?? 2;
    this.baseRetryDelayMs = opts.baseRetryDelayMs ?? 200;
    this.queueHighWaterMark = opts.queueHighWaterMark ?? 32;
  }

  get isBackpressured(): boolean { return this.queue.size >= this.queueHighWaterMark; }

  async run<T>(fn: () => Promise<T>, priority = 0): Promise<T> {
    if (this.aborted) throw new DOMException('Scheduler aborted', 'AbortError');
    return new Promise<T>((resolve, reject) => {
      const entry: QueueEntry = { task: async () => { try { resolve(await fn()); } catch (e) { reject(e instanceof Error ? e : new Error(String(e))); } }, priority, reject, retriesLeft: this.maxRetries, attempt: 0 };
      this.queue.push(entry);
      this.scheduleDispatch();
    });
  }

  private scheduleDispatch(): void {
    if (this.dispatchScheduled || this.aborted) return;
    this.dispatchScheduled = true;
    if (this.yieldIntervalMs > 0) { setTimeout(() => { this.dispatchScheduled = false; this.dispatch(); }, this.yieldIntervalMs); }
    else { queueMicrotask(() => { this.dispatchScheduled = false; this.dispatch(); }); }
  }

  private dispatch(): void {
    while (this.queue.size > 0 && this.inFlight < this.maxConcurrency && !this.aborted) {
      const entry = this.queue.pop()!;
      this.inFlight++;
      entry.task()
        .catch(async () => { if (entry.retriesLeft > 0 && !this.aborted) { entry.retriesLeft--; entry.attempt++; const delay = this.baseRetryDelayMs * Math.pow(2, entry.attempt - 1) + Math.random() * 50; await new Promise(r => setTimeout(r, delay)); if (!this.aborted) { this.queue.push(entry); this.scheduleDispatch(); } } })
        .finally(() => { this.inFlight--; if (this.queue.size > 0 && !this.aborted) this.scheduleDispatch(); });
    }
  }

  abort(): void { this.aborted = true; for (const e of this.queue.drain()) e.reject(new DOMException('Scheduler aborted', 'AbortError')); }
  async drain(): Promise<void> { this.draining = true; for (const e of this.queue.drain()) e.reject(new DOMException('Scheduler draining', 'AbortError')); while (this.inFlight > 0) await new Promise(r => setTimeout(r, 16)); }
  getStats() { return { inFlight: this.inFlight, queued: this.queue.size, aborted: this.aborted, backpressured: this.isBackpressured }; }
  reset(): void { this.aborted = false; this.draining = false; this.inFlight = 0; this.queue = new PriorityHeap(); }
}
