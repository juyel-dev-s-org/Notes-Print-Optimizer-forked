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
  { format: '2x2', label: '4-Up (2x2)', desc: '4 slides per sheet', recommended: true },
  { format: '1x2', label: '2-Up (1x2)', desc: '2 slides per sheet', recommended: false },
  { format: '2x3', label: '6-Up (2x3)', desc: '6 slides per sheet', recommended: false },
  { format: '2x4', label: '8-Up (2x4)', desc: '8 slides per sheet', recommended: false },
  { format: '2x5', label: '10-Up (2x5)', desc: '10 slides per sheet', recommended: false },
  { format: '1x1', label: '1-Up (1x1)', desc: '1 slide per sheet', recommended: false },
];

interface GridFormatPickerProps {
  gridFormat: LayoutConfig['gridFormat'];
  /** Column layout per viewport: 2 = mobile, 3 = tablet, 6 = desktop. */
  columns: 2 | 3 | 6;
  onSelect: (format: LayoutConfig['gridFormat']) => void;
}

const COLUMNS: Record<GridFormatPickerProps['columns'], string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  6: 'grid-cols-6',
};

/**
 * Shared N-Up grid format picker used by all three platform UIs.
 * Single source of truth for the format list, keyboard interaction and the
 * recommended badge - previously duplicated with drifting copy/badges.
 */
export const GridFormatPicker: React.FC<GridFormatPickerProps> = ({ gridFormat, columns, onSelect }) => {
  const cardSize = columns === 2 ? 'p-2.5' : 'p-3';
  const descSize = columns === 6 ? 'text-[11px]' : 'text-[10px]';

  return (
    <div className={`grid ${COLUMNS[columns]} gap-3`}>
      {GRID_FORMATS.map((item) => {
        const isSelected =
          gridFormat === item.format || (item.format === '2x2' && gridFormat === '4up');
        return (
          <div
            key={item.format}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={`${item.label} grid format${item.recommended ? ' (recommended)' : ''}`}
            onClick={() => onSelect(item.format as LayoutConfig['gridFormat'])}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(item.format as LayoutConfig['gridFormat']);
              }
            }}
            className={`flex flex-col justify-between rounded-xl border text-left cursor-pointer transition-all active:scale-98 ${
              isSelected
                ? 'border-primary bg-primary-faint/60 ring-2 ring-primary shadow-md'
                : 'border-surface-2 bg-bg/60 hover:border-elevated'
            } ${cardSize}`}
          >
            <div>
              {item.recommended && (
                <span className="mb-1 inline-block rounded-xs bg-primary-strong px-1.5 py-0.5 text-[9px] font-bold text-white">
                  RECOMMENDED
                </span>
              )}
              <h4 className="text-xs font-bold text-white">{item.label}</h4>
              <p className={`mt-0.5 text-ink-muted ${descSize}`}>{item.desc}</p>
            </div>
            {isSelected && (
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