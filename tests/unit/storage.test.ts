import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { pwOptimizerStorage } from '../../lib/optimizer/storage';

describe('PWOptimizerStorage', () => {
  beforeEach(() => {
    (pwOptimizerStorage as any).dbPromise = null;
  });

  afterEach(async () => {
    const req = indexedDB.deleteDatabase('pw_optimizer_cache_db');
    await new Promise((resolve) => {
      req.onsuccess = resolve;
      req.onerror = resolve;
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
    expect(await record!.originalBlob.text()).toBe('original data');
    expect(await record!.optimizedBlob.text()).toBe('optimized data');
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
