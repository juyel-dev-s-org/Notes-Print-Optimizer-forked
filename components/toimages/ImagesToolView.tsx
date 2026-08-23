'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useImagesWorkflow } from '@/lib/toimages/useImagesWorkflow';
import type { ImagesStep } from '@/lib/toimages/imagesReducer';
import { ImagesUploadView } from './ImagesUploadView';
import { ImagesOptionsView } from './ImagesOptionsView';
import { ImagesResultView } from './ImagesResultView';

export interface ImagesToolViewProps {
  onBack: () => void;
}

const STEP_LABEL: Record<ImagesStep, string> = {
  upload: '1 · Upload',
  options: '2 · Convert',
  done: '3 · Done',
};

/**
 * Self-contained mobile tool: upload → convert → done.
 * Own top bar (back arrow exits to the landing tools box) and its own
 * internal state machine via useImagesWorkflow. Rendering happens fully
 * on-device; nothing ever leaves the browser.
 */
export const ImagesToolView: React.FC<ImagesToolViewProps> = ({ onBack }) => {
  const workflow = useImagesWorkflow();
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
          <h1 className="truncate text-[15px] font-bold text-ink">PDF to Images</h1>
          <p className="truncate text-[11px] text-ink-faint">Crisp JPG / PNG / WebP per sheet · 100% on-device</p>
        </div>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-bold tabular-nums text-accent-soft">
          {STEP_LABEL[state.step]}
        </span>
      </header>

      {state.step === 'upload' && <ImagesUploadView workflow={workflow} />}
      {state.step === 'options' && <ImagesOptionsView workflow={workflow} />}
      {state.step === 'done' && <ImagesResultView workflow={workflow} />}
    </div>
  );
};
