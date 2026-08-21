'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Wand2, Ban, Download, Check } from 'lucide-react';
import { ENHANCE_SETTING_RANGE, type EnhanceSettings } from '@/lib/enhance/types';
import type { EnhanceWorkflow } from '@/lib/enhance/useEnhanceWorkflow';

const AURORA = 'linear-gradient(90deg, #243BFF 0%, #5B35FF 55%, #A12CFF 100%)';

const SliderRow: React.FC<{
  label: string;
  hint: string;
  value: number;
  range: readonly [number, number];
  onChange: (v: number) => void;
}> = ({ label, hint, value, range, onChange }) => {
  const [min, max] = range;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[13px] font-bold text-slate-100">{label}</span>
          <span className="text-[10px] text-slate-500">{hint}</span>
        </div>
        <span className="rounded-md bg-[#5B35FF]/20 px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#a78bfa] border border-[#5B35FF]/30">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-elevated py-2
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:h-6
          [&::-webkit-slider-thumb]:w-6
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-[#5B35FF]
          [&::-webkit-slider-thumb]:shadow-md
          [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-[#a78bfa]
          [&::-moz-range-thumb]:h-6
          [&::-moz-range-thumb]:w-6
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-[#5B35FF]
          [&::-moz-range-thumb]:border-2
          [&::-moz-range-thumb]:border-[#a78bfa]"
        style={{ background: `linear-gradient(to right, #5B35FF ${pct}%, var(--color-elevated) ${pct}%)` }}
      />
    </div>
  );
};

const ToggleRow: React.FC<{
  label: string;
  hint: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, hint, enabled, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    aria-label={label}
    onClick={() => onChange(!enabled)}
    className="flex w-full min-h-[48px] items-center justify-between gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#818cf8]"
  >
    <span className="flex flex-col">
      <span className="text-[13px] font-bold text-slate-100">{label}</span>
      <span className="text-[10px] text-slate-500">{hint}</span>
    </span>
    <span
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150 ${
        enabled ? 'bg-[#5B35FF]' : 'bg-elevated'
      }`}
      aria-hidden="true"
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-150 ${
          enabled ? 'left-6' : 'left-1'
        }`}
      />
    </span>
  </button>
);

export const EnhanceWorkbenchView: React.FC<{ workflow: EnhanceWorkflow }> = ({ workflow }) => {
  const { state, handleSetSettings, handleSetSelected, handleApplySettings, handleCancelProcessing, handleExport } = workflow;
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
      {/* Processing progress */}
      {state.isProcessing && state.results.length === 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-800/70 bg-slate-900/70 p-5">
          <div className="flex items-center gap-2 text-[13px] font-bold text-white">
            <Loader2 className="h-4 w-4 animate-spin text-[#a78bfa]" aria-hidden="true" />
            Enhancing pages…
          </div>
          {state.progress && (
            <>
              <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${Math.max(4, (state.progress.current / Math.max(1, state.progress.total)) * 100)}%`, background: AURORA }}
                />
              </div>
              <p className="truncate text-[11px] tabular-nums text-slate-400">
                {state.progress.phase} · {state.progress.current}/{state.progress.total}
              </p>
            </>
          )}
          <button
            type="button"
            onClick={handleCancelProcessing}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-red-800/60 bg-red-950/40 text-xs font-bold text-red-300 transition-transform duration-150 active:scale-[0.98]"
          >
            <Ban className="h-4 w-4" />
            Cancel
          </button>
        </div>
      )}

      {/* Settings */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4">
        <h3 className="text-[13px] font-bold tracking-wide text-white">Enhancement Settings</h3>
        <SliderRow label="Darken Ink" hint="Push faint pencil/ink toward black" value={state.settings.darken} range={ENHANCE_SETTING_RANGE.darken} onChange={(v) => updateSetting('darken', v)} />
        <SliderRow label="Contrast" hint="Remove flat gray from scanned paper" value={state.settings.contrast} range={ENHANCE_SETTING_RANGE.contrast} onChange={(v) => updateSetting('contrast', v)} />
        <SliderRow label="Sharpen" hint="Crisp handwriting edges" value={state.settings.sharpen} range={ENHANCE_SETTING_RANGE.sharpen} onChange={(v) => updateSetting('sharpen', v)} />
        <div className="flex flex-col divide-y divide-slate-800/70 border-t border-slate-800/70 pt-2">
          <ToggleRow label="Clean Background" hint="Map paper tint & camera shadows to pure white" enabled={state.settings.cleanBackground} onChange={(v) => updateSetting('cleanBackground', v)} />
          <ToggleRow label="Grayscale" hint="Monochrome output — maximum print contrast" enabled={state.settings.grayscale} onChange={(v) => updateSetting('grayscale', v)} />
        </div>
        <button
          type="button"
          onClick={handleApplySettings}
          disabled={state.isProcessing || state.exportBusy || (!isDirty && state.results.length > 0)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#243BFF] via-[#5B35FF] to-[#A12CFF] text-sm font-bold text-white shadow-md shadow-[#5B35FF]/25 transition-transform duration-150 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
        >
          {state.isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : isDirty ? <Wand2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {state.isProcessing ? 'Enhancing…' : isDirty ? 'Apply & Re-Enhance' : 'Up to date'}
        </button>
      </div>

      {/* Preview */}
      {selected && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-bold tracking-wide text-white">
              Preview <span className="font-normal text-slate-500">· page {selected.index + 1} of {state.results.length}</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowBefore((b) => !b)}
              aria-pressed={showBefore}
              className={`min-h-[44px] rounded-full border px-3.5 text-[11px] font-bold transition-colors ${
                showBefore
                  ? 'border-[#5B35FF]/50 bg-[#5B35FF]/20 text-[#a78bfa]'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              {showBefore ? 'Showing BEFORE' : 'Showing AFTER'}
            </button>
          </div>

          <div
            className="relative overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/70 select-none"
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
              className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ${
                showBefore ? 'bg-amber-500/90 text-amber-950' : 'bg-emerald-500/90 text-emerald-950'
              }`}
            >
              {showBefore ? 'BEFORE' : 'AFTER'}
            </span>
            <span className="absolute bottom-3 right-3 rounded-full bg-slate-900/80 px-2 py-1 text-[10px] font-medium text-slate-300 backdrop-blur">
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
                    state.selectedIndex === page.index ? 'border-[#5B35FF]' : 'border-slate-700/80'
                  }`}
                >
                  <img src={page.dataUrl} alt={`Page ${page.index + 1} thumbnail`} className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sticky export CTA — safe-area aware for gesture bar */}
      {!state.isProcessing && state.results.length > 0 && (
        <div className="sticky bottom-0 z-20 -mx-4 border-t border-slate-800/70 bg-slate-950/95 px-4 pt-3 backdrop-blur-md" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          <button
            type="button"
            onClick={handleExport}
            disabled={state.exportBusy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#243BFF] via-[#5B35FF] to-[#A12CFF] text-sm font-bold text-white shadow-md shadow-[#5B35FF]/25 transition-transform duration-150 active:scale-[0.98] disabled:opacity-50"
          >
            {state.exportBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {state.exportBusy ? 'Building PDF…' : 'Download Print-Ready PDF'}
          </button>
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