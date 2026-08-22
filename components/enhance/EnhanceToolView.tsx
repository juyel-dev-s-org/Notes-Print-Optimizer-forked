'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useEnhanceWorkflow } from '@/lib/enhance/useEnhanceWorkflow';
import type { EnhanceStep } from '@/lib/enhance/types';
import { EnhanceUploadView } from './EnhanceUploadView';
import { EnhanceArrangeView } from './EnhanceArrangeView';
import { EnhanceWorkbenchView } from './EnhanceWorkbenchView';

export interface EnhanceToolViewProps {
  onBack: () => void;
  /** Enhance results -> main pipeline N-Up layout (optional bridge). */
  onHandoffToLayout?: (pages: Array<{ dataUrl: string; width: number; height: number }>) => void;
}

const STEP_LABEL: Record<EnhanceStep, string> = {
  upload: '1 · Upload',
  arrange: '2 · Arrange',
  enhance: '3 · Enhance',
};

/**
 * Self-contained mobile tool: upload → arrange → enhance (download / N-Up).
 * Own top bar (back arrow exits to the landing tools box) and its own
 * internal state machine via useEnhanceWorkflow.
 */
export const EnhanceToolView: React.FC<EnhanceToolViewProps> = ({ onBack, onHandoffToLayout }) => {
  const workflow = useEnhanceWorkflow();
  const { state } = workflow;

  return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <header className="sticky top-0 z-30 -mx-4 flex items-center gap-3 border-b border-surface-2/70 bg-bg/90 px-4 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to tools"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-elevated/60 bg-surface/80 text-ink transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-soft"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-[15px] font-bold text-ink">Enhance Light PDF</h1>
          <p className="truncate text-[11px] text-ink-faint">Faint scans → clear printouts · 100% on-device</p>
        </div>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-bold tabular-nums text-accent-soft">
          {STEP_LABEL[state.step]}
        </span>
      </header>

      {state.step === 'upload' && <EnhanceUploadView workflow={workflow} />}
      {state.step === 'arrange' && <EnhanceArrangeView workflow={workflow} />}
      {state.step === 'enhance' && (
        <EnhanceWorkbenchView
          workflow={workflow}
          onChooseLayout={
            onHandoffToLayout
              ? () =>
                  onHandoffToLayout(
                    state.results.map((r) => ({ dataUrl: r.dataUrl, width: r.width, height: r.height })),
                  )
              : undefined
          }
        />
      )}
    </div>
  );
};