export interface SchedulerOptions {
  maxConcurrency: number;
  yieldIntervalMs: number;
}

export class PipelineScheduler {
  private queue: Array<{ task: () => Promise<void>; priority: number; reject: (err: Error) => void }> = [];
  private inFlight = 0;
  private aborted = false;
  private maxConcurrency: number;
  private yieldIntervalMs: number;

  constructor(opts: Partial<SchedulerOptions> = {}) {
    this.maxConcurrency = opts.maxConcurrency ?? 4;
    this.yieldIntervalMs = opts.yieldIntervalMs ?? 16;
  }

  async run<T>(fn: () => Promise<T>, priority = 0): Promise<T> {
    if (this.aborted) throw new DOMException('Scheduler aborted', 'AbortError');

    return new Promise<T>((resolve, reject) => {
      const task = async () => {
        try { resolve(await fn()); } catch (e) { reject(e instanceof Error ? e : new Error(String(e))); }
      };
      this.queue.push({ task, priority, reject });

      if (this.queue.length === 1) {
        this.dispatch();
      }
    });
  }

  private async dispatch(): Promise<void> {
    while (this.queue.length > 0 && this.inFlight < this.maxConcurrency && !this.aborted) {
      this.queue.sort((a, b) => b.priority - a.priority);
      const entry = this.queue.shift()!;
      this.inFlight++;
      entry.task().finally(() => {
        this.inFlight--;
        if (this.queue.length > 0) {
          if (this.yieldIntervalMs > 0) {
            setTimeout(() => this.dispatch(), this.yieldIntervalMs);
          } else {
            this.dispatch();
          }
        }
      });
    }
  }

  abort(): void {
    this.aborted = true;
    for (const entry of this.queue) {
      entry.reject(new DOMException('Scheduler aborted', 'AbortError'));
    }
    this.queue = [];
  }

  getStats() {
    return { inFlight: this.inFlight, queued: this.queue.length, aborted: this.aborted };
  }
}
