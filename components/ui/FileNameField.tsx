'use client';

import React from 'react';
import { FileCheck2 } from 'lucide-react';

export interface FileNameFieldProps {
  baseName: string;
  onChange: (value: string) => void;
  /** Constant tail rendered as a chip, e.g. "-PrintReady.pdf". */
  suffix: string;
  label?: string;
}

/**
 * Shared output-name editor used by every tool's download step.
 * Keeps the editable base separate from the per-tool suffix chip so the
 * "-PrintReady.pdf" convention stays consistent app-wide.
 */
export const FileNameField: React.FC<FileNameFieldProps> = ({
  baseName,
  onChange,
  suffix,
  label = 'Filename after conversion',
}) => (
  <div className="flex flex-col gap-1.5 text-left">
    <label htmlFor="output-filename" className="text-[11px] font-bold tracking-wide text-ink-muted">
      {label}
    </label>
    <div className="flex items-stretch overflow-hidden rounded-xl border border-elevated bg-surface/80 focus-within:border-primary/50">
      <span className="flex items-center pl-3 pr-1 text-ink-faint" aria-hidden="true">
        <FileCheck2 className="h-4 w-4" />
      </span>
      <input
        id="output-filename"
        type="text"
        value={baseName}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        aria-label={label}
        placeholder="my-document"
        className="h-11 min-w-0 flex-1 bg-transparent pr-1 text-sm font-semibold text-ink placeholder:font-normal placeholder:text-ink-faint focus:outline-none"
      />
      <span
        aria-hidden="true"
        className="flex items-center border-l border-elevated/70 bg-primary-faint/40 px-2.5 text-xs font-bold tabular-nums text-primary-soft"
      >
        {suffix}
      </span>
    </div>
  </div>
);
