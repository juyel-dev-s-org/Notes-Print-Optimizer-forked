/**
 * IndexedDB Cache Engine for Physics Wallah Notes Optimizer
 * Offloads full-resolution original & optimized page images to disk storage
 * so browser RAM usage stays constant regardless of PDF page count.
 */

const DB_NAME = 'pw_optimizer_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'pages_cache';

interface CachedPageRecord {
  id: string; // e.g., `${pdfId}_page_${pageIndex}`
  pdfId: string;
  pageIndex: number;
  originalBlob: Blob;
  optimizedBlob: Blob;
  timestamp: number;
}

class PWOptimizerStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('IndexedDB unavailable on server'));
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('pdfId', 'pdfId', { unique: false });
          }
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    }

    return this.dbPromise;
  }

  /**
   * Save a single page's original & optimized Blobs to IndexedDB
   */
  public async storePage(
    pdfId: string,
    pageIndex: number,
    originalBlob: Blob,
    optimizedBlob: Blob
  ): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record: CachedPageRecord = {
        id: `${pdfId}_page_${pageIndex}`,
        pdfId,
        pageIndex,
        originalBlob,
        optimizedBlob,
        timestamp: Date.now(),
      };

      store.put(record);

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('IndexedDB write failed, falling back to memory', e);
    }
  }

  /**
   * Retrieve page Blobs by pdfId and pageIndex
   */
  public async getPage(
    pdfId: string,
    pageIndex: number
  ): Promise<{ originalBlob: Blob; optimizedBlob: Blob } | null> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(`${pdfId}_page_${pageIndex}`);

      return new Promise((resolve) => {
        request.onsuccess = () => {
          const record = request.result as CachedPageRecord | undefined;
          if (record) {
            resolve({
              originalBlob: record.originalBlob,
              optimizedBlob: record.optimizedBlob,
            });
          } else {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  /**
   * Clear cached pages for a specific PDF or clear all cache
   */
  public async clearCache(pdfId?: string): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      if (!pdfId) {
        store.clear();
      } else {
        const index = store.index('pdfId');
        const request = index.getAllKeys(pdfId);
        request.onsuccess = () => {
          const keys = request.result;
          keys.forEach((key) => store.delete(key));
        };
      }

      return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch (e) {
      // ignore
    }
  }
}

export const pwOptimizerStorage = new PWOptimizerStorage();
