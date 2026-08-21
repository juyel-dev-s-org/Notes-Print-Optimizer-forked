'use client';

import React from 'react';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  ariaLabel: string;
  onChange: (v: number) => void;
}

/** Core styled range input — 24px thumb, tokenized fill. */
export const Slider: React.FC<SliderProps> = ({ value, min, max, step = 1, disabled, ariaLabel, onChange }) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`w-full cursor-pointer appearance-none rounded-full bg-elevated py-2
        [&::-webkit-slider-thumb]:h-6
        [&::-webkit-slider-thumb]:w-6
        [&::-webkit-slider-thumb]:appearance-none
        [&::-webkit-slider-thumb]:rounded-full
        [&::-webkit-slider-thumb]:border-2
        [&::-webkit-slider-thumb]:border-primary-soft
        [&::-webkit-slider-thumb]:bg-primary-strong
        [&::-webkit-slider-thumb]:shadow-md
        [&::-moz-range-thumb]:h-6
        [&::-moz-range-thumb]:w-6
        [&::-moz-range-thumb]:rounded-full
        [&::-moz-range-thumb]:border-2
        [&::-moz-range-thumb]:border-primary-soft
        [&::-moz-range-thumb]:bg-primary-strong
        disabled:cursor-not-allowed ${disabled ? 'opacity-35' : ''}`}
      style={{
        background: disabled
          ? 'var(--color-elevated)'
          : `linear-gradient(to right, var(--color-primary) ${pct}%, var(--color-elevated) ${pct}%)`,
      }}
    />
  );
};

export interface SliderRowProps {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  showValue?: boolean;
  disabled?: boolean;
  onChange: (v: number) => void;
}

/** Labeled slider row — label + hint left, live value badge right. */
export const SliderRow: React.FC<SliderRowProps> = ({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  unit = '',
  showValue = true,
  disabled,
  onChange,
}) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className="text-sm font-bold text-ink">{label}</span>
        {hint && <span className="text-xs leading-snug text-ink-muted">{hint}</span>}
      </div>
      {showValue && (
        <span className="rounded-md border border-primary/30 bg-primary/20 px-2 py-0.5 text-xs font-bold tabular-nums text-primary-soft">
          {value}{unit}
        </span>
      )}
    </div>
    <Slider
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      ariaLabel={hint ? `${label} — ${hint}` : label}
      onChange={onChange}
    />
  </div>
);
