'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { WorkflowUIProps } from './types';
import { LandingHero } from '@/components/LandingHero';
import { ToolsBox } from '@/components/tools/ToolsBox';
import { PhaseSkeleton, CardSkeleton } from '@/components/shared/LoadingSkeleton';
import { PhaseErrorBoundary } from '@/components/shared/PhaseErrorBoundary';
import type { HandoffPageInput } from '@/lib/services/EnhanceHandoffService';

const WorkflowView = dynamic(() => import('./WorkflowView').then(m => m.WorkflowView), {
  loading: () => <PhaseSkeleton phaseName="Workflow" />,
  ssr: false,
});

const EnhanceToolView = dynamic(() => import('@/components/enhance/EnhanceToolView').then(m => m.EnhanceToolView), {
  loading: () => <CardSkeleton />,
  ssr: false,
});

const ProtectToolView = dynamic(() => import('@/components/protect/ProtectToolView').then(m => m.ProtectToolView), {
  loading: () => <CardSkeleton />,
  ssr: false,
});

const ImagesToolView = dynamic(() => import('@/components/toimages/ImagesToolView').then(m => m.ImagesToolView), {
  loading: () => <CardSkeleton />,
  ssr: false,
});

const MergeToolView = dynamic(() => import('@/components/tomerge/MergeToolView').then(m => m.MergeToolView), {
  loading: () => <CardSkeleton />,
  ssr: false,
});

const SplitToolView = dynamic(() => import('@/components/tosplit/SplitToolView').then(m => m.SplitToolView), {
  loading: () => <CardSkeleton />,
  ssr: false,
});

const ImagePdfToolView = dynamic(() => import('@/components/toimgpdf/ImagePdfToolView').then(m => m.ImagePdfToolView), {
  loading: () => <CardSkeleton />,
  ssr: false,
});

interface OrchestratorProps extends WorkflowUIProps {
  /** Enhance export -> N-Up layout handoff (optional for tests/storybook). */
  onEnhanceHandoff?: (pages: HandoffPageInput[]) => Promise<void>;
}

/**
 * Routes the active tool mode to its view. One responsive workflow view —
 * no platform forks, no JS media queries.
 */
export const PlatformUIOrchestrator: React.FC<OrchestratorProps> = ({ state, actions, handlers, toolMode, onToolModeChange, onEnhanceHandoff, enhanceHandoffActive, onBackToEnhance }) => {
  if (toolMode === null) {
    return (
      <div className="animate-enter flex w-full max-w-full min-w-0 flex-col gap-5 md:gap-6">
        <LandingHero />
        <ToolsBox
          onSelectDarkPrint={() => onToolModeChange?.('dark-print')}
          onSelectEnhance={() => onToolModeChange?.('enhance')}
          onSelectProtect={() => onToolModeChange?.('protect')}
          onSelectToImages={() => onToolModeChange?.('to-images')}
          onSelectMerge={() => onToolModeChange?.('merge')}
          onSelectSplit={() => onToolModeChange?.('split')}
          onSelectToPdf={() => onToolModeChange?.('to-pdf')}
        />
      </div>
    );
  }

  if (toolMode === 'enhance') {
    return (
      <div className="flex w-full max-w-full min-w-0 flex-col gap-4 pb-20 md:gap-6 md:pb-12">
        <EnhanceToolView
          onBack={() => onToolModeChange?.(null)}
          onHandoffToLayout={
            onEnhanceHandoff
              ? (pages) => void onEnhanceHandoff(pages)
              : undefined
          }
        />
      </div>
    );
  }

  if (toolMode === 'protect') {
    return (
      <div className="flex w-full max-w-full min-w-0 flex-col gap-4 pb-20 md:gap-6 md:pb-12">
        <ProtectToolView onBack={() => onToolModeChange?.(null)} />
      </div>
    );
  }

  if (toolMode === 'to-images') {
    return (
      <div className="flex w-full max-w-full min-w-0 flex-col gap-4 pb-20 md:gap-6 md:pb-12">
        <ImagesToolView onBack={() => onToolModeChange?.(null)} />
      </div>
    );
  }

  if (toolMode === 'merge') {
    return (
      <div className="flex w-full max-w-full min-w-0 flex-col gap-4 pb-20 md:gap-6 md:pb-12">
        <MergeToolView onBack={() => onToolModeChange?.(null)} />
      </div>
    );
  }

  if (toolMode === 'split') {
    return (
      <div className="flex w-full max-w-full min-w-0 flex-col gap-4 pb-20 md:gap-6 md:pb-12">
        <SplitToolView onBack={() => onToolModeChange?.(null)} />
      </div>
    );
  }

  if (toolMode === 'to-pdf') {
    return (
      <div className="flex w-full max-w-full min-w-0 flex-col gap-4 pb-20 md:gap-6 md:pb-12">
        <ImagePdfToolView onBack={() => onToolModeChange?.(null)} />
      </div>
    );
  }

  return (
    <PhaseErrorBoundary phaseName="Workflow">
      <WorkflowView
        state={state}
        actions={actions}
        handlers={handlers}
        onToolModeChange={onToolModeChange}
        enhanceHandoffActive={enhanceHandoffActive}
        onBackToEnhance={onBackToEnhance}
      />
    </PhaseErrorBoundary>
  );
};
