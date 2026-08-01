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
      'OFF: Raw PDF page is preserved exactly as rendered - no morphology, no stroke expansion, no dilation, no erosion. ' +
      'ON: Enables manual stroke thickness control. Higher = thicker text strokes.',
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
      'OFF: Uses the current preset default sharpen value. ' +
      'ON: Enables manual sharpen adjustment, overriding the preset. Higher = crisper edges but may add artifacts.',
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
      'OFF: Uses the current preset default contrast value. ' +
      'ON: Enables manual contrast adjustment, overriding the preset. Higher = darker strokes, better for faint text.',
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
      'OFF: Uses the current preset default denoise value. ' +
      'ON: Enables manual denoise adjustment, overriding the preset. Higher = cleaner but may remove fine detail.',
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
      'OFF: Uses the current preset default threshold. ' +
      'ON: Enables manual BG whitening adjustment. Pixels brighter than this value become pure white. Lower = more aggressive cleanup.',
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
}> = ({ enabled, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    disabled={disabled}
    onClick={() => onChange(!enabled)}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
      enabled
        ? 'bg-indigo-600'
        : 'bg-slate-700'
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
  onPreviewReprocessRef.current = onPreviewReprocess;   // always latest

  const schedulePreviewReprocess = useCallback(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      onPreviewReprocessRef.current();
    }, 300);
  }, []);   // stable — reads from ref

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
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
      {/* -- Toggle Header -- */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white sm:text-sm">
              Processing Settings
            </h3>
            <p className="text-[10px] text-slate-400">
              Toggle &amp; fine-tune individual parameters
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-500/30">
              Modified
            </span>
          )}
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* -- Collapsible Body -- */}
      {isOpen && (
        <div className="border-t border-slate-800 px-4 py-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Preset Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Preset Base
            </label>
            <select
              value={params.preset}
              onChange={(e) => handlePresetChange(e.target.value as ProcessingParameters['preset'])}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
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
                      ? 'border-indigo-500/40 bg-indigo-950/20'
                      : 'border-slate-800 bg-slate-950/60'
                  }`}
                >
                  {/* Row: Icon + Label + Tooltip + Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={isOn ? 'text-indigo-400' : 'text-slate-500'}>
                        {slider.icon}
                      </span>
                      <span
                        className={`text-[11px] font-bold ${
                          isOn ? 'text-white' : 'text-slate-400'
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
                        <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[11px] font-bold text-indigo-300 border border-indigo-500/30 tabular-nums">
                          {value}{slider.unit}
                        </span>
                      )}
                      <ToggleSwitch
                        enabled={isOn}
                        onChange={(on) => handleToggleChange(slider.toggleKey, on)}
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
                        bg-slate-700 accent-indigo-500
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:h-3.5
                        [&::-webkit-slider-thumb]:w-3.5
                        [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:bg-indigo-500
                        [&::-webkit-slider-thumb]:shadow-md
                        [&::-webkit-slider-thumb]:border-2
                        [&::-webkit-slider-thumb]:border-indigo-300
                        disabled:cursor-not-allowed"
                      style={{
                        background: isOn
                          ? `linear-gradient(to right, #6366f1 ${pct}%, #334155 ${pct}%)`
                          : '#334155',
                      }}
                    />
                  </div>

                  {/* OFF hint */}
                  {!isOn && (
                    <p className="text-[9px] text-slate-600 leading-tight">
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
          <p className="text-center text-[9px] text-slate-500 italic">
            Preview updates only the selected page.
          </p>

          {/* -- Action Buttons -- */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleReset}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 text-[11px] font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
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
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/30 active:scale-[0.98]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
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
                    {isPreviewProcessing ? 'Preview...' : '\uD83D\uDD04 Re-process All Pages'}
                  </span>
                </>
              )}
            </button>
          </div>

          {!isDirty && !anyToggleOn && (
            <p className="text-center text-[9px] text-slate-500">
              Enable a toggle above to override preset defaults, then tap &ldquo;Re-process All&rdquo; to apply to every page.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
