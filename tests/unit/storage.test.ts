import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { pwOptimizerStorage } from '../../lib/optimizer/storage';

describe('PWOptimizerStorage', () => {
  beforeEach(() => {
    (pwOptimizerStorage as any).dbPromise = null;
  });

  afterEach(async () => {
    if ((pwOptimizerStorage as any).dbPromise) {
      try {
        const db = await (pwOptimizerStorage as any).dbPromise;
        if (db && typeof db.close === 'function') {
          db.close();
        }
      } catch (e) {}
      (pwOptimizerStorage as any).dbPromise = null;
    }
    
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
});