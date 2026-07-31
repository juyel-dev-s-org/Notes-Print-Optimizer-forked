/**
 * RenderPlugin - PDF page renderer with lazy init, timeout, and abort support.
 */
import type { IPlugin, PluginManifest, PluginContext, PluginResult, PluginMetrics } from '../pipeline/plugin/types';
import { Channels } from '../pipeline/plugin/channels';

const RENDER_TIMEOUT_MS = 30_000;

const manifest: PluginManifest = { id: 'npo.render.pdfjs@1.0.0', name: 'PDF.js Renderer', version: '1.1.0', description: 'Renders PDF pages to ImageData with timeout and abort support', inputChannel: Channels.RAW_PDF, outputChannel: Channels.PAGE_IMAGE, executionTarget: 'auto', optional: false, resourceHint: { estimatedMemoryMB: 50, isGPUBound: true } };

export class RenderPlugin implements IPlugin<ArrayBuffer, { imageData: ImageData; pageNumber: number }> {
  readonly manifest = manifest;
  private pdfjsLib: any = null;
  private pdfDoc: any = null;
  private pdfBuffer: ArrayBuffer | null = null;
  private renderScale = 1.8;
  private initPromise: Promise<void> | null = null;

  async init(_ctx: PluginContext): Promise<void> { if (this.initPromise) return this.initPromise; this.initPromise = this.doInit(); return this.initPromise; }
  private async doInit(): Promise<void> { try { const loader = await import('../optimizer/pdfjsLoader'); this.pdfjsLib = await loader.getPdfjsLib(); } catch { try { this.pdfjsLib = await import('pdfjs-dist'); } catch { // @ts-expect-error dynamic CDN import
    this.pdfjsLib = await import(/* webpackIgnore: true */ 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs'); } } }

  setScale(scale: number): void { this.renderScale = Math.max(0.5, Math.min(scale, 4.0)); }

  async execute(input: ArrayBuffer, ctx: PluginContext): Promise<PluginResult<{ imageData: ImageData; pageNumber: number }>> {
    const t0 = performance.now();
    if (!this.pdfjsLib) await this.init(ctx);
    if (ctx.signal.aborted) throw new DOMException('Render aborted', 'AbortError');
    if (this.pdfBuffer !== input) { if (this.pdfDoc) { try { this.pdfDoc.destroy(); } catch { /* */ } } this.pdfBuffer = input; this.pdfDoc = await this.pdfjsLib.getDocument({ data: new Uint8Array(input) }).promise; }
    const page = await this.pdfDoc.getPage(ctx.pageIndex);
    const viewport = page.getViewport({ scale: this.renderScale });
    const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const pageCtx = canvas.getContext('2d') as any;
    const renderTask = page.render({ canvasContext: pageCtx, viewport });
    const timeoutPromise = new Promise<never>((_, reject) => { const timer = setTimeout(() => { renderTask.cancel?.(); reject(new Error(`Render timeout ${RENDER_TIMEOUT_MS}ms (page ${ctx.pageIndex})`)); }, RENDER_TIMEOUT_MS); ctx.signal.addEventListener('abort', () => { clearTimeout(timer); renderTask.cancel?.(); reject(new DOMException('Render aborted', 'AbortError')); }, { once: true }); });
    await Promise.race([renderTask.promise, timeoutPromise]);
    const imageBitmap = canvas.transferToImageBitmap();
    const tmpCanvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const tmpCtx = tmpCanvas.getContext('2d')!;
    tmpCtx.drawImage(imageBitmap, 0, 0);
    const imageData = tmpCtx.getImageData(0, 0, imageBitmap.width, imageBitmap.height);
    imageBitmap.close();
    const metrics: PluginMetrics = { durationMs: Math.round(performance.now() - t0), inputBytes: input.byteLength, outputBytes: imageData.data.length, pixelsProcessed: imageData.width * imageData.height };
    return { data: { imageData, pageNumber: ctx.pageIndex }, metrics };
  }

  isHealthy(): boolean { return this.pdfjsLib !== null; }
  async dispose(): Promise<void> { if (this.pdfDoc) { try { this.pdfDoc.destroy(); } catch { /* */ } } this.pdfDoc = null; this.pdfBuffer = null; this.pdfjsLib = null; this.initPromise = null; }
}
