'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { WorkflowUIProps } from './types';
import { RotateCcw, X } from 'lucide-react';
import { Smartphone, Tablet, Monitor, Settings2 } from 'lucide-react';
import { PhaseSkeleton } from '@/components/shared/LoadingSkeleton';

const MobileWorkflowUI = dynamic(() => import('./mobile/MobileWorkflowUI').then(m => m.MobileWorkflowUI), {
  loading: () => <PhaseSkeleton phaseName="Mobile" />,
});

const TabletWorkflowUI = dynamic(() => import('./tablet/TabletWorkflowUI').then(m => m.TabletWorkflowUI), {
  loading: () => <PhaseSkeleton phaseName="Tablet" />,
});

const DesktopWorkflowUI = dynamic(() => import('./desktop/DesktopWorkflowUI').then(m => m.DesktopWorkflowUI), {
  loading: () => <PhaseSkeleton phaseName="Desktop" />,
});

type PlatformOverride = 'AUTO' | 'MOBILE' | 'TABLET' | 'DESKTOP';

export const PlatformUIOrchestrator: React.FC<WorkflowUIProps> = (props) => {
  const [overrideMode, setOverrideMode] = useState<PlatformOverride>('AUTO');

  return (
    <div className="w-full max-w-full">
      {/* Device Viewport Override Toolbar */}
      <div className="mb-4 lg:mb-3 flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2 lg:p-1.5 text-xs">
        <div className="flex items-center gap-2">
          <Settings2 className="h-3.5 w-3.5 text-indigo-400" />
          <span className="font-bold text-slate-300 text-[11px]">Platform Layout Mode:</span>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-950 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setOverrideMode('AUTO')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
              overrideMode === 'AUTO'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Auto Responsive</span>
          </button>

          <button
            type="button"
            onClick={() => setOverrideMode('MOBILE')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
              overrideMode === 'MOBILE'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Force Mobile UI View"
          >
            <Smartphone className="h-3 w-3" />
            <span className="hidden sm:inline">Mobile</span>
          </button>

          <button
            type="button"
            onClick={() => setOverrideMode('TABLET')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
              overrideMode === 'TABLET'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Force Tablet UI View"
          >
            <Tablet className="h-3 w-3" />
            <span className="hidden sm:inline">Tablet</span>
          </button>

          <button
            type="button"
            onClick={() => setOverrideMode('DESKTOP')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
              overrideMode === 'DESKTOP'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Force Desktop UI View"
          >
            <Monitor className="h-3 w-3" />
            <span className="hidden sm:inline">Desktop</span>
          </button>
        </div>
      </div>

      {/* Resume Prompt Banner */}
      {props.resumeInfo && props.currentPhase === 1 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <RotateCcw className="h-5 w-5 shrink-0 text-amber-400" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-200">Resume where you left off?</p>
              <p className="text-[11px] text-amber-300/70 truncate">
                {props.resumeInfo.completedCount} of {props.resumeInfo.totalPages} pages already processed.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={props.onResumeProcessing}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-amber-500 transition-colors"
            >
              Resume
            </button>
            <button
              type="button"
              onClick={props.onDismissResume}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-amber-300/70 hover:bg-amber-950/60 hover:text-amber-200 transition-colors"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Render view based on override or CSS responsive breakpoints */}
      {overrideMode === 'MOBILE' && <MobileWorkflowUI {...props} />}
      {overrideMode === 'TABLET' && <TabletWorkflowUI {...props} />}
      {overrideMode === 'DESKTOP' && <DesktopWorkflowUI {...props} />}

      {overrideMode === 'AUTO' && (
        <>
          {/* Mobile Layout (<640px) */}
          <div className="block sm:hidden">
            <MobileWorkflowUI {...props} />
          </div>

          {/* Tablet Layout (>=640px and <1024px) */}
          <div className="hidden sm:block lg:hidden">
            <TabletWorkflowUI {...props} />
          </div>

          {/* Desktop/Laptop Layout (>=1024px) */}
          <div className="hidden lg:block">
            <DesktopWorkflowUI {...props} />
          </div>
        </>
      )}
    </div>
  );
};
