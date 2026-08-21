'use client';

import React from 'react';
import { FileText, Contrast } from 'lucide-react';
import { ToolCard } from './ToolCard';

export interface ToolsBoxProps {
  onSelectDarkPrint: () => void;
  onSelectEnhance: () => void;
}

const DARK_PRINT_GRADIENT = 'linear-gradient(135deg, #243BFF 0%, #0EA5E9 55%, #06B6D4 100%)';
const ENHANCE_GRADIENT = 'linear-gradient(135deg, #5B35FF 0%, #A12CFF 55%, #EC4899 100%)';

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
      gradient={DARK_PRINT_GRADIENT}
      chips={['Auto-whiten', 'Banner removal', 'Up to 10-up']}
      cta="Convert"
      onClick={onSelectDarkPrint}
    />

    <ToolCard
      title="Enhance Light PDF"
      description="Fix faint scans — darken light ink, boost contrast and sharpen handwritten notes so printouts stay readable."
      icon={Contrast}
      gradient={ENHANCE_GRADIENT}
      chips={['Darken ink', 'Contrast', 'Sharpen']}
      cta="Enhance"
      onClick={onSelectEnhance}
    />
  </section>
);