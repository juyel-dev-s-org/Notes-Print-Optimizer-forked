'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
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

const MOBILE_QUERY = '(max-width: 639px)';
const TABLET_QUERY = '(min-width: 640px) and (max-width: 1023px)';
const DESKTOP_QUERY = '(min-width: 1024px)';

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
    () => false,
  );
}

export const PlatformUIOrchestrator: React.FC<WorkflowUIProps> = ({ state, actions, handlers, resume }) => {
  const [overrideMode, setOverrideMode] = useState<PlatformOverride>('AUTO');
  const [mounted, setMounted] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isTablet = useMediaQuery(TABLET_QUERY);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  useEffect(() => setMounted(true), []);

  const platformProps = { state, actions, handlers, resume };

  return (
    <div className="w-full max-w-full">
      {/* Device Viewport Override Toolbar */}
      <div className="mb-4 lg:mb-3 flex items-center justify-between gap-2 rounded-xl border border-surface-2 bg-surface/60 p-2 lg:p-1.5 text-xs">
        <div className="flex items-center gap-2">
          <Settings2 className="h-3.5 w-3.5 text-primary-soft" />
          <span className="font-bold text-ink-muted text-[11px]">Platform Layout Mode:</span>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-bg p-1 border border-surface-2">
          <button
            type="button"
            onClick={() => setOverrideMode('AUTO')}
            aria-pressed={overrideMode === 'AUTO'}
            className={`flex h-8 items-center gap-1 px-2.5 rounded-md text-[11px] font-bold transition-colors ${
              overrideMode === 'AUTO'
                ? 'bg-primary-strong text-white shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <span>Auto Responsive</span>
          </button>

          <button
            type="button"
            onClick={() => setOverrideMode('MOBILE')}
            aria-pressed={overrideMode === 'MOBILE'}
            className={`flex h-8 items-center gap-1 px-2.5 rounded-md text-[11px] font-bold transition-colors ${
              overrideMode === 'MOBILE'
                ? 'bg-primary-strong text-white shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
            title="Force Mobile UI View"
          >
            <Smartphone className="h-3 w-3" />
            <span className="hidden sm:inline">Mobile</span>
          </button>

          <button
            type="button"
            onClick={() => setOverrideMode('TABLET')}
            aria-pressed={overrideMode === 'TABLET'}
            className={`flex h-8 items-center gap-1 px-2.5 rounded-md text-[11px] font-bold transition-colors ${
              overrideMode === 'TABLET'
                ? 'bg-primary-strong text-white shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
            title="Force Tablet UI View"
          >
            <Tablet className="h-3 w-3" />
            <span className="hidden sm:inline">Tablet</span>
          </button>

          <button
            type="button"
            onClick={() => setOverrideMode('DESKTOP')}
            aria-pressed={overrideMode === 'DESKTOP'}
            className={`flex h-8 items-center gap-1 px-2.5 rounded-md text-[11px] font-bold transition-colors ${
              overrideMode === 'DESKTOP'
                ? 'bg-primary-strong text-white shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
            title="Force Desktop UI View"
          >
            <Monitor className="h-3 w-3" />
            <span className="hidden sm:inline">Desktop</span>
          </button>
        </div>
      </div>

      {/* Resume Prompt Banner */}
      {resume.resumeInfo && state.currentPhase === 1 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <RotateCcw className="h-5 w-5 shrink-0 text-warning" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-200">Resume where you left off?</p>
              <p className="text-[11px] text-amber-300/70 truncate">
                {resume.resumeInfo.completedCount} of {resume.resumeInfo.totalPages} pages already processed.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlers.handleResumeProcessing}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-amber-500 transition-colors"
            >
              Resume
            </button>
            <button
              type="button"
              onClick={handlers.handleDismissResume}
              aria-label="Dismiss resume prompt"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-amber-300/70 hover:bg-amber-950/60 hover:text-amber-200 transition-colors"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Render only the active view (matchMedia) so idle platform UIs stay unmounted */}
      {mounted && overrideMode === 'MOBILE' && <MobileWorkflowUI {...platformProps} />}
      {mounted && overrideMode === 'TABLET' && <TabletWorkflowUI {...platformProps} />}
      {mounted && overrideMode === 'DESKTOP' && <DesktopWorkflowUI {...platformProps} />}

      {mounted && overrideMode === 'AUTO' && (
        <>
          {/* Mobile Layout (<640px) */}
          {isMobile && <MobileWorkflowUI {...platformProps} />}

          {/* Tablet Layout (>=640px and <1024px) */}
          {isTablet && <TabletWorkflowUI {...platformProps} />}

          {/* Desktop/Laptop Layout (>=1024px) */}
          {isDesktop && <DesktopWorkflowUI {...platformProps} />}
        </>
      )}
    </div>
  );
};
