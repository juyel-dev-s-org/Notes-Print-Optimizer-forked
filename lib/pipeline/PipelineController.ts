/**
 * PipelineController - Event-driven page pipeline with retry & memory awareness.
 */
import { PluginRegistry } from './PluginRegistry';
import { PipelineScheduler } from './PipelineScheduler';
import { memoryGuard } from './MemoryGuard';
import { CheckpointManager } from './checkpoint/CheckpointManager';
import { computeScheduleProfile } from './types';
import type { PluginContext } from './plugin/types';
import { Channels } from './plugin/channels';
import type { DeviceProfile } from './types';
import { MetricsBus } from '../metrics/MetricsBus';

type NavigatorWithMemory = Navigator & { deviceMemory?: number };

export interface PipelineRunOptions { documentId: string; totalPages: number; signal?: AbortSignal; deviceProfile?: DeviceProfile; resumeFrom?: number[]; concurrency?: number; maxPageRetries?: number; onProgress?: (pageIndex: number, total: number, phase: string) => void; }
export interface PagePipelineResult { pageIndex: number; imageData: ImageData; profile: import('../optimizer/types').PageProfile; optimizedImageData: ImageData; inkBefore: number; inkAfter: number; thumbnailUrl?: string; }

const DEFAULT_PAGE_RETRIES = 2;

export class PipelineController {
  private registry: PluginRegistry;
  private scheduler: PipelineScheduler;
  private checkpoint: CheckpointManager;
  private metricsBus: MetricsBus;
  private disposed = false;

  constructor(registry: PluginRegistry, metricsBus?: MetricsBus) {
    this.registry = registry;
    this.scheduler = new PipelineScheduler({ maxConcurrency: 4, maxRetries: 0 });
    this.checkpoint = new CheckpointManager();
    this.metricsBus = metricsBus ?? new MetricsBus();
  }

  getScheduler(): PipelineScheduler { return this.scheduler; }
  getCheckpoint(): CheckpointManager { return this.checkpoint; }
  getMetricsBus(): MetricsBus { return this.metricsBus; }

  async runDocument(pdfBuffer: ArrayBuffer, options: PipelineRunOptions): Promise<{ pages: PagePipelineResult[]; totalMetrics: { durationMs: number; pagesPerSecond: number } }> {
    if (this.disposed) throw new Error('PipelineController has been disposed');
    const t0 = performance.now();
    const { documentId, totalPages, signal: externalSignal, deviceProfile, resumeFrom, maxPageRetries = DEFAULT_PAGE_RETRIES } = options;
    this.metricsBus.emit({ type: 'pipeline:phase', timestamp: Date.now(), phase: 'start', documentId });
    const plugins = this.registry.getActivePipeline();
    const results: PagePipelineResult[] = [];
    const ac = new AbortController();
    const onExternalAbort = () => ac.abort();
    if (externalSignal) { if (externalSignal.aborted) throw new DOMException('Pipeline aborted', 'AbortError'); externalSignal.addEventListener('abort', onExternalAbort, { once: true }); }
    const ctx: PluginContext = { documentId, pageIndex: 0, totalPages, signal: ac.signal, metricsBus: this.metricsBus, progress: () => {}, log: () => {} };
    const pagePlugins = plugins.filter(p => p.manifest.outputChannel !== Channels.SHEET_COMPOSITION && p.manifest.outputChannel !== Channels.PDF_DOCUMENT);
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    const device: DeviceProfile = deviceProfile ?? { cores: nav?.hardwareConcurrency || 4, memoryGB: (nav as NavigatorWithMemory)?.deviceMemory || 4, isMobile: false, isTablet: false, supportsWASM: typeof WebAssembly !== 'undefined', supportsOffscreenCanvas: typeof OffscreenCanvas !== 'undefined', maxRenderDim: 2400 };
    const schedule = computeScheduleProfile(device);
    const processedPages = new Set(resumeFrom ?? []);
    let completedCount = 0; let failedCount = 0; let head = 1;
    const pendingSet = new Set<number>();
    let resolveCompletion!: () => void; let rejectCompletion!: (err: Error) => void;
    const completionPromise = new Promise<void>((resolve, reject) => { resolveCompletion = resolve; rejectCompletion = reject; });

    const checkCompletion = (): void => {
      if (ac.signal.aborted) { rejectCompletion(new DOMException('Pipeline aborted', 'AbortError')); return; }
      if (pendingSet.size === 0 && head > totalPages) { if (failedCount > totalPages * 0.5) rejectCompletion(new Error(`Pipeline failed: ${failedCount}/${totalPages} pages errored`)); else resolveCompletion(); }
    };

    const processPage = (i: number): void => {
      pendingSet.add(i);
      this.scheduler.run(async () => {
        if (ac.signal.aborted) return;
        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= maxPageRetries; attempt++) {
          if (ac.signal.aborted) return;
          try {
            let data: unknown = pdfBuffer;
            for (const plugin of pagePlugins) {
              if (ac.signal.aborted) return;
              const pluginT0 = performance.now();
              const pageCtx: PluginContext = { ...ctx, pageIndex: i, signal: ac.signal };
              const result = await plugin.execute(data, pageCtx);
              data = result.data;
              this.metricsBus.emit({ type: 'plugin:execute', timestamp: Date.now(), pluginId: plugin.manifest.id, pageIndex: i, durationMs: Math.round(performance.now() - pluginT0) });
            }
            if (!ac.signal.aborted) { const pageResult = data as PagePipelineResult; pageResult.pageIndex = i; results.push(pageResult); completedCount++; await this.checkpoint.markPageDone(documentId, i); options.onProgress?.(completedCount, totalPages, 'Processing'); }
            lastError = null; break;
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            this.metricsBus.emit({ type: 'plugin:error', timestamp: Date.now(), pluginId: 'pipeline', errorMessage: `[Page ${i}] Attempt ${attempt + 1}: ${lastError.message}` });
            if (ac.signal.aborted || lastError.name === 'AbortError') return;
            if (attempt < maxPageRetries) await new Promise(r => setTimeout(r, 150 * Math.pow(2, attempt) + Math.random() * 50));
          }
        }
        if (lastError) failedCount++;
      }, i === 1 ? 10 : 0).finally(() => { pendingSet.delete(i); scheduleNext(); checkCompletion(); });
    };

    const scheduleNext = (): void => {
      while (head <= totalPages && !ac.signal.aborted) {
        if (processedPages.has(head)) { head++; continue; }
        if (pendingSet.size >= schedule.maxPagesInFlight) break;
        if (memoryGuard.isUnderPressure()) { this.metricsBus.emit({ type: 'memory:pressure', timestamp: Date.now(), usedMB: memoryGuard.getCurrentMB(), limitMB: memoryGuard.getLimits().maxHeapMB }); setTimeout(scheduleNext, 100); break; }
        processPage(head++);
      }
    };

    scheduleNext();
    try { await completionPromise; } catch (err) { if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort); throw err; }
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);

    const batchPlugins = plugins.filter(p => p.manifest.outputChannel === Channels.SHEET_COMPOSITION || p.manifest.outputChannel === Channels.PDF_DOCUMENT);
    let batchData: unknown = results;
    for (const plugin of batchPlugins) { if (ac.signal.aborted) break; const batchCtx: PluginContext = { ...ctx, pageIndex: 0, signal: ac.signal }; try { const result = await plugin.execute(batchData, batchCtx); batchData = result.data; } catch (err) { if (plugin.manifest.optional) continue; throw err; } }

    results.sort((a, b) => a.pageIndex - b.pageIndex);
    const totalMs = performance.now() - t0;
    this.metricsBus.emit({ type: 'pipeline:phase', timestamp: Date.now(), durationMs: Math.round(totalMs), phase: 'complete', documentId });
    return { pages: results, totalMetrics: { durationMs: Math.round(totalMs), pagesPerSecond: Number((totalPages / (totalMs / 1000)).toFixed(2)) } };
  }

  abort(): void { this.scheduler.abort(); }
  dispose(): void { this.disposed = true; this.scheduler.abort(); }
}
