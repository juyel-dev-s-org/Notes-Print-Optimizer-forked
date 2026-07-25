'use client';

import React, { useState } from 'react';
import { WorkflowUIProps } from './types';
import { MobileWorkflowUI } from './mobile/MobileWorkflowUI';
import { TabletWorkflowUI } from './tablet/TabletWorkflowUI';
import { DesktopWorkflowUI } from './desktop/DesktopWorkflowUI';
import { Smartphone, Tablet, Monitor, Settings2 } from 'lucide-react';

export type PlatformOverride = 'AUTO' | 'MOBILE' | 'TABLET' | 'DESKTOP';

export const PlatformUIOrchestrator: React.FC<WorkflowUIProps> = (props) => {
  const [overrideMode, setOverrideMode] = useState<PlatformOverride>('AUTO');

  return (
    <div className="w-full max-w-full">
      {/* Device Viewport Override Toolbar */}
      <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2 text-xs">
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
