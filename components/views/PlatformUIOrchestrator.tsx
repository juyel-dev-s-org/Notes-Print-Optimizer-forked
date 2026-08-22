'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { WorkflowUIProps } from './types';
import { LandingHero } from '@/components/LandingHero';
import { ToolsBox } from '@/components/tools/ToolsBox';
import { PhaseSkeleton, CardSkeleton } from '@/components/shared/LoadingSkeleton';
import { PhaseErrorBoundary } from '@/components/shared/PhaseErrorBoundary';

const WorkflowView = dynamic(() => import('./WorkflowView').then(m => m.WorkflowView), {
  loading: () => <PhaseSkeleton phaseName="Workflow" />,
  ssr: false,
});

const EnhanceToolView = dynamic(() => import('@/components/enhance/EnhanceToolView').then(m => m.EnhanceToolView), {
  loading: () => <CardSkeleton />,
  ssr: false,
});

/**
 * Routes the active tool mode to its view. One responsive workflow view —
 * no platform forks, no JS media queries.
 */
export const PlatformUIOrchestrator: React.FC<WorkflowUIProps> = ({ state, actions, handlers, toolMode, onToolModeChange }) => {
  if (toolMode === null) {
    return (
      <div className="animate-enter flex w-full max-w-full min-w-0 flex-col gap-5 md:gap-6">
        <LandingHero />
        <ToolsBox
          onSelectDarkPrint={() => onToolModeChange?.('dark-print')}
          onSelectEnhance={() => onToolModeChange?.('enhance')}
        />
      </div>
    );
  }

  if (toolMode === 'enhance') {
    return (
      <div className="flex w-full max-w-full min-w-0 flex-col gap-4 pb-20 md:gap-6 md:pb-12">
        <EnhanceToolView onBack={() => onToolModeChange?.(null)} />
      </div>
    );
  }

  return (
    <PhaseErrorBoundary phaseName="Workflow">
      <WorkflowView state={state} actions={actions} handlers={handlers} onToolModeChange={onToolModeChange} />
    </PhaseErrorBoundary>
  );
};
