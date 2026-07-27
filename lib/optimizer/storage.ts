/**
 * IndexedDB Cache Engine with batched writes, versioning, and eviction.
 */
const DB_NAME = 'pw_optimizer_cache_db';
const DB_VERSION = 2;
const STORE_NAME = 'pages_cache';
const CACHE_VERSION = 2;

interface CachedPageRecord {
  id: string; pdfId: string; pageIndex: number;
  originalBlob: Blob; optimizedBlob: Blob; timestamp: number; cacheVersion: number;
}

class PWOptimizerStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (typeof window === 'undefined') return Promise.reject(new Error('No IndexedDB on server'));
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (ev: IDBVersionChangeEvent) => {
          const db = (ev.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('pdfId', 'pdfId', { unique: false });
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => console.warn('IndexedDB blocked by another tab');
      });
    }
    return this.dbPromise;
  }

  public async storePage(pdfId: string, pageIndex: number, originalBlob: Blob, optimizedBlob: Blob): Promise<void> {
    try { const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ id: `${pdfId}_page_${pageIndex}`, pdfId, pageIndex,
        originalBlob, optimizedBlob, timestamp: Date.now(), cacheVersion: CACHE_VERSION } as CachedPageRecord);
      return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    } catch (e) { console.warn('IDB write failed', e); }
  }

  public async storePagesBatch(pages: Array<{ pdfId: string; pageIndex: number; originalBlob: Blob; optimizedBlob: Blob }>): Promise<void> {
    if (pages.length === 0) return;
    try { const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME); const now = Date.now();
      for (const p of pages) {
        store.put({ id: `${p.pdfId}_page_${p.pageIndex}`, pdfId: p.pdfId, pageIndex: p.pageIndex,
          originalBlob: p.originalBlob, optimizedBlob: p.optimizedBlob, timestamp: now, cacheVersion: CACHE_VERSION } as CachedPageRecord);
      }
      return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    } catch (e) { console.warn('IDB batch write failed', e); }
  }

  public async getPage(pdfId: string, pageIndex: number): Promise<{ originalBlob: Blob; optimizedBlob: Blob } | null> {
    try { const db = await this.getDB();
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(`${pdfId}_page_${pageIndex}`);
      return new Promise((resolve) => {
        req.onsuccess = () => { const r = req.result as CachedPageRecord | undefined;
          if (r && r.cacheVersion === CACHE_VERSION) resolve({ originalBlob: r.originalBlob, optimizedBlob: r.optimizedBlob });
          else resolve(null); };
        req.onerror = () => resolve(null);
      });
    } catch { return null; }
  }

  public async clearCache(pdfId?: string): Promise<void> {
    try { const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      if (!pdfId) store.clear();
      else { const idx = store.index('pdfId'); const req = idx.getAllKeys(pdfId);
        req.onsuccess = () => { req.result.forEach((k) => store.delete(k)); }; }
      return new Promise((resolve) => { tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); });
    } catch { /* */ }
  }

  public async evictStaleEntries(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    try { const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const idx = tx.objectStore(STORE_NAME).index('timestamp');
      const range = IDBKeyRange.upperBound(Date.now() - maxAgeMs);
      const req = idx.openCursor(range);
      req.onsuccess = () => { const c = req.result; if (c) { c.delete(); c.continue(); } };
      return new Promise((resolve) => { tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); });
    } catch { /* */ }
  }
}

export const pwOptimizerStorage = new PWOptimizerStorage();
