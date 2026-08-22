'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { metricsBus } from '../../lib/metrics/MetricsBus';
import type { MetricsSnapshot } from '../../lib/metrics/types';

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-faint">{label}</span>
      <span className="text-ink font-semibold">{value}</span>
    </div>
  );
}

interface MetricsPanelProps {
  defaultOpen?: boolean;
}

function MetricsPanel({ defaultOpen = false }: MetricsPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [snapshot, setSnapshot] = useState<MetricsSnapshot>(() => metricsBus.snapshot());

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      setSnapshot(metricsBus.snapshot());
    }, 500);
    return () => clearInterval(interval);
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-mono text-ink shadow-lg border border-elevated hover:bg-elevated"
      >
        Metrics
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 rounded-xl border border-elevated bg-surface/95 p-3 shadow-2xl backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold text-ink">Metrics Panel</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-0.5 text-ink-faint hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-1.5 text-[11px] font-mono">
        <Row label="Pages processed" value={snapshot.pagesProcessed} />
        <Row label="Avg ink saved" value={`${snapshot.avgInkSavedPct.toFixed(1)}%`} />
        <Row label="Avg time/page" value={`${snapshot.avgProcessingTimeMs}ms`} />
        <Row label="Peak memory" value={`${snapshot.peakMemoryMB}MB`} />
        <Row label="Worker crashes" value={snapshot.workerCrashes} />
        <Row label="Elapsed" value={`${(snapshot.totalElapsedMs / 1000).toFixed(1)}s`} />
      </div>

      <button
        type="button"
        onClick={() => metricsBus.clearHistory()}
        className="mt-2 w-full rounded border border-elevated py-1 text-[10px] text-ink-faint hover:text-ink"
      >
        Clear
      </button>
    </div>
  );
}

export function DevMetricsPanel(props: MetricsPanelProps) {
  if (process.env.NODE_ENV === 'production') return null;
  return <MetricsPanel {...props} />;
}
