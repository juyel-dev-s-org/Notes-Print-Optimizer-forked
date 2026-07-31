'use client';

import React, { useState, useCallback } from 'react';
import type { ProcessingParameters } from '@/lib/optimizer/types';
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

interface ProcessingSettingsPanelProps {
  params: ProcessingParameters;
  onParamsChange: (params: ProcessingParameters) => void;
  onReprocess: () => void;
  isProcessing: boolean;
}

interface SliderConfig {
  key: keyof ProcessingParameters;
  label: string;
  icon: React.ReactNode;
  min: number;
  max: number;
  step: number;
  unit: string;
  hint: string;
}

const SLIDERS: SliderConfig[] = [
  {
    key: 'dilationKernelSize',
    label: 'Stroke Thickness',
    icon: <PenLine className="h-3.5 w-3.5" />,
    min: 0,
    max: 7,
    step: 2,
    unit: 'px',
    hint: 'Dilation kernel size. 0=off, 3=light, 5=medium, 7=heavy. Lower = thinner text.',
  },
  {
    key: 'sharpenAmount',
    label: 'Sharpen',
    icon: <Sparkles className="h-3.5 w-3.5" />,
    min: 0,
    max: 100,
    step: 5,
    unit: '%',
    hint: 'Edge sharpening intensity. Higher = crisper but may add artifacts.',
  },
  {
    key: 'contrastEnhancement',
    label: 'Contrast',
    icon: <Contrast className="h-3.5 w-3.5" />,
    min: 0,
    max: 100,
    step: 5,
    unit: '%',
    hint: 'Contrast boost for faint text. Higher = darker strokes.',
  },
  {
    key: 'denoiseAmount',
    label: 'Denoise',
    icon: <Eraser className="h-3.5 w-3.5" />,
    min: 0,
    max: 100,
    step: 5,
    unit: '%',
    hint: 'Noise removal strength. Higher = cleaner but may remove fine detail.',
  },
  {
    key: 'backgroundWhiteningThreshold',
    label: 'BG Whitening',
    icon: <Droplets className="h-3.5 w-3.5" />,
    min: 180,
    max: 255,
    step: 5,
    unit: '',
    hint: 'Pixels brighter than this become pure white. Lower = more aggressive cleanup.',
  },
];

const PRESET_LABELS: Record<string, string> = {
  AUTO_ADAPTIVE: 'Auto Adaptive',
  PW_DARK_SLIDE: 'Dark Slide',
  LIGHT_HANDWRITTEN: 'Light Handwritten',
  INK_SAVER_EXTREME: 'Ink Saver Extreme',
  DIAGRAM_HIGH_CONTRAST: 'Diagram Hi-Contrast',
};

export const ProcessingSettingsPanel: React.FC<ProcessingSettingsPanelProps> = ({
  params,
  onParamsChange,
  onReprocess,
  isProcessing,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const handleSliderChange = useCallback(
    (key: keyof ProcessingParameters, value: number) => {
      onParamsChange({ ...params, [key]: value });
      setIsDirty(true);
    },
    [params, onParamsChange],
  );

  const handlePresetChange = useCallback(
    (preset: ProcessingParameters['preset']) => {
      onParamsChange({ ...params, preset });
      setIsDirty(true);
    },
    [params, onParamsChange],
  );

  const handleReset = useCallback(() => {
    // Reset to AUTO_ADAPTIVE defaults
    onParamsChange({
      preset: 'AUTO_ADAPTIVE',
      invertMode: 'smart',
      smartColorMapping: true,
      backgroundWhiteningThreshold: 220,
      contrastEnhancement: 20,
      sharpenAmount: 30,
      denoiseAmount: 15,
      bannerCropTopPct: 0,
      bannerCropBottomPct: 0,
      autoTrimMargins: false,
      binaizationThreshold: 0,
      outputQuality: 0.88,
      strokeEnhancement: 'strong',
      dilationKernelSize: 5,
    });
    setIsDirty(false);
  }, [onParamsChange]);

  const handleReprocess = useCallback(() => {
    setIsDirty(false);
    onReprocess();
  }, [onReprocess]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
      {/* Toggle Header */}
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
              Fine-tune stroke, sharpen &amp; noise parameters
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

      {/* Collapsible Body */}
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

          {/* Parameter Sliders */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SLIDERS.map((slider) => {
              const value = (params[slider.key] as number) ?? slider.min;
              const pct = ((value - slider.min) / (slider.max - slider.min)) * 100;
              return (
                <div
                  key={slider.key}
                  className="flex flex-col gap-1.5 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <span className="text-indigo-400">{slider.icon}</span>
                      <span className="text-[11px] font-bold">{slider.label}</span>
                    </div>
                    <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[11px] font-bold text-indigo-300 border border-indigo-500/30 tabular-nums">
                      {value}{slider.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    value={value}
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
                      [&::-webkit-slider-thumb]:border-indigo-300"
                    style={{
                      background: `linear-gradient(to right, #6366f1 ${pct}%, #334155 ${pct}%)`,
                    }}
                  />
                  <p className="text-[9px] text-slate-500 leading-tight">{slider.hint}</p>
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
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
              onClick={handleReprocess}
              disabled={isProcessing || !isDirty}
              className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition-all ${
                isDirty && !isProcessing
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
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Re-process All Pages</span>
                </>
              )}
            </button>
          </div>

          {!isDirty && (
            <p className="text-center text-[9px] text-slate-500">
              Adjust any parameter above, then tap &ldquo;Re-process&rdquo; to apply changes.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
