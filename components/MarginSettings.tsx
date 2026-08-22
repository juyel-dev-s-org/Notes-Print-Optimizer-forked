'use client';

import React from 'react';
import { LayoutConfig, OuterMarginConfig } from '@/lib/optimizer/types';
import { SlidersHorizontal, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Grid } from 'lucide-react';

interface MarginSettingsProps {
  layoutConfig: LayoutConfig;
  onUpdateOuterMargins?: (margins: OuterMarginConfig) => void;
  onUpdateInnerMargin?: (innerMarginMm: number) => void;
}

export const MarginSettings: React.FC<MarginSettingsProps> = ({
  layoutConfig,
  onUpdateOuterMargins,
  onUpdateInnerMargin,
}) => {
  const outer = layoutConfig.outerMarginMm || { top: 2, left: 5, right: 3, bottom: 2 };
  const inner = layoutConfig.innerMarginMm ?? 1;

  const handleOuterChange = (key: keyof OuterMarginConfig, value: number) => {
    const val = Math.max(0, Math.min(50, isNaN(value) ? 0 : value));
    if (onUpdateOuterMargins) {
      onUpdateOuterMargins({
        ...outer,
        [key]: val,
      });
    }
  };

  const handleInnerChange = (value: number) => {
    const val = Math.max(0, Math.min(30, isNaN(value) ? 0 : value));
    if (onUpdateInnerMargin) {
      onUpdateInnerMargin(val);
    }
  };

  const handleResetDefaults = () => {
    if (onUpdateOuterMargins) {
      onUpdateOuterMargins({ top: 2, left: 5, right: 3, bottom: 2 });
    }
    if (onUpdateInnerMargin) {
      onUpdateInnerMargin(1);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-surface-2 bg-bg/80 p-3.5 sm:p-4 text-xs">
      <div className="flex items-center justify-between border-b border-surface-2 pb-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-primary-soft" />
          <span className="font-bold text-ink text-xs sm:text-sm">Custom Page Margins (mm)</span>
        </div>
        <button
          type="button"
          onClick={handleResetDefaults}
          className="text-[10px] font-semibold text-primary-soft hover:text-primary-soft underline"
          title="Reset to default margins (Top:2, Left:5, Right:3, Bottom:2, Inner:1)"
        >
          Reset Defaults
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Outer Margin Controls */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-ink text-[11px]">Outer Margin</span>
            <span className="text-[10px] text-ink-muted">Space between content and page margin</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Top */}
            <div className="flex flex-col gap-1 rounded-lg bg-surface border border-surface-2 p-2">
              <label className="flex items-center gap-1 text-[10px] font-medium text-ink-muted">
                <ArrowUp className="h-3 w-3 text-primary-soft" />
                <span>Top</span>
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={1}
                  value={outer.top}
                  onChange={(e) => handleOuterChange('top', Number(e.target.value))}
                  className="w-full bg-bg border border-elevated rounded-md px-2 py-1 text-xs font-bold text-ink text-center focus:outline-none focus:border-primary"
                />
                <span className="text-[10px] text-ink-faint font-medium">mm</span>
              </div>
            </div>

            {/* Left */}
            <div className="flex flex-col gap-1 rounded-lg bg-surface border border-surface-2 p-2">
              <label className="flex items-center gap-1 text-[10px] font-medium text-ink-muted">
                <ArrowLeft className="h-3 w-3 text-primary-soft" />
                <span>Left</span>
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={1}
                  value={outer.left}
                  onChange={(e) => handleOuterChange('left', Number(e.target.value))}
                  className="w-full bg-bg border border-elevated rounded-md px-2 py-1 text-xs font-bold text-ink text-center focus:outline-none focus:border-primary"
                />
                <span className="text-[10px] text-ink-faint font-medium">mm</span>
              </div>
            </div>

            {/* Right */}
            <div className="flex flex-col gap-1 rounded-lg bg-surface border border-surface-2 p-2">
              <label className="flex items-center gap-1 text-[10px] font-medium text-ink-muted">
                <ArrowRight className="h-3 w-3 text-primary-soft" />
                <span>Right</span>
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={1}
                  value={outer.right}
                  onChange={(e) => handleOuterChange('right', Number(e.target.value))}
                  className="w-full bg-bg border border-elevated rounded-md px-2 py-1 text-xs font-bold text-ink text-center focus:outline-none focus:border-primary"
                />
                <span className="text-[10px] text-ink-faint font-medium">mm</span>
              </div>
            </div>

            {/* Bottom */}
            <div className="flex flex-col gap-1 rounded-lg bg-surface border border-surface-2 p-2">
              <label className="flex items-center gap-1 text-[10px] font-medium text-ink-muted">
                <ArrowDown className="h-3 w-3 text-primary-soft" />
                <span>Bottom</span>
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={1}
                  value={outer.bottom}
                  onChange={(e) => handleOuterChange('bottom', Number(e.target.value))}
                  className="w-full bg-bg border border-elevated rounded-md px-2 py-1 text-xs font-bold text-ink text-center focus:outline-none focus:border-primary"
                />
                <span className="text-[10px] text-ink-faint font-medium">mm</span>
              </div>
            </div>
          </div>
        </div>

        {/* Inner Margin / Spacing Control */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-ink text-[11px]">Inner Margin</span>
            <span className="text-[10px] text-ink-muted">The space between the pages</span>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-surface border border-surface-2 p-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/20 text-primary-soft shrink-0">
              <Grid className="h-4 w-4" />
            </div>
            <div className="flex-1 flex items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-ink block">Inner Page Spacing</span>
                <span className="text-[10px] text-ink-muted">Space between grid pages</span>
              </div>
              <div className="flex items-center gap-1 w-24">
                <input
                  type="number"
                  min={0}
                  max={30}
                  step={1}
                  value={inner}
                  onChange={(e) => handleInnerChange(Number(e.target.value))}
                  className="w-full bg-bg border border-elevated rounded-md px-2 py-1 text-xs font-bold text-ink text-center focus:outline-none focus:border-primary"
                />
                <span className="text-[10px] text-ink-faint font-medium">mm</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};