'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Ban, Check, Download, LayoutGrid, Loader2, RotateCcw, Share2, Wand2 } from 'lucide-react';
import { ENHANCE_SETTING_RANGE, type EnhanceSettings } from '@/lib/enhance/types';
import type { EnhanceWorkflow } from '@/lib/enhance/useEnhanceWorkflow';
import { Button } from '@/components/ui/Button';
import { SliderRow } from '@/components/ui/Slider';
import { ToggleRow } from '@/components/ui/Toggle';

export interface EnhanceWorkbenchViewProps {
  workflow: EnhanceWorkflow;
  /** Bridges the enhanced pages into the main pipeline's N-Up layout. */
  onChooseLayout?: () => void;
}

export const EnhanceWorkbenchView: React.FC<EnhanceWorkbenchViewProps> = ({ workflow, onChooseLayout }) => {
  const {
    state,
    handleSetSettings,
    handleSetSelected,
    handleApplySettings,
    handleCancelProcessing,
    handleDownloadPrintPdf,
    handleSharePdf,
    handleReset,
    handleBackToArrange,
  } = workflow;
  const [showBefore, setShowBefore] = useState(false);
  const [appliedSettings, setAppliedSettings] = useState<EnhanceSettings>(state.settings);
  const selected = state.results[state.selectedIndex];

  useEffect(() => {
    if (state.results.length > 0 && !state.isProcessing) {
      setAppliedSettings(state.settings);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when processing finishes, not on every slider change
  }, [state.results.length, state.isProcessing]);

  const isDirty =
    state.results.length === 0 ||
    appliedSettings.darken !== state.settings.darken ||
    appliedSettings.contrast !== state.settings.contrast ||
    appliedSettings.sharpen !== state.settings.sharpen ||
    appliedSettings.cleanBackground !== state.settings.cleanBackground ||
    appliedSettings.grayscale !== state.settings.grayscale;

  const updateSetting = <K extends keyof EnhanceSettings>(key: K, value: EnhanceSettings[K]) => {
    handleSetSettings({ ...state.settings, [key]: value });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Escape hatch back to the arrange stage (invalidates stale results) */}
      {!state.isProcessing && (
        <button
          type="button"
          onClick={handleBackToArrange}
          className="flex h-9 items-center justify-center gap-1.5 self-start rounded-lg border border-elevated/60 bg-surface/70 px-3 text-[11px] font-bold text-ink-muted transition-colors hover:border-primary/50 hover:text-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-soft"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Adjust File Order
        </button>
      )}

      {/* Processing progress */}
      {state.isProcessing && state.results.length === 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-surface-2 bg-surface/80 p-5 animate-enter">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <Loader2 className="h-4 w-4 animate-spin text-primary-soft" aria-hidden="true" />
            Enhancing pages…
          </div>
          {state.progress && (
            <>
              <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{
                    width: `${Math.max(4, (state.progress.current / Math.max(1, state.progress.total)) * 100)}%`,
                    background: 'var(--gradient-brand)',
                  }}
                />
              </div>
              <p className="truncate text-xs tabular-nums text-ink-muted">
                {state.progress.phase} · {state.progress.current}/{state.progress.total}
              </p>
            </>
          )}
          <Button variant="danger" fullWidth onClick={handleCancelProcessing}>
            <Ban className="h-4 w-4" />
            Cancel
          </Button>
        </div>
      )}

      {/* Settings */}
      <div className="flex flex-col gap-4 rounded-2xl border border-surface-2 bg-surface/80 p-4">
        <h3 className="text-sm font-bold tracking-wide text-ink">Enhancement Settings</h3>
        <SliderRow label="Darken Ink" hint="Push faint pencil/ink toward black" value={state.settings.darken} min={ENHANCE_SETTING_RANGE.darken[0]} max={ENHANCE_SETTING_RANGE.darken[1]} onChange={(v) => updateSetting('darken', v)} />
        <SliderRow label="Contrast" hint="Remove flat gray from scanned paper" value={state.settings.contrast} min={ENHANCE_SETTING_RANGE.contrast[0]} max={ENHANCE_SETTING_RANGE.contrast[1]} onChange={(v) => updateSetting('contrast', v)} />
        <SliderRow label="Sharpen" hint="Crisp handwriting edges" value={state.settings.sharpen} min={ENHANCE_SETTING_RANGE.sharpen[0]} max={ENHANCE_SETTING_RANGE.sharpen[1]} onChange={(v) => updateSetting('sharpen', v)} />
        <div className="flex flex-col divide-y divide-surface-2/70 border-t border-surface-2/70 pt-2">
          <ToggleRow label="Clean Background" hint="Map paper tint & camera shadows to pure white" enabled={state.settings.cleanBackground} onChange={(v) => updateSetting('cleanBackground', v)} />
          <ToggleRow label="Grayscale" hint="Monochrome output — maximum print contrast" enabled={state.settings.grayscale} onChange={(v) => updateSetting('grayscale', v)} />
        </div>
        <Button
          size="lg"
          fullWidth
          onClick={handleApplySettings}
          loading={state.isProcessing}
          disabled={(!isDirty && state.results.length > 0) || state.exportBusy}
        >
          {!state.isProcessing && (isDirty ? <Wand2 className="h-4 w-4" /> : <Check className="h-4 w-4" />)}
          {state.isProcessing ? 'Enhancing…' : isDirty ? 'Apply & Re-Enhance' : 'Up to date'}
        </Button>
      </div>

      {/* Preview */}
      {selected && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-wide text-ink">
              Preview <span className="font-normal text-ink-muted">· page {selected.index + 1} of {state.results.length}</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowBefore((b) => !b)}
              aria-pressed={showBefore}
              className={`inline-flex h-11 items-center rounded-full border px-3.5 text-xs font-bold transition-colors ${
                showBefore
                  ? 'border-primary/50 bg-primary-faint text-primary-soft'
                  : 'border-elevated bg-surface text-ink'
              }`}
            >
              {showBefore ? 'Showing BEFORE' : 'Showing AFTER'}
            </button>
          </div>

          <div
            className="relative select-none overflow-hidden rounded-2xl border border-surface-2 bg-surface/80"
            onPointerDown={() => setShowBefore(true)}
            onPointerUp={() => setShowBefore(false)}
            onPointerLeave={() => setShowBefore(false)}
            onTouchStart={() => setShowBefore(true)}
            onTouchEnd={() => setShowBefore(false)}
          >
            <img
              src={showBefore ? selected.originalDataUrl : selected.dataUrl}
              alt={`Enhanced page ${selected.index + 1}`}
              className="h-auto w-full"
              loading="lazy"
              draggable={false}
            />
            <span
              className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold tracking-wide ${
                showBefore ? 'bg-warning-strong/90 text-warning-faint' : 'bg-success-strong/90 text-success-faint'
              }`}
            >
              {showBefore ? 'BEFORE' : 'AFTER'}
            </span>
            <span className="absolute bottom-3 right-3 rounded-full bg-surface/80 px-2 py-1 text-xs font-medium text-ink backdrop-blur">
              Hold to see before
            </span>
          </div>

          {state.results.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Pages">
              {state.results.map((page) => (
                <button
                  key={page.index}
                  type="button"
                  role="tab"
                  aria-selected={state.selectedIndex === page.index}
                  onClick={() => { handleSetSelected(page.index); setShowBefore(false); }}
                  className={`relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                    state.selectedIndex === page.index ? 'border-primary' : 'border-elevated/80'
                  }`}
                >
                  <img src={page.dataUrl} alt={`Page ${page.index + 1} thumbnail`} className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sticky action bar — download left, layout right; safe-area aware */}
      {!state.isProcessing && state.results.length > 0 && (
        <div className="sticky bottom-0 z-20 -mx-4 border-t border-surface-2 bg-bg/95 px-4 pt-3 backdrop-blur-md" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className={`grid gap-2 ${onChooseLayout ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <Button size="lg" loading={state.exportBusy} onClick={handleDownloadPrintPdf}>
              {!state.exportBusy && <Download className="h-4 w-4" />}
              {state.exportBusy ? 'Building…' : 'Download PDF'}
            </Button>
            {onChooseLayout && (
              <button
                type="button"
                onClick={onChooseLayout}
                disabled={state.exportBusy}
                style={{ background: 'var(--gradient-brand)' }}
                className="flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white shadow-md shadow-primary/25 transition-transform duration-150 active:scale-[0.98] disabled:opacity-50"
              >
                <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                Choose Layout
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center justify-center gap-5">
            {state.pdfBlob && typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={handleSharePdf}
                className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-[11px] font-bold text-accent-soft transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-soft"
              >
                <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                Share PDF
              </button>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-[11px] font-bold text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-soft"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Start Over with New PDFs
            </button>
          </div>
        </div>
      )}

      {state.error && (
        <div role="alert" className="rounded-xl border border-red-800/70 bg-red-950/60 px-4 py-3 text-xs text-red-200">
          {state.error}
        </div>
      )}
    </div>
  );
};