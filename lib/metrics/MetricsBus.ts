import type { MetricEvent, MetricEventType, MetricEventListener, MetricsSnapshot, PageProcessedEvent, MemoryPressureEvent } from './types';

type ListenerMap = Map<MetricEventType, Set<MetricEventListener>>;

export class MetricsBus {
  private listeners: ListenerMap = new Map();
  private history: MetricEvent[] = [];
  private maxHistory: number;

  constructor(maxHistory = 500) {
    this.maxHistory = maxHistory;
  }

  on(type: MetricEventType, listener: MetricEventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
    return () => this.listeners.get(type)?.delete(listener);
  }

  emit(event: MetricEvent): void {
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        try { listener(event); } catch { /* swallow */ }
      }
    }
  }

  getHistory(): readonly MetricEvent[] {
    return this.history;
  }

  clearHistory(): void {
    this.history = [];
  }

  snapshot(): MetricsSnapshot {
    const pagesProcessed = this.history.filter(e => e.type === 'page:processed') as PageProcessedEvent[];
    const totalInkSaved = pagesProcessed.reduce((sum, ev) => sum + (ev.inkBeforePct - ev.inkAfterPct), 0);
    const avgTime = pagesProcessed.length > 0
      ? pagesProcessed.reduce((s, ev) => s + (ev.durationMs ?? 0), 0) / pagesProcessed.length
      : 0;
    const peakMemEvents = this.history.filter(e => e.type === 'memory:pressure') as MemoryPressureEvent[];
    const peakMem = peakMemEvents.length > 0 ? Math.max(...peakMemEvents.map(e => e.usedMB)) : 0;
    const workerCrashes = this.history.filter(e => e.type === 'worker:crashed').length;
    const firstEvent = this.history[0];
    const lastEvent = this.history[this.history.length - 1];
    const totalElapsed = firstEvent && lastEvent ? lastEvent.timestamp - firstEvent.timestamp : 0;

    return {
      pagesProcessed: pagesProcessed.length,
      avgInkSavedPct: pagesProcessed.length > 0 ? totalInkSaved / pagesProcessed.length : 0,
      avgProcessingTimeMs: Math.round(avgTime),
      peakMemoryMB: Math.round(peakMem),
      workerCrashes,
      totalElapsedMs: Math.round(totalElapsed),
    };
  }
}

export const metricsBus = new MetricsBus();
