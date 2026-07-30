import 'fake-indexeddb/auto';

if (typeof Blob === 'undefined') {
  (global as any).Blob = class Blob {
    parts: any[];
    options?: any;
    constructor(parts: any[], options?: any) {
      this.parts = parts;
      this.options = options;
    }
    get size() { return this.parts.join('').length; }
    get type() { return this.options?.type || ''; }
    async text() { return this.parts.join(''); }
    async arrayBuffer() { return new Uint8Array(Buffer.from(this.parts.join(''))).buffer; }
  };
}

if (typeof ImageData === 'undefined') {
  (global as any).ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(data: Uint8ClampedArray, width: number, height: number) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  };
}

if (typeof HTMLCanvasElement === 'undefined') {
  let createCanvas: any;
  try {
    createCanvas = require('@napi-rs/canvas').createCanvas;
  } catch {
    createCanvas = () => ({ width: 100, height: 100, getContext: () => null });
  }
  (global as any).HTMLCanvasElement = class HTMLCanvasElement {};
  (global as any).CanvasRenderingContext2D = class CanvasRenderingContext2D {};
  (global as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') return createCanvas(100, 100);
      return {};
    }
  };
}
