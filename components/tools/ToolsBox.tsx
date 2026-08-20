'use client';

import React from 'react';
import { FileText, Contrast } from 'lucide-react';
import { ToolCard } from './ToolCard';

export interface ToolsBoxProps {
  onSelectDarkPrint: () => void;
  onSelectEnhance: () => void;
}

const AURORA_GRADIENT = 'linear-gradient(135deg, #243BFF 0%, #5B35FF 55%, #A12CFF 100%)';

/**
 * Mobile-only "Choose a Tool" box shown on the landing phase.
 * Hidden on tablet/desktop (`md:hidden`) — those surfaces keep the
 * single-flow experience until multi-tool support is extended.
 */
export const ToolsBox: React.FC<ToolsBoxProps> = ({ onSelectDarkPrint, onSelectEnhance }) => (
  <section aria-label="Choose a tool" className="flex flex-col gap-3 md:hidden animate-slide-up" style={{ animationDelay: '80ms' }}>
    <div className="flex items-center justify-between px-1">
      <h2 className="text-sm font-bold tracking-wide text-white">Choose a Tool</h2>
      <span className="text-[10px] font-medium text-slate-500">Free · No sign-up</span>
    </div>

    <ToolCard
      title="Dark Notes → Print"
      description="Turn dark lecture slides into crisp, print-ready PDFs with auto-whitening and smart N-up layouts."
      icon={FileText}
      gradient={AURORA_GRADIENT}
      chips={['Auto-whiten', 'Banner removal', 'Up to 10-up']}
      cta="Convert"
      onClick={onSelectDarkPrint}
    />

    <ToolCard
      title="Enhance Light PDF"
      description="Fix faint scans — darken light ink, boost contrast and sharpen handwritten notes so printouts stay readable."
      icon={Contrast}
      gradient={AURORA_GRADIENT}
      chips={['Darken ink', 'Contrast', 'Sharpen']}
      cta="Enhance"
      onClick={onSelectEnhance}
    />
  </section>
);