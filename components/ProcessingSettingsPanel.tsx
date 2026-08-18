'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ProcessingParameters } from '@/lib/optimizer/types';
import type { ProcessingToggleState } from '@/lib/workflow/types';
import { InfoTooltip } from '@/components/InfoTooltip';
import {
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  RefreshCw,
  PenLine,
  Sparkles,
  Eraser,
  Contrast,
  Droplets,
} from 'lucide-react';

/* -- Props -------------------------------------------------------- */
interface ProcessingSettingsPanelProps {
  params: ProcessingParameters;
  onParamsChange: (params: ProcessingParameters) => void;
  onReprocess: () => void;
  isProcessing: boolean;
  /** Toggle state for each parameter (ON = manual, OFF = preset default). */
  toggles: ProcessingToggleState;
  onTogglesChange: (toggles: ProcessingToggleState) => void;
  /** Re-process ONLY the currently selected preview page. */
  onPreviewReprocess: () => void;
  /** Whether a single-page preview reprocess is in flight. */
  isPreviewProcessing: boolean;
  /** Reset all toggles OFF + restore preset defaults. */
  onResetSettings: () => void;
}

/* -- Slider metadata ---------------------------------------------- */
interface SliderConfig {
  key: keyof ProcessingParameters;
  toggleKey: keyof ProcessingToggleState;
  label: string;
  icon: React.ReactNode;
  min: number;
  max: number;
  step: number;
  unit: string;
  tooltipTitle: string;
  tooltipBody: string;
}

const SLIDERS: SliderConfig[] = [
  {
    key: 'dilationKernelSize',
    toggleKey: 'strokeDilation',
    label: 'Stroke / Dilation',
    icon: <PenLine className="h-3.5 w-3.5" />,
    min: 1,
    max: 7,
    step: 1,
    unit: 'px',
    tooltipTitle: 'Stroke / Dilation',
    tooltipBody:
      'Makes text strokes thicker or thinner. Higher = bolder text. Leave OFF to keep the original look.',
  },
  {
    key: 'sharpenAmount',
    toggleKey: 'sharpen',
    label: 'Sharpen',
    icon: <Sparkles className="h-3.5 w-3.5" />,
    min: 0,
    max: 100,
    step: 5,
    unit: '%',
    tooltipTitle: 'Sharpen',
    tooltipBody:
      'Makes edges look crisper. Higher = sharper, but too much can look harsh.',
  },
  {
    key: 'contrastEnhancement',
    toggleKey: 'contrast',
    label: 'Contrast',
    icon: <Contrast className="h-3.5 w-3.5" />,
    min: 0,
    max: 100,
    step: 5,
    unit: '%',
    tooltipTitle: 'Contrast',
    tooltipBody:
      'Darkens strokes so faint text is easier to read. Higher = stronger contrast.',
  },
  {
    key: 'denoiseAmount',
    toggleKey: 'denoise',
    label: 'Denoise',
    icon: <Eraser className="h-3.5 w-3.5" />,
    min: 0,
    max: 100,
    step: 5,
    unit: '%',
    tooltipTitle: 'Denoise',
    tooltipBody:
      'Cleans up dust spots and background noise. Higher = cleaner, but may remove fine details.',
  },
  {
    key: 'backgroundWhiteningThreshold',
    toggleKey: 'bgWhitening',
    label: 'BG Whitening',
    icon: <Droplets className="h-3.5 w-3.5" />,
    min: 180,
    max: 255,
    step: 5,
    unit: '',
    tooltipTitle: 'Background Whitening',
    tooltipBody:
      'Turns light backgrounds pure white for cleaner prints. Lower = more aggressive cleanup.',
  },
];

const PRESET_LABELS: Record<string, string> = {
  AUTO_ADAPTIVE: 'Auto Adaptive',
  PW_DARK_SLIDE: 'Dark Slide',
  LIGHT_HANDWRITTEN: 'Light Handwritten',
  INK_SAVER_EXTREME: 'Ink Saver Extreme',
  DIAGRAM_HIGH_CONTRAST: 'Diagram Hi-Contrast',
};

/* -- Toggle Switch (small pill) ----------------------------------- */
const ToggleSwitch: React.FC<{
  enabled: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  label: string;
}> = ({ enabled, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    aria-label={`${label} override`}
    disabled={disabled}
    onClick={() => onChange(!enabled)}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
      enabled
        ? 'bg-primary-strong'
        : 'bg-elevated'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
        enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
      }`}
    />
  </button>
);

/* -- Main Component ----------------------------------------------- */
export const ProcessingSettingsPanel: React.FC<ProcessingSettingsPanelProps> = ({
  params,
  onParamsChange,
  onReprocess,
  isProcessing,
  toggles,
  onTogglesChange,
  onPreviewReprocess,
  isPreviewProcessing,
  onResetSettings,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  /* Debounced preview reprocess - avoids hammering on rapid slider drags.
   * A ref is used so the timeout ALWAYS calls the latest onPreviewReprocess,
   * eliminating the stale-closure bug where the captured callback had
   * outdated masterParams / processingToggles. */
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPreviewReprocessRef = useRef(onPreviewReprocess);

  // Keep the ref in sync outside render (render must stay pure) so the
  // debounced timer always calls the latest onPreviewReprocess.
  useEffect(() => {
    onPreviewReprocessRef.current = onPreviewReprocess;
  }, [onPreviewReprocess]);

  const schedulePreviewReprocess = useCallback(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      onPreviewReprocessRef.current();
    }, 300);
  }, []);   // stable â€” reads from ref

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);

  /* -- Handlers -- */

  const handleToggleChange = useCallback(
    (toggleKey: keyof ProcessingToggleState, value: boolean) => {
      onTogglesChange({ ...toggles, [toggleKey]: value });
      setIsDirty(true);
      schedulePreviewReprocess();
    },
    [toggles, onTogglesChange, schedulePreviewReprocess],
  );

  const handleSliderChange = useCallback(
    (key: keyof ProcessingParameters, value: number) => {
      onParamsChange({ ...params, [key]: value });
      setIsDirty(true);
      schedulePreviewReprocess();
    },
    [params, onParamsChange, schedulePreviewReprocess],
  );

  const handlePresetChange = useCallback(
    (preset: ProcessingParameters['preset']) => {
      onParamsChange({ ...params, preset });
      setIsDirty(true);
      schedulePreviewReprocess();
    },
    [params, onParamsChange, schedulePreviewReprocess],
  );

  const handleReset = useCallback(() => {
    onResetSettings();
    setIsDirty(false);
    schedulePreviewReprocess();
  }, [onResetSettings, schedulePreviewReprocess]);

  const handleReprocessAll = useCallback(() => {
    setIsDirty(false);
    onReprocess();
  }, [onReprocess]);

  const anyToggleOn = Object.values(toggles).some(Boolean);

  return (
    <div className="rounded-2xl border border-surface-2 bg-surface/90 shadow-xl overflow-hidden">
      {/* -- Toggle Header -- */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="processing-settings-body"
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-2/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-warning border border-amber-500/30">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <div>
            <span className="block text-xs font-bold text-white sm:text-sm">
              Processing Settings
            </span>
            <span className="block text-[10px] text-ink-muted">
              Toggle &amp; fine-tune individual parameters
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-500/30">
              Modified
            </span>
          )}
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-ink-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-ink-muted" />
          )}
        </div>
      </button>

      {/* -- Collapsible Body -- */}
      {isOpen && (
        <div id="processing-settings-body" className="border-t border-surface-2 px-4 py-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Preset Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">
              Preset Base
            </label>
            <select
              value={params.preset}
              onChange={(e) => handlePresetChange(e.target.value as ProcessingParameters['preset'])}
              className="w-full rounded-lg border border-elevated bg-bg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-primary"
            >
              {Object.entries(PRESET_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* -- Parameter Toggle + Slider Rows -- */}
          <div className="flex flex-col gap-2.5">
            {SLIDERS.map((slider) => {
              const isOn = toggles[slider.toggleKey];
              const value = (params[slider.key] as number) ?? slider.min;
              const pct = ((value - slider.min) / (slider.max - slider.min)) * 100;

              return (
                <div
                  key={slider.key}
                  className={`flex flex-col gap-2 rounded-xl border p-3 transition-colors duration-200 ${
                    isOn
                      ? 'border-primary/40 bg-primary-faint/20'
                      : 'border-surface-2 bg-bg/60'
                  }`}
                >
                  {/* Row: Icon + Label + Tooltip + Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={isOn ? 'text-primary-soft' : 'text-ink-faint'}>
                        {slider.icon}
                      </span>
                      <span
                        className={`text-[11px] font-bold ${
                          isOn ? 'text-white' : 'text-ink-muted'
                        }`}
                      >
                        {slider.label}
                      </span>
                      <InfoTooltip
                        title={slider.tooltipTitle}
                        content={slider.tooltipBody}
                        position="top"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      {isOn && (
                        <span className="rounded-md bg-primary/20 px-2 py-0.5 text-[11px] font-bold text-primary-soft border border-primary/30 tabular-nums">
                          {value}{slider.unit}
                        </span>
                      )}
                      <ToggleSwitch
                        enabled={isOn}
                        onChange={(on) => handleToggleChange(slider.toggleKey, on)}
                        label={slider.label}
                      />
                    </div>
                  </div>

                  {/* Slider (disabled when toggle OFF) */}
                  <div className={isOn ? '' : 'opacity-35 pointer-events-none'}>
                    <input
                      type="range"
                      min={slider.min}
                      max={slider.max}
                      step={slider.step}
                      value={value}
                      disabled={!isOn}
                      onChange={(e) => handleSliderChange(slider.key, Number(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                        bg-elevated accent-primary
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:h-3.5
                        [&::-webkit-slider-thumb]:w-3.5
                        [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:bg-primary
                        [&::-webkit-slider-thumb]:shadow-md
                        [&::-webkit-slider-thumb]:border-2
                        [&::-webkit-slider-thumb]:border-primary-soft
                        disabled:cursor-not-allowed"
                      style={{
                        background: isOn
                          ? `linear-gradient(to right, var(--color-primary) ${pct}%, var(--color-elevated) ${pct}%)`
                          : 'var(--color-elevated)',
                      }}
                    />
                  </div>

                  {/* OFF hint */}
                  {!isOn && (
                    <p className="text-[9px] text-ink-faint leading-tight">
                      {slider.toggleKey === 'strokeDilation'
                        ? 'OFF - Raw PDF preserved. No morphology applied.'
                        : 'OFF - Using preset default value.'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* -- Preview note -- */}
          <p className="text-center text-[9px] text-ink-faint italic">
            Preview updates only the selected page.
          </p>

          {/* -- Action Buttons -- */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleReset}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-elevated bg-surface-2 px-3.5 text-[11px] font-bold text-ink-muted hover:bg-elevated hover:text-white transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Defaults</span>
            </button>

            <button
              type="button"
              onClick={handleReprocessAll}
              disabled={isProcessing || isPreviewProcessing}
              className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition-all ${
                !isProcessing && !isPreviewProcessing
                  ? 'bg-primary-strong text-white hover:bg-primary shadow-lg shadow-primary-faint/30 active:scale-[0.98]'
                  : 'bg-surface-2 text-ink-faint cursor-not-allowed border border-elevated'
              }`}
            >
              {isProcessing ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Re-processing...</span>
                </>
              ) : (
                <>
                  <RefreshCw className={`h-3.5 w-3.5 ${isPreviewProcessing ? 'animate-spin' : ''}`} />
                  <span>
                    {isPreviewProcessing ? 'Preview...' : 'Re-process All Pages'}
                  </span>
                </>
              )}
            </button>
          </div>

          {!isDirty && !anyToggleOn && (
            <p className="text-center text-[9px] text-ink-faint">
              Enable a toggle above to override preset defaults, then tap &ldquo;Re-process All&rdquo; to apply to every page.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
