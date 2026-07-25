/**
 * Memory Management & Watchdog Utilities
 * Handles aggressive canvas disposal, Blob URL tracking/revocation,
 * mobile vs desktop device detection, and execution concurrency limits.
 */

class MemoryManager {
  private activeBlobUrls: Set<string> = new Set();

  /**
   * Detect if the current device is a mobile or low-memory device
   */
  public isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;

    const ua = navigator.userAgent || '';
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

    const deviceMemory = (navigator as any).deviceMemory;
    const isLowMemory = typeof deviceMemory === 'number' && deviceMemory <= 4;

    const isSmallScreen = window.innerWidth <= 768;
    const isTouchOnly = navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches;

    return isMobileUA || isLowMemory || (isSmallScreen && isTouchOnly);
  }

  /**
   * Get maximum safe concurrent worker tasks based on device hardware
   */
  public getConcurrencyLimit(): number {
    if (this.isMobileDevice()) {
      return 1; // Low Memory Mode: strictly sequential 1 page at a time on mobile
    }
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    return Math.min(cores, 4); // Desktop High Performance: up to 4 parallel workers
  }

  /**
   * Track created Object URLs for clean disposal later
   */
  public createTrackedBlobUrl(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.activeBlobUrls.add(url);
    return url;
  }

  /**
   * Revoke a single tracked Blob URL
   */
  public revokeBlobUrl(url: string | null | undefined): void {
    if (!url) return;
    if (this.activeBlobUrls.has(url)) {
      URL.revokeObjectURL(url);
      this.activeBlobUrls.delete(url);
    } else if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Revoke all tracked Blob URLs (called on phase transitions & reset)
   */
  public revokeAllBlobUrls(): void {
    this.activeBlobUrls.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // ignore
      }
    });
    this.activeBlobUrls.clear();
  }

  /**
   * Aggressively dispose HTMLCanvasElement memory
   */
  public disposeCanvas(canvas: HTMLCanvasElement | null | undefined): void {
    if (!canvas) return;
    try {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      canvas.width = 0;
      canvas.height = 0;
    } catch (e) {
      // ignore
    }
  }

  /**
   * Helper to convert ImageData to a compressed JPEG Blob
   */
  public async imageDataToBlob(
    imageData: ImageData,
    quality: number = 0.85
  ): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(imageData, 0, 0);
    }

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          this.disposeCanvas(canvas);
          resolve(blob || new Blob([], { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality
      );
    });
  }

  /**
   * Helper to convert Blob back to ImageData
   */
  public async blobToImageData(blob: Blob): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          this.disposeCanvas(canvas);
          return reject(new Error('Canvas 2D context unavailable'));
        }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        URL.revokeObjectURL(url);
        this.disposeCanvas(canvas);
        resolve(imgData);
      };

      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };

      img.src = url;
    });
  }

  /**
   * Non-blocking delay to let UI event loop breathe
   */
  public async yieldToUI(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export const memoryManager = new MemoryManager();
