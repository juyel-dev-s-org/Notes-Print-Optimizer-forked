import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PluginRegistry } from '../../lib/pipeline/PluginRegistry';
import { PipelineController } from '../../lib/pipeline/PipelineController';
import { Channels, type ChannelDataMap } from '../../lib/pipeline/plugin/channels';
import type { IPlugin, PluginContext, PluginResult } from '../../lib/pipeline/plugin/types';
import { MetricsBus } from '../../lib/metrics/MetricsBus';
import { CheckpointManager } from '../../lib/pipeline/checkpoint/CheckpointManager';

function createMockPlugin(id: string, inCh: string, outCh: string): IPlugin {
  return {
    manifest: {
      id, name: id, version: '1.0.0', description: '',
      inputChannel: inCh, outputChannel: outCh,
      executionTarget: 'main', optional: false,
    },
    async execute(input: any, ctx: PluginContext): Promise<PluginResult<any>> {
      return {
        data: { ...input, fromPlugin: id },
        metrics: { durationMs: 1, inputBytes: 0, outputBytes: 0 },
      };
    },
  };
}

describe('Pipeline integration', () => {
  let registry: PluginRegistry;
  let controller: PipelineController;
  let metricsBus: MetricsBus;

  beforeEach(async () => {
    registry = new PluginRegistry();
    metricsBus = new MetricsBus();
    registry.register(createMockPlugin('plugin.a', Channels.RAW_PDF, Channels.PAGE_IMAGE));
    registry.register(createMockPlugin('plugin.b', Channels.PAGE_IMAGE, Channels.OPTIMIZED_IMAGE));
    registry.register(createMockPlugin('plugin.c', Channels.SHEET_COMPOSITION, Channels.PDF_DOCUMENT));
    controller = new PipelineController(registry, metricsBus);
  });

  afterEach(() => {
    controller.abort();
  });

  it('should run a pipeline with mock plugins', async () => {
    const buffer = new ArrayBuffer(8);
    const result = await controller.runDocument(buffer, { documentId: 'test-doc', totalPages: 5 });
    expect(result.pages).toHaveLength(5);
    expect(result.totalMetrics.pagesPerSecond).toBeGreaterThan(0);
    expect(result.totalMetrics.durationMs).toBeGreaterThan(0);
  });

  it('should emit pipeline:phase events on start and complete', async () => {
    const events: any[] = [];
    metricsBus.on('pipeline:phase', e => events.push(e));
    await controller.runDocument(new ArrayBuffer(8), { documentId: 'phase-test', totalPages: 3 });
    expect(events.length).toBeGreaterThanOrEqual(2);
    const phases = events.map(e => e.phase);
    expect(phases).toContain('start');
    expect(phases).toContain('complete');
  });

  it('should emit plugin:execute events per page', async () => {
    const events: any[] = [];
    metricsBus.on('plugin:execute', e => events.push(e));
    await controller.runDocument(new ArrayBuffer(8), { documentId: 'emit-test', totalPages: 2 });
    expect(events.length).toBeGreaterThanOrEqual(4);
    events.forEach(e => expect(e.pluginId).toMatch(/^plugin\./));
  });

  it('should abort on external signal', async () => {
    const ac = new AbortController();
    const promise = controller.runDocument(new ArrayBuffer(8), {
      documentId: 'abort-test', totalPages: 50, signal: ac.signal,
    });
    ac.abort();
    await expect(promise).rejects.toThrow('aborted');
  });

  it('should return empty resume list for unknown document', async () => {
    const cm = controller.getCheckpoint();
    const result = await cm.getResumePages('nonexistent', 10);
    expect(result).toEqual([]);
  });
});
