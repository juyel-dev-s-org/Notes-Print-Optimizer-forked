'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { WorkflowUIProps } from './types';
import { X } from 'lucide-react';
import { Smartphone, Tablet, Monitor, Settings2 } from 'lucide-react';
import { PhaseSkeleton } from '@/components/shared/LoadingSkeleton';

const MobileWorkflowUI = dynamic(() => import('./mobile/MobileWorkflowUI').then(m => m.MobileWorkflowUI), {
  loading: () => <PhaseSkeleton phaseName="Mobile" />,
  ssr: false,
});

const TabletWorkflowUI = dynamic(() => import('./tablet/TabletWorkflowUI').then(m => m.TabletWorkflowUI), {
  loading: () => <PhaseSkeleton phaseName="Tablet" />,
  ssr: false,
});

const DesktopWorkflowUI = dynamic(() => import('./desktop/DesktopWorkflowUI').then(m => m.DesktopWorkflowUI), {
  loading: () => <PhaseSkeleton phaseName="Desktop" />,
  ssr: false,
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

export const PlatformUIOrchestrator: React.FC<WorkflowUIProps> = ({ state, actions, handlers, toolMode, onToolModeChange }) => {
  const [overrideMode, setOverrideMode] = useState<PlatformOverride>('AUTO');
  const [mounted, setMounted] = useState(false);
  const [barDismissed, setBarDismissed] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isTablet = useMediaQuery(TABLET_QUERY);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    try {
      if (localStorage.getItem('po:hidePlatformBar') === '1') setBarDismissed(true);
    } catch {}
  }, []);

  const platformProps = { state, actions, handlers, toolMode, onToolModeChange };

  const handleDismissBar = () => {
    setBarDismissed(true);
    try { localStorage.setItem('po:hidePlatformBar', '1'); } catch {}
  };

  return (
    <div className="w-full max-w-full min-w-0">
      {/* Platform bar — dev affordance: hidden on landing AND on phones (<sm) where
          forcing another platform's layout makes no sense. Dismissible. */}
      {toolMode !== null && !barDismissed && (
      <div className="mb-4 hidden items-center justify-between gap-3 rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-xs backdrop-blur-sm sm:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 border border-slate-700">
            <Settings2 className="h-3.5 w-3.5 text-indigo-400" />
          </span>
          <span className="text-[11px] font-bold tracking-wide text-slate-300">Platform Layout Mode:</span>
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-slate-950 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setOverrideMode('AUTO')}
            aria-pressed={overrideMode === 'AUTO'}
            className={`inline-flex h-11 items-center justify-center rounded-full px-3.5 text-[11px] font-bold transition-all ${
              overrideMode === 'AUTO'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            Auto Responsive
          </button>

          <button
            type="button"
            onClick={() => setOverrideMode('MOBILE')}
            aria-pressed={overrideMode === 'MOBILE'}
            className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold transition-all ${
              overrideMode === 'MOBILE'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title="Force Mobile UI View"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mobile</span>
          </button>

          <button
            type="button"
            onClick={() => setOverrideMode('TABLET')}
            aria-pressed={overrideMode === 'TABLET'}
            className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold transition-all ${
              overrideMode === 'TABLET'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title="Force Tablet UI View"
          >
            <Tablet className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tablet</span>
          </button>

          <button
            type="button"
            onClick={() => setOverrideMode('DESKTOP')}
            aria-pressed={overrideMode === 'DESKTOP'}
            className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold transition-all ${
              overrideMode === 'DESKTOP'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title="Force Desktop UI View"
          >
            <Monitor className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Desktop</span>
          </button>
        </div>
        <button
          type="button"
          onClick={handleDismissBar}
          aria-label="Dismiss platform bar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
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
