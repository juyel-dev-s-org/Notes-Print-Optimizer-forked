const DB_NAME = 'pw_checkpoint_db';
const DB_VERSION = 1;
const STORE_NAME = 'checkpoints';

interface CheckpointRecord {
  id: string;
  documentId: string;
  totalPages: number;
  completedPages: number[];
  lastUpdated: number;
  engineVersion: string;
  params: Record<string, unknown>;
  layoutConfig: Record<string, unknown>;
}

export class CheckpointManager {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (typeof window === 'undefined') return Promise.reject(new Error('No IndexedDB on server'));
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (ev) => {
          const db = (ev.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }

  async save(documentId: string, state: Omit<CheckpointRecord, 'id' | 'lastUpdated'> & { lastUpdated?: number }): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({
        ...state,
        id: documentId,
        lastUpdated: Date.now(),
      } as CheckpointRecord);
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[Checkpoint] save failed', e);
    }
  }

  async load(documentId: string): Promise<Omit<CheckpointRecord, 'id'> | null> {
    try {
      const db = await this.getDB();
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(documentId);
      return new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async remove(documentId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(documentId);
      return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
    } catch { /* */ }
  }

  async listSnapshots(): Promise<Array<{ documentId: string; totalPages: number; completedCount: number; lastUpdated: number }>> {
    try {
      const db = await this.getDB();
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      return new Promise((resolve) => {
        req.onsuccess = () => {
          const records = req.result as CheckpointRecord[];
          resolve(records.map(r => ({
            documentId: r.documentId,
            totalPages: r.totalPages,
            completedCount: r.completedPages.length,
            lastUpdated: r.lastUpdated,
          })));
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  private locks = new Map<string, Promise<void>>();

  private async withLock(documentId: string, fn: () => Promise<void>): Promise<void> {
    const prev = this.locks.get(documentId) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    this.locks.set(documentId, next);
    return next;
  }

  async markPageDone(documentId: string, pageIndex: number): Promise<void> {
    return this.withLock(documentId, async () => {
      const record = await this.load(documentId);
      if (!record) return;
      if (!record.completedPages.includes(pageIndex)) {
        record.completedPages.push(pageIndex);
      }
      await this.save(documentId, record);
    });
  }

  async getResumePages(documentId: string, totalPages: number): Promise<number[]> {
    const record = await this.load(documentId);
    if (!record || record.totalPages !== totalPages) return [];
    const done = new Set(record.completedPages);
    const pending: number[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (!done.has(i)) pending.push(i);
    }
    return pending;
  }
}
