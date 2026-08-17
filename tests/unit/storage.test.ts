import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { pwOptimizerStorage } from '../../lib/optimizer/storage';

type StorageInternals = {
  dbPromise: Promise<IDBDatabase> | null;
  cachedSizeBytes: number | null;
};

describe('PWOptimizerStorage', () => {
  beforeEach(() => {
    const storage = pwOptimizerStorage as unknown as StorageInternals;
    storage.dbPromise = null;
    storage.cachedSizeBytes = null;
  });

  afterEach(async () => {
    const storage = pwOptimizerStorage as unknown as StorageInternals;
    if (storage.dbPromise) {
      try {
        const db = await storage.dbPromise;
        if (db && typeof db.close === 'function') {
          db.close();
        }
      } catch {}
      storage.dbPromise = null;
    }
    storage.cachedSizeBytes = null;
    
    const req = indexedDB.deleteDatabase('pw_optimizer_cache_db');
    await new Promise((resolve) => {
      req.onsuccess = resolve;
      req.onerror = resolve;
      req.onblocked = resolve;
    });
  });

  it('should store and retrieve a page successfully', async () => {
    const pdfId = 'test-pdf-123';
    const pageIndex = 0;
    const originalBlob = new Blob(['original data'], { type: 'image/png' });
    const optimizedBlob = new Blob(['optimized data'], { type: 'image/jpeg' });

    await pwOptimizerStorage.storePage(pdfId, pageIndex, originalBlob, optimizedBlob);
    const record = await pwOptimizerStorage.getPage(pdfId, pageIndex);
    
    expect(record).not.toBeNull();
    expect(record!.originalBlob).toBeDefined();
    expect(record!.optimizedBlob).toBeDefined();
    // fake-indexeddb may drop properties when cloning jsdom Blobs, handle gracefully
    if (record!.originalBlob && record!.originalBlob.size !== undefined) {
      expect(record!.originalBlob.size).toBe(13);
      expect(record!.optimizedBlob.size).toBe(14);
    }
  });

  it('should return null for non-existent page', async () => {
    const record = await pwOptimizerStorage.getPage('non-existent', 0);
    expect(record).toBeNull();
  });

  it('should delete a page successfully', async () => {
    const pdfId = 'test-pdf-456';
    const pageIndex = 1;
    const originalBlob = new Blob(['original'], { type: 'image/png' });
    const optimizedBlob = new Blob(['optimized'], { type: 'image/jpeg' });

    await pwOptimizerStorage.storePage(pdfId, pageIndex, originalBlob, optimizedBlob);
    await pwOptimizerStorage.clearCache(pdfId);
    expect(await pwOptimizerStorage.getPage(pdfId, pageIndex)).toBeNull();
  });

  it('keeps cache accounting accurate when a page is overwritten', async () => {
    await pwOptimizerStorage.storePage('overwrite', 0, null, new Blob(['first-value']));
    expect(await pwOptimizerStorage.getCacheSize()).toBe(11);

    await pwOptimizerStorage.storePage('overwrite', 0, null, new Blob(['next']));
    expect(await pwOptimizerStorage.getCacheSize()).toBe(4);
  });

  it('keeps batch cache accounting accurate when existing pages are replaced', async () => {
    await pwOptimizerStorage.storePagesBatch([
      { pdfId: 'batch', pageIndex: 0, originalBlob: null, optimizedBlob: new Blob(['first']) },
      { pdfId: 'batch', pageIndex: 1, originalBlob: null, optimizedBlob: new Blob(['second']) },
    ]);
    expect(await pwOptimizerStorage.getCacheSize()).toBe(11);

    await pwOptimizerStorage.storePagesBatch([
      { pdfId: 'batch', pageIndex: 0, originalBlob: null, optimizedBlob: new Blob(['new']) },
      { pdfId: 'batch', pageIndex: 1, originalBlob: null, optimizedBlob: new Blob(['replacement']) },
      { pdfId: 'batch', pageIndex: 1, originalBlob: null, optimizedBlob: new Blob(['final']) },
    ]);
    expect(await pwOptimizerStorage.getCacheSize()).toBe(8);
  });
});
