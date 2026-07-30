import type { IPlugin, PluginManifest, PluginContext, PluginResult, PluginMetrics } from '../pipeline/plugin/types';
import { Channels } from '../pipeline/plugin/channels';
import { processPage, calculateInkCoverage, createImageDataFromBuffer } from '../kernels';
import { ParameterGenerator } from '../optimizer/parameterGenerator';
import type { PageProfile, ProcessingParameters } from '../optimizer/types';
import type { DocumentProfile } from '../optimizer/types';

const manifest: PluginManifest = {
  id: 'npo.process.optimize@1.0.0',
  name: 'Page Optimizer',
  version: '1.0.0',
  description: 'Optimizes page image data (inversion, sharpening, denoising)',
  dependsOn: ['npo.analyze.profile@1.0.0'],
  inputChannel: Channels.PAGE_IMAGE,
  outputChannel: Channels.OPTIMIZED_IMAGE,
  executionTarget: 'auto',
  optional: false,
  resourceHint: { estimatedMemoryMB: 20, isCPUBound: true },
};

export interface ProcessPluginInput {
  imageData: ImageData;
  pageNumber: number;
  profile: PageProfile;
}

export class ProcessPlugin implements IPlugin<ProcessPluginInput, { imageData: ImageData; inkBefore: number; inkAfter: number }> {
  readonly manifest = manifest;

  async execute(
    input: ProcessPluginInput,
    ctx: PluginContext,
  ): Promise<PluginResult<{ imageData: ImageData; inkBefore: number; inkAfter: number }>> {
    const t0 = performance.now();
    const { imageData, profile } = input;

    const params = ParameterGenerator.getPresetParameters(
      profile.classification === 'DARK_SLIDE' ? 'PW_DARK_SLIDE' : 'LIGHT_HANDWRITTEN'
    );

    const result = processPage(imageData.data, imageData.width, imageData.height, params, profile);
    const optimizedImageData = createImageDataFromBuffer(result.buffer, result.width, result.height);
    const inkBefore = calculateInkCoverage(imageData.data);
    const inkAfter = calculateInkCoverage(new Uint8ClampedArray(result.buffer));

    const metrics: PluginMetrics = {
      durationMs: Math.round(performance.now() - t0),
      inputBytes: imageData.data.length,
      outputBytes: result.buffer.byteLength,
      pixelsProcessed: imageData.width * imageData.height,
    };

    return {
      data: { imageData: optimizedImageData, inkBefore, inkAfter },
      metrics,
    };
  }
}
