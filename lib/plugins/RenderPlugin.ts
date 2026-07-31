import type { IPlugin, PluginManifest, PluginContext, PluginResult, PluginMetrics } from '../pipeline/plugin/types';
import { Channels } from '../pipeline/plugin/channels';

const manifest: PluginManifest = {
  id: 'npo.render.pdfjs@1.0.0',
  name: 'PDF.js Renderer',
  version: '1.0.0',
  description: 'Renders PDF pages to ImageData using pdfjs-dist',
  inputChannel: Channels.RAW_PDF,
  outputChannel: Channels.PAGE_IMAGE,
  executionTarget: 'auto',
  optional: false,
  resourceHint: { estimatedMemoryMB: 50, isGPUBound: true },
};

export class RenderPlugin implements IPlugin<ArrayBuffer, { imageData: ImageData; pageNumber: number }> {
  readonly manifest = manifest;
  private pdfjsLib: any = null;
  private pdfDoc: any = null;
  private pdfBuffer: ArrayBuffer | null = null;
  private renderScale = 1.8;

  async init(ctx: PluginContext): Promise<void> {
    try {
      this.pdfjsLib = await import('pdfjs-dist');
    } catch {
      // @ts-expect-error dynamic CDN import — webpackIgnore prevents bundling
      this.pdfjsLib = await import(/* webpackIgnore: true */ 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
    }
  }

  setScale(scale: number): void {
    this.renderScale = scale;
  }

  async execute(
    input: ArrayBuffer,
    ctx: PluginContext,
  ): Promise<PluginResult<{ imageData: ImageData; pageNumber: number }>> {
    const t0 = performance.now();

    if (this.pdfBuffer !== input) {
      this.pdfBuffer = input;
      this.pdfDoc = await this.pdfjsLib.getDocument({ data: new Uint8Array(input) }).promise;
    }

    const page = await this.pdfDoc.getPage(ctx.pageIndex);
    const viewport = page.getViewport({ scale: this.renderScale });

    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    // Use 'any' to bypass the strict CanvasRenderingContext2D requirement of older pdf.js types
    // while safely accepting OffscreenCanvasRenderingContext2D in modern browsers.
    const pageCtx = canvas.getContext('2d') as any;
    await page.render({ canvasContext: pageCtx, viewport }).promise;

    const imageBitmap = canvas.transferToImageBitmap();
    const tmpCanvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const tmpCtx = tmpCanvas.getContext('2d')!;
    tmpCtx.drawImage(imageBitmap, 0, 0);
    const imageData = tmpCtx.getImageData(0, 0, imageBitmap.width, imageBitmap.height);
    
    // Cleanup to prevent memory leaks
    imageBitmap.close();

    const durationMs = performance.now() - t0;
    const metrics: PluginMetrics = {
      durationMs: Math.round(durationMs),
      inputBytes: input.byteLength,
      outputBytes: imageData.data.length,
      pixelsProcessed: imageData.width * imageData.height,
    };

    return {
      data: { imageData, pageNumber: ctx.pageIndex },
      metrics,
    };
  }

  async dispose(): Promise<void> {
    this.pdfDoc = null;
    this.pdfBuffer = null;
    this.pdfjsLib = null;
  }
}
