import { detectDeviceProfile } from '../pipeline/types';

/**
 * Memory Management & Device Utilities
 */
class MemoryManager {
  private activeBlobUrls: Map<string, string | undefined> = new Map();
  private canvasPool: HTMLCanvasElement[] = [];
  private canvasPoolMax = 8;
  private canvasPoolBytes = 0;
  private canvasPoolMaxBytes = 32 * 1048576; // 32 MB pool budget

  public acquireCanvas(width: number, height: number): HTMLCanvasElement {
    if (typeof document === 'undefined') {
      return { width, height } as unknown as HTMLCanvasElement;
    }
    // 1. Try exact match first (zero reallocation)
    for (let i = 0; i < this.canvasPool.length; i++) {
      const c = this.canvasPool[i];
      if (c.width === width && c.height === height) {
        this.canvasPool.splice(i, 1);
        this.canvasPoolBytes -= c.width * c.height * 4;
        return c;
      }
    }
    // 2. Try best-fit match (closest larger size)
    let bestIdx = -1;
    let minExcess = Infinity;
    for (let i = 0; i < this.canvasPool.length; i++) {
      const c = this.canvasPool[i];
      if (c.width >= width && c.height >= height) {
        const excess = (c.width * c.height) - (width * height);
        if (excess < minExcess) {
          minExcess = excess;
          bestIdx = i;
        }
      }
    }
    if (bestIdx !== -1) {
      const c = this.canvasPool.splice(bestIdx, 1)[0];
      this.canvasPoolBytes -= c.width * c.height * 4;
      c.width = width;
      c.height = height;
      return c;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  public releaseCanvas(canvas: HTMLCanvasElement | null | undefined): void {
    if (!canvas || typeof document === 'undefined') return;
    const memSize = canvas.width * canvas.height * 4;
    if (memSize > 0 && this.canvasPool.length < this.canvasPoolMax && this.canvasPoolBytes + memSize <= this.canvasPoolMaxBytes) {
      try {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      } catch { /* noop */ }
      this.canvasPool.push(canvas);
      this.canvasPoolBytes += memSize;
    } else {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  public isMobileDevice(): boolean {
    return detectDeviceProfile().isMobile;
  }

  public getConcurrencyLimit(): number {
    if (this.isMobileDevice()) return 1;
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    return Math.min(cores, 4);
  }

  /**
   * Tracks a blob URL. An optional tag groups related URLs so a family
   * (e.g. 'sheet-preview') can be revoked without touching live UI assets
   * such as merged-page or processed-page thumbnails.
   */
  public createTrackedBlobUrl(blob: Blob, tag?: string): string {
    const url = URL.createObjectURL(blob); this.activeBlobUrls.set(url, tag); return url;
  }

  public revokeBlobUrl(url: string | null | undefined): void {
    if (!url) return;
    if (this.activeBlobUrls.has(url)) { URL.revokeObjectURL(url); this.activeBlobUrls.delete(url); }
    else if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  }

  /** Revokes only URLs created with the given tag. */
  public revokeTaggedBlobUrls(tag: string): void {
    this.activeBlobUrls.forEach((t, url) => {
      if (t !== tag) return;
      try { URL.revokeObjectURL(url); } catch (error) { console.warn('[MemoryManager] Non-fatal error:', error); }
      this.activeBlobUrls.delete(url);
    });
  }

  public revokeAllBlobUrls(): void {
    this.activeBlobUrls.forEach((_, url) => { try { URL.revokeObjectURL(url); } catch (error) { console.warn('[MemoryManager] Non-fatal error:', error); } });
    this.activeBlobUrls.clear();
  }

  public disposeCanvas(canvas: HTMLCanvasElement | null | undefined): void {
    this.releaseCanvas(canvas);
  }

  public async imageDataToBlob(imageData: ImageData, quality: number = 0.85): Promise<Blob> {
    const canvas = this.acquireCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) ctx.putImageData(imageData, 0, 0);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => { this.releaseCanvas(canvas); resolve(blob || new Blob([], { type: 'image/jpeg' })); }, 'image/jpeg', quality);
    });
  }

  private async loadImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image from blob'));
      };
      img.src = url;
    });
  }

  public async blobToImageData(blob: Blob): Promise<ImageData> {
    if (typeof createImageBitmap !== 'undefined') {
      try {
        const bitmap = await createImageBitmap(blob);
        const canvas = this.acquireCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        this.disposeCanvas(canvas);
        return imgData;
      } catch {
        // Fall through to Image fallback
      }
    }
    
    const img = await this.loadImage(blob);
    const canvas = this.acquireCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx) {
      this.disposeCanvas(canvas);
      throw new Error('Failed to get 2D context');
    }
    
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, img.width, img.height);
    this.disposeCanvas(canvas);
    return imgData;
  }

  public async checkStorageQuota(): Promise<{ ok: boolean; used: string; quota: string; percentUsed: number } | null> {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
    try {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage ?? 0;
      const quota = estimate.quota ?? 0;
      return { ok: used < quota * 0.9, used: this.formatBytes(used), quota: this.formatBytes(quota), percentUsed: quota > 0 ? (used / quota) * 100 : 0 };
    } catch { return null; }
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  public async yieldToUI(): Promise<void> {
    const sched = typeof scheduler !== 'undefined' ? scheduler : undefined;
    if (sched && typeof sched.yield === 'function') return sched.yield();
    if (typeof MessageChannel !== 'undefined') {
      return new Promise<void>((resolve) => {
        const { port1, port2 } = new MessageChannel();
        port2.onmessage = () => resolve();
        port1.postMessage(null);
      });
    }
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export const memoryManager = new MemoryManager();
