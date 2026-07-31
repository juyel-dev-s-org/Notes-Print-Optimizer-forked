/**
 * ThumbnailPlugin - Thumbnail generator with OffscreenCanvas and DOM canvas fallback.
 */
import type { IPlugin, PluginManifest, PluginContext, PluginResult, PluginMetrics } from '../pipeline/plugin/types';
import { Channels } from '../pipeline/plugin/channels';

const manifest: PluginManifest = { id: 'npo.thumbnail.generate@1.0.0', name: 'Thumbnail Generator', version: '1.1.0', description: 'Generates JPEG thumbnails with OffscreenCanvas and DOM fallback', dependsOn: ['npo.render.pdfjs@1.0.0'], inputChannel: Channels.PAGE_IMAGE, outputChannel: Channels.THUMBNAIL, executionTarget: 'auto', optional: true, resourceHint: { estimatedMemoryMB: 5, isCPUBound: true } };

export class ThumbnailPlugin implements IPlugin<{ imageData: ImageData; pageNumber: number }, { dataUrl: string; pageNumber: number }> {
  readonly manifest = manifest;
  async execute(input: { imageData: ImageData; pageNumber: number }, ctx: PluginContext): Promise<PluginResult<{ dataUrl: string; pageNumber: number }>> {
    const t0 = performance.now();
    if (ctx.signal.aborted) throw new DOMException('Thumbnail aborted', 'AbortError');
    const tw = Math.max(1, Math.round(input.imageData.width / 4));
    const th = Math.max(1, Math.round(input.imageData.height / 4));
    let dataUrl = ''; let outputBytes = 0;
    if (typeof OffscreenCanvas !== 'undefined') { try { const canvas = new OffscreenCanvas(tw, th); const ctx2d = canvas.getContext('2d'); if (ctx2d) { const tmp = new OffscreenCanvas(input.imageData.width, input.imageData.height); const tmpCtx = tmp.getContext('2d'); if (tmpCtx) { tmpCtx.putImageData(input.imageData, 0, 0); ctx2d.drawImage(tmp, 0, 0, tw, th); const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.6 }); dataUrl = URL.createObjectURL(blob); outputBytes = blob.size; } } } catch { dataUrl = ''; } }
    if (!dataUrl && typeof document !== 'undefined') { try { const canvas = document.createElement('canvas'); canvas.width = tw; canvas.height = th; const ctx2d = canvas.getContext('2d'); if (ctx2d) { const tmp = document.createElement('canvas'); tmp.width = input.imageData.width; tmp.height = input.imageData.height; const tmpCtx = tmp.getContext('2d'); if (tmpCtx) { tmpCtx.putImageData(input.imageData, 0, 0); ctx2d.drawImage(tmp, 0, 0, tw, th); const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.6)); if (blob) { dataUrl = URL.createObjectURL(blob); outputBytes = blob.size; } } } } catch { dataUrl = ''; } }
    const metrics: PluginMetrics = { durationMs: Math.round(performance.now() - t0), inputBytes: input.imageData.data.length, outputBytes, pixelsProcessed: tw * th };
    return { data: { dataUrl, pageNumber: input.pageNumber }, metrics, warnings: dataUrl ? undefined : ['Thumbnail generation failed'] };
  }
}
