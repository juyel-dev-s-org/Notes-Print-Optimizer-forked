'use client';

import React from 'react';

/* Shared pill visuals — a <span>, so it can live inside a single
   interactive <button> without nesting controls (invalid HTML). */
const Pill: React.FC<{ enabled: boolean }> = ({ enabled }) => (
  <span
    aria-hidden="true"
    className={`relative inline-flex h-7 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
      enabled ? 'bg-primary-strong' : 'bg-elevated'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
        enabled ? 'translate-x-[22px]' : 'translate-x-[4px]'
      }`}
    />
  </span>
);

export interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  /** Accessible name when the pill is used standalone. */
  label: string;
}

/** The one switch — 28×44px pill, tokenized, keyboard + SR correct. */
export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ enabled, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!enabled)}
    className={`inline-flex h-7 w-11 shrink-0 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft ${
      disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
    }`}
  >
    <Pill enabled={enabled} />
  </button>
);

export interface ToggleRowProps {
  label: string;
  hint?: string;
  enabled: boolean;
  onChange: (on: boolean) => void;
}

/** Full-row switch (label + hint left, pill right). ≥48px touch target.
 *  Single <button role="switch"> — no nested controls. */
export const ToggleRow: React.FC<ToggleRowProps> = ({ label, hint, enabled, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    aria-label={hint ? `${label} — ${hint}` : label}
    onClick={() => onChange(!enabled)}
    className="flex min-h-[48px] w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft"
  >
    <span className="flex flex-col">
      <span className="text-sm font-bold text-ink">{label}</span>
      {hint && <span className="text-xs leading-snug text-ink-muted">{hint}</span>}
    </span>
    <Pill enabled={enabled} />
  </button>
);
