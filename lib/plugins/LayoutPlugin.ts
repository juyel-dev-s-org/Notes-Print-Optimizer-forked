import type { IPlugin, PluginManifest, PluginContext, PluginResult, PluginMetrics } from '../pipeline/plugin/types';
import { Channels } from '../pipeline/plugin/channels';
import { LayoutEngine } from '../optimizer/layoutEngine';
import type { LayoutConfig } from '../optimizer/types';

const manifest: PluginManifest = {
  id: 'npo.layout.compose@1.0.0',
  name: 'Sheet Composer',
  version: '1.0.0',
  description: 'Composes optimized page images into multi-up grid sheets',
  dependsOn: ['npo.process.optimize@1.0.0'],
  inputChannel: Channels.OPTIMIZED_IMAGE,
  outputChannel: Channels.SHEET_COMPOSITION,
  executionTarget: 'auto',
  optional: false,
  resourceHint: { estimatedMemoryMB: 30, isCPUBound: false },
};

export interface LayoutPluginInput {
  pages: Array<{ imageData: ImageData; pageNumber: number; inkBefore: number; inkAfter: number }>;
  config: LayoutConfig;
}

export class LayoutPlugin implements IPlugin<LayoutPluginInput, { sheets: ArrayBuffer[]; format: 'jpeg' }> {
  readonly manifest = manifest;

  async execute(
    input: LayoutPluginInput,
    ctx: PluginContext,
  ): Promise<PluginResult<{ sheets: ArrayBuffer[]; format: 'jpeg' }>> {
    const t0 = performance.now();
    const { pages, config } = input;
    const { totalPerSheet } = LayoutEngine.getGridDimensions(config.gridFormat);
    const totalSheets = Math.ceil(pages.length / totalPerSheet);
    const sheets: ArrayBuffer[] = [];

    for (let si = 0; si < totalSheets; si++) {
      const chunk = pages.slice(si * totalPerSheet, Math.min(pages.length, (si + 1) * totalPerSheet));
      const canvas = LayoutEngine.composeSheet(
        chunk.map(p => p.imageData), si, totalSheets, config
      );
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b || new Blob()), 'image/jpeg', 0.85));
      sheets.push(await blob.arrayBuffer());
      canvas.width = 0;
      canvas.height = 0;
    }

    const totalInputBytes = pages.reduce((s, p) => s + p.imageData.data.length, 0);
    const totalOutputBytes = sheets.reduce((s, b) => s + b.byteLength, 0);
    const metrics: PluginMetrics = {
      durationMs: Math.round(performance.now() - t0),
      inputBytes: totalInputBytes,
      outputBytes: totalOutputBytes,
    };

    return { data: { sheets, format: 'jpeg' }, metrics };
  }
}
