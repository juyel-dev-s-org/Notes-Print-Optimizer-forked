import { WorkerPool } from './pool';
import type { WorkerType } from './protocol';

function canUseWorkers(): boolean {
  return typeof Worker !== 'undefined' && typeof window !== 'undefined';
}

function canUseOffscreenCanvas(): boolean {
  return typeof OffscreenCanvas !== 'undefined';
}

export class WorkerManager {
  private static instance: WorkerManager;
  private pool: WorkerPool | null = null;
  private useWorkers: boolean;
  private workerUrls = new Map<WorkerType, string>();
  private factoryOverride: ((type: WorkerType) => Worker | null) | null = null;

  private constructor() {
    this.useWorkers = canUseWorkers();
  }

  static getInstance(): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager();
    }
    return WorkerManager.instance;
  }

  registerWorkerUrl(type: WorkerType, url: string): void {
    this.workerUrls.set(type, url);
  }

  /** Registered by lib/workers/init with webpack-analyzable `new Worker(new URL(...))` factories. */
  registerWorkerFactory(factory: (type: WorkerType) => Worker | null): void {
    this.factoryOverride = factory;
  }

  private workerFactory = (type: WorkerType): Worker | null => {
    if (!this.useWorkers) return null;

    if (this.factoryOverride) {
      try {
        if (type === 'compose' && !canUseOffscreenCanvas()) return null;
        return this.factoryOverride(type);
      } catch {
        return null;
      }
    }

    const url = this.workerUrls.get(type);
    if (!url) return null;

    try {
      if (type === 'compose' && !canUseOffscreenCanvas()) return null;
      return new Worker(url, { type: 'module' });
    } catch {
      return null;
    }
  };

  getPool(): WorkerPool {
    if (!this.pool) {
      this.pool = new WorkerPool(this.workerFactory);
    }
    return this.pool;
  }

  isWorkerSupported(): boolean {
    return this.useWorkers;
  }

  isOffscreenCanvasSupported(): boolean {
    return canUseOffscreenCanvas();
  }

  getCapabilities() {
    return {
      workers: this.useWorkers,
      offscreenCanvas: canUseOffscreenCanvas(),
      poolSize: this.pool ? this.pool.getStats().poolSize : 0,
    };
  }

  destroy(): void {
    if (this.pool) {
      this.pool.destroy();
      this.pool = null;
    }
  }
}
