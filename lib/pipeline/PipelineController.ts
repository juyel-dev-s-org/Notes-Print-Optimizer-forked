import { PluginRegistry } from './PluginRegistry';
import { PipelineScheduler } from './PipelineScheduler';
import { memoryGuard } from './MemoryGuard';
import { CheckpointManager } from './checkpoint/CheckpointManager';
import { computeScheduleProfile } from './types';
import type { IPlugin, PluginContext } from './plugin/types';
import { Channels } from './plugin/channels';
import type { DeviceProfile } from './types';
import { MetricsBus } from '../metrics/MetricsBus';

export interface PipelineRunOptions {
  documentId: string;
  totalPages: number;
  signal?: AbortSignal;
  deviceProfile?: DeviceProfile;
  resumeFrom?: number[];
  concurrency?: number;
  onProgress?: (pageIndex: number, total: number, phase: string) => void;
}

export interface PagePipelineResult {
  pageIndex: number;
  imageData: ImageData;
  profile: import('../optimizer/types').PageProfile;
  optimizedImageData: ImageData;
  inkBefore: number;
  inkAfter: number;
  thumbnailUrl: string;
}

export class PipelineController {
  private registry: PluginRegistry;
  private scheduler: PipelineScheduler;
  private checkpoint: CheckpointManager;
  private metricsBus: MetricsBus;

  constructor(registry: PluginRegistry, metricsBus?: MetricsBus) {
    this.registry = registry;
    this.scheduler = new PipelineScheduler({ maxConcurrency: 4 });
    this.checkpoint = new CheckpointManager();
    this.metricsBus = metricsBus ?? new MetricsBus();
  }

  getScheduler(): PipelineScheduler {
    return this.scheduler;
  }

  getCheckpoint(): CheckpointManager {
    return this.checkpoint;
  }

  async runDocument(
    pdfBuffer: ArrayBuffer,
    options: PipelineRunOptions,
  ): Promise<{ pages: PagePipelineResult[]; totalMetrics: { durationMs: number; pagesPerSecond: number } }> {
    const t0 = performance.now();
    const { documentId, totalPages, signal: externalSignal, deviceProfile, resumeFrom } = options;

    this.metricsBus.emit({ type: 'pipeline:phase', timestamp: Date.now(), phase: 'start', documentId });
    const plugins = this.registry.getActivePipeline();
    const results: PagePipelineResult[] = [];
    const ac = new AbortController();

    if (externalSignal) {
      externalSignal.addEventListener('abort', () => ac.abort());
    }

    const ctx: PluginContext = {
      documentId,
      pageIndex: 0,
      totalPages,
      signal: ac.signal,
      metricsBus: this.metricsBus,
      progress: () => {},
      log: () => {},
    };

    const pagePlugins = plugins.filter(p =>
      p.manifest.outputChannel !== Channels.SHEET_COMPOSITION &&
      p.manifest.outputChannel !== Channels.PDF_DOCUMENT
    );

    const device: DeviceProfile = deviceProfile ?? {
      cores: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
      memoryGB: typeof navigator !== 'undefined' ? (navigator as any).deviceMemory || 4 : 4,
      isMobile: false, isTablet: false,
      supportsWASM: typeof WebAssembly !== 'undefined',
      supportsOffscreenCanvas: typeof OffscreenCanvas !== 'undefined',
      maxRenderDim: 2400,
    };
    const schedule = computeScheduleProfile(device);

    const pendingSet = new Set<number>();
    let completedPages = 0;
    let head = 1;
    const processedPages = new Set(resumeFrom ?? []);

    const scheduler = this.scheduler;
    const checkpoint = this.checkpoint;

    const processPage = (i: number): void => {
      pendingSet.add(i);
      scheduler.run(async () => {
        if (ac.signal.aborted) return;
        try {
          let data: any = pdfBuffer;
          for (const plugin of pagePlugins) {
            if (ac.signal.aborted) break;
            const t0 = performance.now();
            const pageCtx: PluginContext = {
              ...ctx,
              pageIndex: i,
              signal: ac.signal,
            };
            try {
              const result = await plugin.execute(data, pageCtx);
              data = result.data;
              this.metricsBus.emit({
                type: 'plugin:execute', timestamp: Date.now(),
                pluginId: plugin.manifest.id, pageIndex: i,
                durationMs: Math.round(performance.now() - t0),
              });
            } catch (err) {
              this.metricsBus.emit({
                type: 'plugin:error', timestamp: Date.now(),
                pluginId: plugin.manifest.id,
                errorMessage: String(err),
              });
              throw err;
            }
          }
          if (!ac.signal.aborted) {
            const pageResult = data as PagePipelineResult;
            pageResult.pageIndex = i;
            results.push(pageResult);
            completedPages++;
            await checkpoint.markPageDone(documentId, i);
            if (options.onProgress) {
              options.onProgress(completedPages, totalPages, 'Processing');
            }
          }
        } catch (err) {
          const failingPlugin = pagePlugins.find(p => !p.manifest.optional);
          if (failingPlugin) throw err;
        } finally {
          pendingSet.delete(i);
          scheduleNext();
        }
      }, i === 1 ? 1 : 0);
    };

    const scheduleNext = (): void => {
      while (head <= totalPages && !ac.signal.aborted) {
        if (processedPages.has(head)) { head++; continue; }
        if (pendingSet.size >= schedule.maxPagesInFlight) break;
        if (memoryGuard.isUnderPressure()) {
          this.metricsBus.emit({
            type: 'memory:pressure', timestamp: Date.now(),
            usedMB: memoryGuard.getCurrentMB(),
            limitMB: memoryGuard.getLimits().maxHeapMB,
          });
          break;
        }
        processPage(head++);
      }
    };

    scheduleNext();

    await new Promise<void>((resolve, reject) => {
      const check = setInterval(() => {
        if (ac.signal.aborted) {
          clearInterval(check);
          reject(new DOMException('Pipeline aborted', 'AbortError'));
          return;
        }
        if (pendingSet.size === 0 && head > totalPages) {
          clearInterval(check);
          resolve();
        }
      }, 50);
    });

    if (ac.signal.aborted) {
      throw new DOMException('Pipeline aborted', 'AbortError');
    }

    const batchPlugins = plugins.filter(p =>
      p.manifest.outputChannel === Channels.SHEET_COMPOSITION ||
      p.manifest.outputChannel === Channels.PDF_DOCUMENT
    );

    let batchData: any = results;
    for (const plugin of batchPlugins) {
      if (ac.signal.aborted) break;
      const batchCtx: PluginContext = {
        ...ctx,
        pageIndex: 0,
        signal: ac.signal,
      };
      try {
        const result = await plugin.execute(batchData, batchCtx);
        batchData = result.data;
      } catch (err) {
        if (plugin.manifest.optional) continue;
        throw err;
      }
    }

    results.sort((a, b) => a.pageIndex - b.pageIndex);
    const totalMs = performance.now() - t0;

    this.metricsBus.emit({
      type: 'pipeline:phase', timestamp: Date.now(), durationMs: Math.round(totalMs),
      phase: 'complete', documentId,
    });

    return {
      pages: results,
      totalMetrics: {
        durationMs: Math.round(totalMs),
        pagesPerSecond: Number((totalPages / (totalMs / 1000)).toFixed(2)),
      },
    };
  }

  abort(): void {
    this.scheduler.abort();
  }
}
