'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { LayoutConfig } from '@/lib/optimizer/types';

interface GridFormatItem {
  format: string;
  label: string;
  desc: string;
  recommended: boolean;
}

const GRID_FORMATS: GridFormatItem[] = [
  { format: '2x2', label: '4-Up (2x2)', desc: '4 slides per sheet', recommended: false },
  { format: '1x2', label: '2-Up (1x2)', desc: '2 slides per sheet', recommended: false },
  { format: '2x3', label: '6-Up (2x3)', desc: '6 slides per sheet', recommended: false },
  { format: '2x4', label: '8-Up (2x4)', desc: '8 slides per sheet', recommended: false },
  { format: '2x5', label: '10-Up (2x5)', desc: '10 slides per sheet', recommended: false },
  { format: '1x1', label: '1-Up (1x1)', desc: '1 slide per sheet', recommended: false },
];

interface GridFormatPickerProps {
  gridFormat: LayoutConfig['gridFormat'];
  onSelect: (format: LayoutConfig['gridFormat']) => void;
}

/**
 * Shared N-Up grid format picker — one responsive grid (2 cols mobile,
 * 3 tablet, 6 desktop). Single source of truth for the format list,
 * keyboard interaction and the recommended badge.
 */
export const GridFormatPicker: React.FC<GridFormatPickerProps> = ({ gridFormat, onSelect }) => {
  const isSelected = (format: string) =>
    gridFormat === format || (format === '2x2' && gridFormat === '4up');

  const selectByIndex = (idx: number) => {
    const clamped = (idx + GRID_FORMATS.length) % GRID_FORMATS.length;
    onSelect(GRID_FORMATS[clamped].format as LayoutConfig['gridFormat']);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Grid format"
      className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 xl:grid-cols-6"
    >
      {GRID_FORMATS.map((item, idx) => {
        const selected = isSelected(item.format);
        return (
          <div
            key={item.format}
            role="radio"
            tabIndex={selected ? 0 : -1}
            aria-checked={selected}
            aria-label={`${item.label} grid format${item.recommended ? ' (recommended)' : ''}`}
            onClick={() => onSelect(item.format as LayoutConfig['gridFormat'])}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(item.format as LayoutConfig['gridFormat']);
              } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                selectByIndex(idx + 1);
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                selectByIndex(idx - 1);
              }
            }}
            className={`flex flex-col justify-between rounded-xl border p-3 text-left cursor-pointer transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft ${
              selected
                ? 'border-primary bg-primary-faint/60 ring-2 ring-primary shadow-md'
                : 'border-surface-2 bg-bg/60 hover:border-elevated'
            }`}
          >
            <div>
              {item.recommended && (
                <span className="mb-1 inline-block rounded-xs bg-primary-strong px-1.5 py-0.5 text-xs font-bold text-white">
                  Recommended
                </span>
              )}
              <h4 className="text-xs font-bold text-ink sm:text-sm">{item.label}</h4>
              <p className="mt-0.5 text-xs text-ink-muted">{item.desc}</p>
            </div>
            {selected && (
              <div className="mt-2 flex justify-end">
                <Check className="h-3.5 w-3.5 text-primary-soft" aria-hidden="true" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};