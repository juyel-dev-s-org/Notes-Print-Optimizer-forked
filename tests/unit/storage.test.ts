import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import PWOptimizerStorage from '../../lib/optimizer/storage';

// Mock Blob for Node.js environment
if (typeof Blob === 'undefined') {
  (global as any).Blob = class Blob {
    constructor(public parts: any[], public options?: any) {}
    get size() { return this.parts.join('').length; }
    get type() { return this.options?.type || ''; }
    async text() { return this.parts.join(''); }
    async arrayBuffer() { return new Uint8Array(Buffer.from(this.parts.join(''))).buffer; }
  };
}

describe('PWOptimizerStorage', () => {
  let storage: PWOptimizerStorage;

  beforeEach(() => {
    storage = new (PWOptimizerStorage as any)();
    // Reset DB promise to force new connection per test
    (storage as any).dbPromise = null;
  });

  afterEach(async () => {
    // Clean up IndexedDB after each test
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

    await storage.storePage(pdfId, pageIndex, originalBlob, optimizedBlob);

    const record = await storage.getPage(pdfId, pageIndex);
    expect(record).not.toBeNull();
    expect(record?.pdfId).toBe(pdfId);
    expect(record?.pageIndex).toBe(pageIndex);
    
    const originalText = await record!.originalBlob.text();
    const optimizedText = await record!.optimizedBlob.text();
    expect(originalText).toBe('original data');
    expect(optimizedText).toBe('optimized data');
  });

  it('should return null for non-existent page', async () => {
    const record = await storage.getPage('non-existent', 0);
    expect(record).toBeNull();
  });

  it('should delete a page successfully', async () => {
    const pdfId = 'test-pdf-456';
    const pageIndex = 1;
    const originalBlob = new Blob(['original'], { type: 'image/png' });
    const optimizedBlob = new Blob(['optimized'], { type: 'image/jpeg' });

    await storage.storePage(pdfId, pageIndex, originalBlob, optimizedBlob);
    await storage.deletePage(pdfId, pageIndex);

    const record = await storage.getPage(pdfId, pageIndex);
    expect(record).toBeNull();
  });

  it('should clear all pages for a specific PDF', async () => {
    const pdfId = 'test-pdf-789';
    const blob1 = new Blob(['data1'], { type: 'image/png' });
    const blob2 = new Blob(['data2'], { type: 'image/jpeg' });

    await storage.storePage(pdfId, 0, blob1, blob2);
    await storage.storePage(pdfId, 1, blob1, blob2);

    await storage.clearPdfCache(pdfId);

    const record0 = await storage.getPage(pdfId, 0);
    const record1 = await storage.getPage(pdfId, 1);
    expect(record0).toBeNull();
    expect(record1).toBeNull();
  });
});
