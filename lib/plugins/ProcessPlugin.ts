/**
 * ProcessPlugin - Page optimizer with signal-aware processing.
 */
import type { IPlugin, PluginManifest, PluginContext, PluginResult, PluginMetrics } from '../pipeline/plugin/types';
import { Channels } from '../pipeline/plugin/channels';
import { processPage, calculateInkCoverage, createImageDataFromBuffer } from '../kernels';
import { ParameterGenerator } from '../optimizer/parameterGenerator';
import type { PageProfile } from '../optimizer/types';

const manifest: PluginManifest = { id: 'npo.process.optimize@1.0.0', name: 'Page Optimizer', version: '1.1.0', description: 'Optimizes page image data with signal-aware processing', dependsOn: ['npo.analyze.profile@1.0.0'], inputChannel: Channels.PAGE_PROFILE, outputChannel: Channels.OPTIMIZED_IMAGE, executionTarget: 'auto', optional: false, resourceHint: { estimatedMemoryMB: 20, isCPUBound: true } };

export type ProcessPluginOutput = { imageData: ImageData; pageNumber: number; profile: PageProfile; inkBefore: number; inkAfter: number; };

export class ProcessPlugin implements IPlugin<{ imageData: ImageData; pageNumber: number; profile: PageProfile }, ProcessPluginOutput> {
  readonly manifest = manifest;
  async execute(input: { imageData: ImageData; pageNumber: number; profile: PageProfile }, ctx: PluginContext): Promise<PluginResult<ProcessPluginOutput>> {
    const t0 = performance.now();
    const { imageData, profile } = input;
    if (ctx.signal.aborted) throw new DOMException('Processing aborted', 'AbortError');
    const params = ParameterGenerator.getPresetParameters(profile.classification === 'DARK_SLIDE' ? 'PW_DARK_SLIDE' : 'LIGHT_HANDWRITTEN');
    const result = processPage(imageData.data, imageData.width, imageData.height, params, profile);
    if (ctx.signal.aborted) throw new DOMException('Processing aborted', 'AbortError');
    const optimizedImageData = createImageDataFromBuffer(result.buffer, result.width, result.height);
    const inkBefore = calculateInkCoverage(imageData.data);
    const inkAfter = calculateInkCoverage(new Uint8ClampedArray(result.buffer));
    const metrics: PluginMetrics = { durationMs: Math.round(performance.now() - t0), inputBytes: imageData.data.length, outputBytes: result.buffer.byteLength, pixelsProcessed: imageData.width * imageData.height };
    return { data: { imageData: optimizedImageData, pageNumber: input.pageNumber, profile: input.profile, inkBefore, inkAfter }, metrics };
  }
}
