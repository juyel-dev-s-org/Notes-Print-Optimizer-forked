'use client';

import React from 'react';
import { AlertCircle, Ban, Check, FileText, Images, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SliderRow } from '@/components/ui/Slider';
import { DPI_PRESETS, type DpiPresetId, type ImagesFormat } from '@/lib/toimages/imagesReducer';
import { FORMAT_EXT } from '@/lib/toimages/imagesConverter';
import type { ImagesWorkflow } from '@/lib/toimages/useImagesWorkflow';

const FORMATS: Array<{ id: ImagesFormat; label: string }> = [
  { id: 'image/jpeg', label: 'JPG' },
  { id: 'image/png', label: 'PNG' },
  { id: 'image/webp', label: 'WebP' },
];

/** Resolution radio-cards + format segmented control + quality + CTA. */
export const ImagesOptionsView: React.FC<{ workflow: ImagesWorkflow }> = ({ workflow }) => {
  const { state, handleConvert, handleCancelConvert, handleSetDpi, handleSetFormat, handleSetQuality, handleReset } =
    workflow;
  const busy = state.isBusy;
  const pct = state.progress ? Math.round((state.progress.current / Math.max(1, state.progress.total)) * 100) : 0;

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
        <h3 className="text-sm font-bold tracking-wide text-ink">Image Quality &amp; Resolution</h3>

        {/* Resolution presets */}
        <div role="radiogroup" aria-label="Resolution" className="flex flex-col gap-2">
          {DPI_PRESETS.map((preset) => {
            const active = state.dpi === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={busy}
                onClick={() => handleSetDpi(preset.id as DpiPresetId)}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                  active ? 'border-primary/50 bg-primary-faint/50' : 'border-elevated bg-surface hover:bg-surface-2/50'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    active ? 'border-primary-strong bg-primary-strong text-white' : 'border-elevated'
                  }`}
                  aria-hidden="true"
                >
                  {active && <Check className="h-3 w-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">
                    {preset.label} <span className="font-normal text-ink-muted">({preset.dpi} DPI)</span>
                  </span>
                  <span className="block text-xs text-ink-muted">{preset.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Format segmented control */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold tracking-wide text-ink-muted">Output format</p>
          <div role="radiogroup" aria-label="Output format" className="flex rounded-xl border border-elevated bg-elevated/40 p-1">
            {FORMATS.map((f) => {
              const active = state.format === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={busy}
                  onClick={() => handleSetFormat(f.id)}
                  className={`h-9 flex-1 rounded-lg text-xs font-bold transition-all ${
                    active ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {state.format !== 'image/png' && (
          <SliderRow
            label="Image quality"
            hint={`${Math.round(state.quality * 100)}% — higher looks sharper, weighs more`}
            value={Math.round(state.quality * 100)}
            min={50}
            max={98}
            onChange={(v) => handleSetQuality(v / 100)}
          />
        )}

        {busy ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-primary/30 bg-primary-faint/30 px-4 py-6 animate-enter">
            {pct < 100 ? (
              <Loader2 className="h-7 w-7 animate-spin text-primary-soft" aria-hidden="true" />
            ) : (
              <Images className="h-7 w-7 text-primary-soft" aria-hidden="true" />
            )}
            <p className="text-sm font-bold text-ink">Rendering pages…</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{ width: `${Math.max(4, pct)}%`, background: 'var(--gradient-brand)' }}
              />
            </div>
            <p className="text-xs tabular-nums text-ink-muted">
              Page {state.progress?.current ?? 0} of {state.progress?.total ?? 0} · keep this tab open
            </p>
            <Button variant="danger" size="md" onClick={handleCancelConvert}>
              <Ban className="h-4 w-4" aria-hidden="true" />
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <Button size="lg" fullWidth disabled={!state.source} onClick={handleConvert}>
              {!busy && <Images className="h-4 w-4" aria-hidden="true" />}
              Convert to {FORMAT_EXT[state.format].toUpperCase()}
            </Button>
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
