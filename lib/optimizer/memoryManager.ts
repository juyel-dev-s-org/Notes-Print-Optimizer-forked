/**
 * Memory Management & Device Utilities
 */
class MemoryManager {
  private activeBlobUrls: Set<string> = new Set();

  public isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    const nav = navigator as any;
    if (nav.userAgentData?.mobile !== undefined) return nav.userAgentData.mobile === true;
    const ua = navigator.userAgent || '';
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isLowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
    const isSmallScreen = window.innerWidth <= 768;
    const isTouchOnly = navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches;
    return isMobileUA || isLowMemory || (isSmallScreen && isTouchOnly);
  }

  public getConcurrencyLimit(): number {
    if (this.isMobileDevice()) return 1;
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    return Math.min(cores, 4);
  }

  public createTrackedBlobUrl(blob: Blob): string {
    const url = URL.createObjectURL(blob); this.activeBlobUrls.add(url); return url;
  }

  public revokeBlobUrl(url: string | null | undefined): void {
    if (!url) return;
    if (this.activeBlobUrls.has(url)) { URL.revokeObjectURL(url); this.activeBlobUrls.delete(url); }
    else if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  }

  public revokeAllBlobUrls(): void {
    this.activeBlobUrls.forEach((url) => { try { URL.revokeObjectURL(url); } catch { /* */ } });
    this.activeBlobUrls.clear();
  }

  public disposeCanvas(canvas: HTMLCanvasElement | null | undefined): void {
    if (!canvas) return;
    try { canvas.width = 0; canvas.height = 0; } catch { /* */ }
  }

  public async imageDataToBlob(imageData: ImageData, quality: number = 0.85): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width; canvas.height = imageData.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) ctx.putImageData(imageData, 0, 0);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => { this.disposeCanvas(canvas); resolve(blob || new Blob([], { type: 'image/jpeg' })); }, 'image/jpeg', quality);
    });
  }

  public async blobToImageData(blob: Blob): Promise<ImageData> {
    if (typeof createImageBitmap !== 'undefined') {
      try { const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(bitmap, 0, 0); bitmap.close();
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        this.disposeCanvas(canvas); return imgData;
      } catch { /* fall through */ }
    }
    return new Promise((resolve, reject) => {
      const img = new Image(); const url = URL.createObjectURL(blob);
      img.onload = () => { const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) { URL.revokeObjectURL(url); this.disposeCanvas(canvas); return reject(new Error('No 2D ctx')); }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        URL.revokeObjectURL(url); this.disposeCanvas(canvas); resolve(imgData); };
      img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
      img.src = url;
    });
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
    const sched = (globalThis as any).scheduler;
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
