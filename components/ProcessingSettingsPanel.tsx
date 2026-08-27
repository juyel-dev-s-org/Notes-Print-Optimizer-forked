'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ProcessingParameters } from '@/lib/optimizer/types';
import type { ProcessingToggleState } from '@/lib/workflow/types';
import { InfoTooltip } from '@/components/InfoTooltip';
import { ToggleSwitch } from '@/components/ui/Toggle';
import { Slider } from '@/components/ui/Slider';
import {
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  RefreshCw,
  PenLine,
  Sparkles,
  Wand2,
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
  /* Contrast / Denoise / BG Whitening are intentionally NOT exposed here.
   * The whiten kernel outputs pure binary pages (mask -> black/white
   * composite), so a contrast curve and a background whitening threshold
   * have nothing to act on, and denoise duplicates the built-in
   * connected-component noise removal. Wiring them would be a silent
   * no-op again. Real tonal control lives in the Enhance Light PDF tool,
   * whose grayscale kernel supports it. See ProcessingToggleState docs. */
];

const PRESET_LABELS: Record<string, string> = {
  AUTO_ADAPTIVE: 'Auto Adaptive',
  PW_DARK_SLIDE: 'Dark Slide',
  LIGHT_HANDWRITTEN: 'Light Handwritten',
  INK_SAVER_EXTREME: 'Ink Saver Extreme',
  DIAGRAM_HIGH_CONTRAST: 'Diagram Hi-Contrast',
};

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
    <div className="rounded-2xl border border-surface-2 bg-surface/80 shadow-lg overflow-hidden">
      {/* -- Toggle Header — compact premium */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="processing-settings-body"
        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-surface-2/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning-strong/15 text-warning border border-warning-strong/20">
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </div>
          <div className="text-left">
            <span className="block text-[11px] font-bold text-ink leading-tight">
              Processing Settings
            </span>
            <span className="block text-[10px] text-ink-muted leading-tight">
              Fine-tune • preview single page
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isDirty && (
            <span className="rounded-full bg-warning-strong/15 px-1.5 py-0.5 text-[9px] font-bold text-warning-soft border border-warning-strong/20">
              Modified
            </span>
          )}
          {isOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-ink-muted" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
          )}
        </div>
      </button>

      {/* -- Collapsible Body — sleek */}
      {isOpen && (
        <div id="processing-settings-body" className="border-t border-surface-2/60 px-3 py-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Preset Selector — compact */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">
              Preset Base
            </label>
            <select
              value={params.preset}
              onChange={(e) => handlePresetChange(e.target.value as ProcessingParameters['preset'])}
              className="w-full rounded-lg border border-elevated bg-bg px-2.5 py-1.5 text-[11px] font-semibold text-ink focus:outline-none focus:border-primary"
            >
              {Object.entries(PRESET_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* -- Parameter Toggle + Slider Rows — compact */}
          <div className="flex flex-col gap-2">
            {SLIDERS.map((slider) => {
              const isOn = toggles[slider.toggleKey];
              const value = (params[slider.key] as number) ?? slider.min;

              return (
                <div
                  key={slider.key}
                  className={`flex flex-col gap-1.5 rounded-xl border px-2.5 py-2 transition-colors duration-150 ${
                    isOn
                      ? 'border-primary/30 bg-primary-faint/15'
                      : 'border-surface-2 bg-bg/50'
                  }`}
                >
                  {/* Row: Icon + Label + Tooltip + Toggle — compact */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className={isOn ? 'text-primary-soft' : 'text-ink-muted/70'}>
                        {slider.icon}
                      </span>
                      <span
                        className={`text-[11px] font-semibold leading-tight ${
                          isOn ? 'text-ink' : 'text-ink-muted'
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

                    <div className="flex items-center gap-1.5">
                      {isOn && (
                        <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary-soft border border-primary/20 tabular-nums">
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
                  <div className={isOn ? '' : 'pointer-events-none opacity-35'}>
                    <Slider
                      value={value}
                      min={slider.min}
                      max={slider.max}
                      step={slider.step}
                      disabled={!isOn}
                      ariaLabel={slider.label}
                      onChange={(v) => handleSliderChange(slider.key, v)}
                    />
                  </div>

                  {/* OFF hint — compact */}
                  {!isOn && (
                    <p className="text-[11px] text-ink-muted/70 leading-tight">
                      {slider.toggleKey === 'strokeDilation'
                        ? 'OFF — Raw PDF as is'
                        : 'OFF — preset default'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* -- Auto white-box heal — compact */}
          <div
            className={`flex items-center justify-between rounded-xl border px-2.5 py-2 transition-colors duration-150 ${
              toggles.autoWhiteBoxFix
                ? 'border-accent/30 bg-accent/8'
                : 'border-surface-2 bg-bg/50'
            }`}
          >
            <div className="flex items-center gap-1">
              <span className={toggles.autoWhiteBoxFix ? 'text-accent-soft' : 'text-ink-muted/70'}>
                <Wand2 className="h-3.5 w-3.5" />
              </span>
              <span className={`text-[11px] font-semibold ${toggles.autoWhiteBoxFix ? 'text-ink' : 'text-ink-muted'}`}>
                Auto-fix white boxes
              </span>
              <InfoTooltip
                title="Auto-fix white boxes"
                content="Big white notes on dark pages stay as original — not black. Turn off for full whitening."
                position="top"
              />
            </div>
            <ToggleSwitch
              enabled={toggles.autoWhiteBoxFix}
              onChange={(on) => handleToggleChange('autoWhiteBoxFix', on)}
              label="Auto-fix white boxes"
            />
          </div>

          <p className="text-center text-[10px] text-ink-muted/70 italic leading-tight">
            Preview updates only selected page
          </p>

          {/* -- Action Buttons — compact */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex h-8 items-center gap-1 rounded-lg border border-elevated bg-surface-2 px-2.5 text-[11px] font-semibold text-ink-muted hover:bg-elevated hover:text-ink transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={handleReprocessAll}
              disabled={isProcessing || isPreviewProcessing}
              className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-bold transition-all ${
                !isProcessing && !isPreviewProcessing
                  ? 'bg-primary-strong text-white hover:bg-primary shadow-md shadow-primary-faint/20 active:scale-[0.98]'
                  : 'bg-surface-2 text-ink-muted cursor-not-allowed border border-elevated'
              }`}
            >
              {isProcessing ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Re-processing...</span>
                </>
              ) : (
                <>
                  <RefreshCw className={`h-3 w-3 ${isPreviewProcessing ? 'animate-spin' : ''}`} />
                  <span>
                    {isPreviewProcessing ? 'Preview...' : 'Re-process All'}
                  </span>
                </>
              )}
            </button>
          </div>

          {!isDirty && !anyToggleOn && (
            <p className="text-center text-[10px] text-ink-muted/60 leading-tight">
              Toggle on to override preset, then Re-process All
            </p>
          )}
        </div>
      )}
    </div>
  );
};