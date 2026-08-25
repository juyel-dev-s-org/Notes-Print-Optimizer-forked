'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  GripVertical,
  Layers,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { planSmartOrder } from '@/lib/rearrange';

/** Structural subset of the workflow UploadedPdfItem (keeps the panel decoupled). */
export interface FileSequenceItem {
  id: string;
  name: string;
  sizeMB: string;
}

export interface FileSequencePanelProps {
  /** Current upload order (owned by the workflow reducer). */
  items: FileSequenceItem[];
  /** Blocks reordering while the pipeline is busy. */
  isProcessing?: boolean;
  /** Accessible adjacent-swap fallback (also serves touch devices). */
  onMoveItem: (index: number, direction: 'UP' | 'DOWN') => void;
  onRemoveItem: (index: number) => void;
  /** Drag & drop: move the item at fromIndex into position toIndex. */
  onReorderItem: (fromIndex: number, toIndex: number) => void;
  /** Applies the rule-engine plan (series-aware natural sort). */
  onSmartArrange: () => void;
  /** Optional scroll constraint for the list body. */
  maxHeightClass?: string;
  /** Compact density for mobile / tablet viewports. */
  compact?: boolean;
}

/**
 * Phase-1 file sequence panel with Smart PDF Rearrangement:
 *  - automatic series detection badge ("N series detected")
 *  - one-click rule-based natural ordering (Smart Arrange)
 *  - manual drag & drop reordering (arrow buttons as the touch fallback)
 *
 * Pure presentational component: every mutation flows through callbacks and
 * the single source of truth stays in the workflow reducer.
 */
export const FileSequencePanel: React.FC<FileSequencePanelProps> = ({
  items,
  isProcessing = false,
  onMoveItem,
  onRemoveItem,
  onReorderItem,
  onSmartArrange,
  maxHeightClass = 'max-h-[320px]',
  compact = false,
}) => {
  // Series analysis is pure and O(n log n); memoized per upload-order change.
  const plan = useMemo(() => planSmartOrder(items), [items]);
  const seriesCount = plan.groups.length;
  const canArrange = plan.changed && !isProcessing && items.length > 1;

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const resetDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDrop = (targetIndex: number) => {
    if (dragIndex !== null && dragIndex !== targetIndex) {
      onReorderItem(dragIndex, targetIndex);
    }
    resetDrag();
  };

  const rowPad = compact ? 'p-2.5' : 'p-3';
  const btn = 'flex h-10 w-10 items-center justify-center rounded-lg';
  const iconSize = 'h-4 w-4';

  return (
    <div className="flex flex-col gap-2">
      {/* Smart rearrangement toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary-faint/30 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Layers className="h-4 w-4 shrink-0 text-primary-soft" aria-hidden="true" />
          {seriesCount > 0 ? (
            <p
              className="truncate text-[11px] font-semibold text-primary-soft"
              title={plan.groups.map((g) => g.title).join(', ')}
            >
              {seriesCount} series detected
              {plan.changed ? ' - tap Smart Arrange' : ' - in natural order'}
            </p>
          ) : (
            <p className="truncate text-[11px] text-ink-muted">
              Drag files to reorder manually
            </p>
          )}
        </div>
        {plan.changed ? (
          <button
            type="button"
            onClick={onSmartArrange}
            disabled={!canArrange}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-strong px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-40"
            title="Auto-arrange detected series by their natural volume order"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Smart Arrange
          </button>
        ) : (
          <span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-success-strong/40 bg-success-faint/40 px-2.5 py-1.5 text-[11px] font-bold text-success-soft">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Optimal order
          </span>
        )}
      </div>

      {/* Draggable file list */}
      <div
        role="list"
        aria-label="PDF sequence"
        className={`flex flex-col gap-2 overflow-y-auto p-1 ${maxHeightClass}`}
      >
        {items.map((item, idx) => {
          const isDragging = dragIndex === idx;
          const isOver = overIndex === idx && dragIndex !== null && dragIndex !== idx;
          return (
            <div
              key={item.id}
              role="listitem"
              draggable={!isProcessing}
              onDragStart={(e) => {
                setDragIndex(idx);
                e.dataTransfer.effectAllowed = 'move';
                try {
                  e.dataTransfer.setData('text/plain', item.id);
                } catch {
                  /* older browsers may reject setData; drag still works */
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (overIndex !== idx) setOverIndex(idx);
              }}
              onDragLeave={() => {
                if (overIndex === idx) setOverIndex(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(idx);
              }}
              onDragEnd={resetDrag}
              className={`flex items-center justify-between rounded-xl border bg-bg transition-colors ${rowPad} ${
                isDragging
                  ? 'cursor-grabbing border-primary opacity-50'
                  : isOver
                    ? 'border-primary-soft bg-primary-faint/50'
                    : 'cursor-grab border-surface-2 hover:bg-surface-2/50'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <GripVertical className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary-strong/30 text-xs font-bold text-primary-soft">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-ink">{item.name}</p>
                  <p className="text-2xs text-ink-muted">{item.sizeMB} MB</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onMoveItem(idx, 'UP')}
                  disabled={idx === 0 || isProcessing}
                  className={`${btn} text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-20`}
                  title="Move Up"
                  aria-label={`Move ${item.name} up`}
                >
                  <ArrowUp className={iconSize} />
                </button>
                <button
                  type="button"
                  onClick={() => onMoveItem(idx, 'DOWN')}
                  disabled={idx === items.length - 1 || isProcessing}
                  className={`${btn} text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-20`}
                  title="Move Down"
                  aria-label={`Move ${item.name} down`}
                >
                  <ArrowDown className={iconSize} />
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveItem(idx)}
                  disabled={isProcessing}
                  className={`${btn} text-danger hover:bg-danger-faint/60 disabled:opacity-20`}
                  title="Remove File"
                  aria-label={`Remove ${item.name}`}
                >
                  <Trash2 className={iconSize} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};