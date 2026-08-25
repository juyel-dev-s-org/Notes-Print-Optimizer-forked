'use client';

import React from 'react';
import { AlertCircle, Check, FileText, Loader2, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { resolveRange } from '@/lib/shared/range';
import { planChunks, planEvenChunks } from '@/lib/shared/chunks';
import type { SplitMode } from '@/lib/tosplit/splitReducer';
import type { SplitWorkflow } from '@/lib/tosplit/useSplitWorkflow';

const MODES: Array<{ id: SplitMode; label: string; hint: string }> = [
  { id: 'extract', label: 'Extract Range', hint: 'One range → one PDF' },
  { id: 'every', label: 'Split Every N', hint: 'Burst into fixed parts' },
  { id: 'parts', label: 'Into N Parts', hint: 'Divide evenly' },
];

/** Mode selector + range/per-file controls with a live output preview. */
export const SplitOptionsView: React.FC<{ workflow: SplitWorkflow }> = ({ workflow }) => {
  const {
    state,
    canRun,
    handleRun,
    handleCancelRun,
    handleSetMode,
    handleSetRangeFrom,
    handleSetRangeTo,
    handleSetPerFile,
    handleSetPartCount,
    handleReset,
  } = workflow;
  const busy = state.isBusy;

  const rangeInvalid =
    state.mode === 'extract' &&
    state.pageCount !== null &&
    resolveRange('custom', state.rangeFrom, state.rangeTo, state.pageCount) === null;

  const perFileNum = Number.parseInt(state.perFile, 10);
  const partCountNum = Number.parseInt(state.partCount, 10);
  const chunks =
    state.mode === 'every' && Number.isFinite(perFileNum) && perFileNum >= 1 && state.pageCount
      ? planChunks(state.pageCount, perFileNum)
      : state.mode === 'parts' && Number.isFinite(partCountNum) && partCountNum >= 1 && state.pageCount
        ? planEvenChunks(state.pageCount, partCountNum)
        : [];
  const preview =
    state.mode === 'extract'
      ? (() => {
          const r = resolveRange('custom', state.rangeFrom, state.rangeTo, state.pageCount);
          return r ? `1 file · ${r.end - r.start + 1} pages` : '';
        })()
      : chunks.length > 0
        ? `${chunks.length} file${chunks.length === 1 ? '' : 's'} · ${state.pageCount} pages · sizes ${chunks
            .map((c) => c.end - c.start + 1)
            .join('·')}`
        : '';

  return (
    <div className="flex flex-col gap-4">
      {/* Source summary */}
      <div className="flex items-center gap-3 rounded-2xl border border-surface-2 bg-surface/80 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary-faint/60 text-primary-soft">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{state.source?.name}</p>
          <p className="text-xs tabular-nums text-ink-muted">
            {state.source?.sizeMB} MB
            {state.pageCount !== null ? ` · ${state.pageCount} page${state.pageCount === 1 ? '' : 's'}` : ' · reading…'}
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-surface-2 bg-surface/80 p-4" aria-busy={busy}>
        <h3 className="text-sm font-bold tracking-wide text-ink">Split Mode</h3>

        {/* Mode cards */}
        <div role="radiogroup" aria-label="Split mode" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {MODES.map((m) => {
            const active = state.mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={busy}
                onClick={() => handleSetMode(m.id)}
                className={`flex flex-col gap-0.5 rounded-xl border px-3 py-3 text-left transition-colors ${
                  active ? 'border-primary/50 bg-primary-faint/50' : 'border-elevated bg-surface hover:bg-surface-2/50'
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
                  <Scissors className={`h-3.5 w-3.5 ${active ? 'text-primary-soft' : 'text-ink-muted'}`} aria-hidden="true" />
                  {m.label}
                </span>
                <span className="text-xs text-ink-muted">{m.hint}</span>
              </button>
            );
          })}
        </div>

        {/* Extract controls */}
        {state.mode === 'extract' && (
          <div className="flex flex-col gap-2 animate-enter">
            <p className="text-[11px] font-bold tracking-wide text-ink-muted">Pages to extract</p>
            <div className="flex items-center gap-2">
              {(['From', 'To'] as const).map((label) => {
                const value = label === 'From' ? state.rangeFrom : state.rangeTo;
                const onChange = label === 'From' ? handleSetRangeFrom : handleSetRangeTo;
                return (
                  <React.Fragment key={label}>
                    {label === 'To' && <span aria-hidden="true" className="text-xs font-bold text-ink-muted">to</span>}
                    <div className="flex flex-1 items-center rounded-xl border border-elevated bg-surface/80 px-3 focus-within:border-primary/50">
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={busy}
                        placeholder={label}
                        aria-label={`${label} page`}
                        className="h-10 w-full min-w-0 bg-transparent text-sm font-semibold tabular-nums text-ink placeholder:font-normal placeholder:text-ink-faint focus:outline-none"
                      />
                    </div>
                  </React.Fragment>
                );
              })}
              <span className="shrink-0 text-xs tabular-nums text-ink-muted">of {state.pageCount ?? '…'}</span>
            </div>
            {rangeInvalid && (
              <p className="text-[11px] font-semibold text-warning-strong">
                Enter a valid range between 1 and {state.pageCount}.
              </p>
            )}
          </div>
        )}

        {/* Burst controls */}
        {state.mode === 'every' && (
          <div className="flex flex-col gap-2 animate-enter">
            <p className="text-[11px] font-bold tracking-wide text-ink-muted">Pages per file</p>
            <div className="flex items-center rounded-xl border border-elevated bg-surface/80 px-3 focus-within:border-primary/50 sm:max-w-[200px]">
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={state.perFile}
                onChange={(e) => handleSetPerFile(e.target.value)}
                disabled={busy}
                placeholder="e.g. 5"
                aria-label="Pages per file"
                className="h-10 w-full min-w-0 bg-transparent text-sm font-semibold tabular-nums text-ink placeholder:font-normal placeholder:text-ink-faint focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Even-parts controls */}
        {state.mode === 'parts' && (
          <div className="flex flex-col gap-2 animate-enter">
            <p className="text-[11px] font-bold tracking-wide text-ink-muted">Number of parts</p>
            <div className="flex items-center rounded-xl border border-elevated bg-surface/80 px-3 focus-within:border-primary/50 sm:max-w-[200px]">
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={state.partCount}
                onChange={(e) => handleSetPartCount(e.target.value)}
                disabled={busy}
                placeholder="e.g. 4"
                aria-label="Number of parts"
                className="h-10 w-full min-w-0 bg-transparent text-sm font-semibold tabular-nums text-ink placeholder:font-normal placeholder:text-ink-faint focus:outline-none"
              />
            </div>
            {partCountNum === 1 && (
              <p className="text-[11px] font-semibold text-warning-strong">Enter at least 2 parts.</p>
            )}
          </div>
        )}

        {/* Live output preview */}
        {!busy && preview && (
          <p className="rounded-lg bg-surface-2/60 px-3 py-2 text-xs tabular-nums text-ink-muted">
            Output: <span className="font-bold text-ink">{preview}</span>
          </p>
        )}

        {busy ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-primary/30 bg-primary-faint/30 px-4 py-6 animate-enter">
            {state.progress && state.progress.pct >= 100 ? (
              <Check className="h-7 w-7 text-primary-soft" aria-hidden="true" />
            ) : (
              <Loader2 className="h-7 w-7 animate-spin text-primary-soft" aria-hidden="true" />
            )}
            <p className="text-sm font-bold text-ink">{state.progress?.label}</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{ width: `${Math.max(6, state.progress?.pct ?? 8)}%`, background: 'var(--gradient-brand)' }}
              />
            </div>
            <Button variant="danger" size="md" onClick={handleCancelRun}>
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <Button size="lg" fullWidth disabled={!canRun} onClick={handleRun}>
              <Scissors className="h-4 w-4" aria-hidden="true" />
              {state.mode === 'extract' ? 'Extract Pages' : 'Split PDF'}
            </Button>
            {!canRun && state.pageCount === null && (
              <p className="-mt-2 text-center text-2xs font-semibold text-ink-faint">Reading page count…</p>
            )}
            <Button variant="ghost" size="md" fullWidth onClick={handleReset}>
              Choose a different file
            </Button>
          </>
        )}
      </section>

      {state.error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-800/70 bg-red-950/60 px-4 py-3 text-xs text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      )}
    </div>
  );
};
