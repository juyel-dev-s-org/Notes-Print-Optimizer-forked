import type { IPlugin, PluginManifest, PluginContext, PluginResult, PluginMetrics } from '../pipeline/plugin/types';
import { Channels } from '../pipeline/plugin/channels';

const manifest: PluginManifest = {
  id: 'npo.thumbnail.generate@1.0.0',
  name: 'Thumbnail Generator',
  version: '1.0.0',
  description: 'Generates JPEG thumbnails from page images',
  dependsOn: ['npo.render.pdfjs@1.0.0'],
  inputChannel: Channels.PAGE_IMAGE,
  outputChannel: Channels.THUMBNAIL,
  executionTarget: 'auto',
  optional: true,
  resourceHint: { estimatedMemoryMB: 5, isCPUBound: true },
};

export class ThumbnailPlugin implements IPlugin<{ imageData: ImageData; pageNumber: number }, { dataUrl: string; pageNumber: number }> {
  readonly manifest = manifest;

  async execute(
    input: { imageData: ImageData; pageNumber: number },
    ctx: PluginContext,
  ): Promise<PluginResult<{ dataUrl: string; pageNumber: number }>> {
    const t0 = performance.now();
    const tw = Math.max(1, Math.round(input.imageData.width / 4));
    const th = Math.max(1, Math.round(input.imageData.height / 4));

    const canvas = new OffscreenCanvas(tw, th);
    const ctx2d = canvas.getContext('2d')!;

    const tmp = new OffscreenCanvas(input.imageData.width, input.imageData.height);
    const tmpCtx = tmp.getContext('2d')!;
    tmpCtx.putImageData(input.imageData, 0, 0);
    ctx2d.drawImage(tmp, 0, 0, tw, th);

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.6 });
    const dataUrl = URL.createObjectURL(blob);

    const metrics: PluginMetrics = {
      durationMs: Math.round(performance.now() - t0),
      inputBytes: input.imageData.data.length,
      outputBytes: blob.size,
      pixelsProcessed: tw * th,
    };

    return {
      data: { dataUrl, pageNumber: input.pageNumber },
      metrics,
    };
  }
}
