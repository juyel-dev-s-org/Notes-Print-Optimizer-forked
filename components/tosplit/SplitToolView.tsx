'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useSplitWorkflow } from '@/lib/tosplit/useSplitWorkflow';
import type { SplitStep } from '@/lib/tosplit/splitReducer';
import { SplitUploadView } from './SplitUploadView';
import { SplitOptionsView } from './SplitOptionsView';
import { SplitResultView } from './SplitResultView';

export interface SplitToolViewProps {
  onBack: () => void;
}

const STEP_LABEL: Record<SplitStep, string> = {
  upload: '1 · Upload',
  options: '2 · Split',
  done: '3 · Done',
};

/**
 * Self-contained mobile tool: upload → split → done.
 * Own top bar (back arrow exits to the landing tools box) and its own
 * internal state machine via useSplitWorkflow. Cutting happens fully
 * on-device; nothing ever leaves the browser.
 */
export const SplitToolView: React.FC<SplitToolViewProps> = ({ onBack }) => {
  const workflow = useSplitWorkflow();
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
          <h1 className="truncate text-[15px] font-bold text-ink">Split PDF</h1>
          <p className="truncate text-[11px] text-ink-faint">Extract a range or burst every N pages · 100% on-device</p>
        </div>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-bold tabular-nums text-accent-soft">
          {STEP_LABEL[state.step]}
        </span>
      </header>

      {state.step === 'upload' && <SplitUploadView workflow={workflow} />}
      {state.step === 'options' && <SplitOptionsView workflow={workflow} />}
      {state.step === 'done' && <SplitResultView workflow={workflow} />}
    </div>
  );
};
