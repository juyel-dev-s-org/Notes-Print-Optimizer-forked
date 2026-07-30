import type { IPlugin, PluginManifest, PluginContext, PluginResult, PluginMetrics } from '../pipeline/plugin/types';
import { Channels } from '../pipeline/plugin/channels';
import { analyzeImageData } from '../optimizer/analysis';
import type { PageProfile } from '../optimizer/types';

const manifest: PluginManifest = {
  id: 'npo.analyze.profile@1.0.0',
  name: 'Page Profile Analyzer',
  version: '1.0.0',
  description: 'Analyzes image data to produce per-page profiles (brightness, contrast, classification)',
  dependsOn: ['npo.render.pdfjs@1.0.0'],
  inputChannel: Channels.PAGE_IMAGE,
  outputChannel: Channels.PAGE_PROFILE,
  executionTarget: 'auto',
  optional: false,
  resourceHint: { estimatedMemoryMB: 5, isCPUBound: true },
};

export class AnalyzePlugin implements IPlugin<{ imageData: ImageData; pageNumber: number }, PageProfile> {
  readonly manifest = manifest;

  async execute(
    input: { imageData: ImageData; pageNumber: number },
    ctx: PluginContext,
  ): Promise<PluginResult<PageProfile>> {
    const t0 = performance.now();
    const profile = analyzeImageData(input.imageData, input.pageNumber - 1);

    const metrics: PluginMetrics = {
      durationMs: Math.round(performance.now() - t0),
      inputBytes: input.imageData.data.length,
      outputBytes: 0,
      pixelsProcessed: input.imageData.width * input.imageData.height,
    };

    return { data: profile, metrics };
  }
}
