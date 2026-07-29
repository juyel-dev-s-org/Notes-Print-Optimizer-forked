// tests/setup.ts
import { fakeIndexedDB } from 'fake-indexeddb';

// Mock IndexedDB for tests
if (typeof window !== 'undefined') {
  (window as any).indexedDB = fakeIndexedDB;
  (window as any).IDBKeyRange = (global as any).IDBKeyRange;
}

// Mock canvas for Node.js environment
if (typeof HTMLCanvasElement === 'undefined') {
  const { createCanvas } = require('@napi-rs/canvas');
  (global as any).HTMLCanvasElement = class HTMLCanvasElement {};
  (global as any).CanvasRenderingContext2D = class CanvasRenderingContext2D {};
  (global as any).ImageData = class ImageData {
    constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
  };
  (global as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        const canvas = createCanvas(100, 100);
        return canvas;
      }
      return {};
    }
  };
}
