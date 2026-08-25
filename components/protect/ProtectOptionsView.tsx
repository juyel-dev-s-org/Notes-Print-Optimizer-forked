'use client';

import React, { useState } from 'react';
import { AlertCircle, ChevronDown, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { ToggleRow } from '@/components/ui/Toggle';
import { Button } from '@/components/ui/Button';
import type { ProtectWorkflow } from '@/lib/protect/useProtectWorkflow';

const ISO_LINE = (
  <p className="text-[11px] leading-relaxed text-ink-muted">
    Encrypted with{' '}
    <a
      href="https://www.iso.org/standard/75839.html"
      target="_blank"
      rel="noopener noreferrer"
      className="font-bold text-primary-soft underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
    >
      AES-256
    </a>{' '}
    — the PDF Standard Security Handler defined in ISO 32000-2.
  </p>
);

const HONESTY_NOTE = (
  <p className="text-2xs leading-relaxed text-warning-strong">
    Note: permission locks are honoured by compliant PDF readers. A strong open
    password is what truly keeps the contents private.
  </p>
);

function PasswordInput({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[11px] font-bold tracking-wide text-ink-muted">
        {label}
      </label>
      <div className="flex items-stretch overflow-hidden rounded-xl border border-elevated bg-surface/80 focus-within:border-primary/50">
        <Lock className="ml-3 self-center h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          spellCheck={false}
          className="h-11 min-w-0 flex-1 bg-transparent px-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          placeholder={hint ?? 'Enter a strong password'}
          aria-label={label}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="mr-1 flex h-9 w-9 items-center justify-center self-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

/** Lock options + passwords; the PROTECT hand-off with staged progress. */
export const ProtectOptionsView: React.FC<{ workflow: ProtectWorkflow }> = ({ workflow }) => {
  const {
    state,
    canProtect,
    handleProtect,
    handleSetUserPassword,
    handleSetOwnerPassword,
    handleToggleLock,
    handleReset,
  } = workflow;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const busy = state.isBusy;

  return (
    <div className="flex flex-col gap-4">
      {/* Source summary */}
      <div className="flex items-center gap-3 rounded-2xl border border-surface-2 bg-surface/80 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-faint/60 text-primary-soft border border-primary/30">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{state.source?.name}</p>
          <p className="text-xs text-ink-muted">{state.source?.sizeMB} MB · ready to secure</p>
        </div>
      </div>

      {/* Options */}
      <section className="flex flex-col gap-4 rounded-2xl border border-surface-2 bg-surface/80 p-4" aria-busy={busy}>
        <h3 className="text-sm font-bold tracking-wide text-ink">Security Options</h3>

        <PasswordInput
          id="open-password"
          label="Password to open (optional)"
          hint="Leave empty for permissions-only"
          value={state.userPassword}
          onChange={handleSetUserPassword}
        />

        <div className="flex flex-col divide-y divide-surface-2/70 border-t border-surface-2/70 pt-1">
          <ToggleRow label="Lock Printing" hint="Recipients cannot print the document" enabled={state.locks.printing} onChange={() => handleToggleLock('printing')} />
          <ToggleRow label="Lock Copying" hint="Text and images cannot be copied or extracted" enabled={state.locks.copying} onChange={() => handleToggleLock('copying')} />
          <ToggleRow label="Lock Modifying" hint="Content and pages cannot be changed" enabled={state.locks.modifying} onChange={() => handleToggleLock('modifying')} />
        </div>

        {/* Advanced */}
        <div className="border-t border-surface-2/70 pt-2">
          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            aria-expanded={showAdvanced}
            className="flex h-9 w-full items-center justify-between rounded-lg px-1 text-[11px] font-bold uppercase tracking-wide text-ink-muted transition-colors hover:text-ink"
          >
            Owner password — advanced
            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {showAdvanced && (
            <div role="region" aria-label="Owner password settings" className="mt-1 flex flex-col gap-1.5 animate-enter">
              <PasswordInput
                id="owner-password"
                label="Owner password"
                hint="Master key — blank auto-generates one"
                value={state.ownerPassword}
                onChange={handleSetOwnerPassword}
              />
              <p className="text-2xs leading-relaxed text-ink-faint">
                The owner password can lift every restriction above. Leave it blank and an
                unguessable random key is generated on this device only.
              </p>
            </div>
          )}
        </div>

        {busy ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-primary/30 bg-primary-faint/30 px-4 py-6 animate-enter">
            <ShieldCheck className="h-8 w-8 animate-pulse text-primary-soft" aria-hidden="true" />
            <p className="text-sm font-bold text-ink">{state.progress?.label}</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{ width: `${state.progress?.pct ?? 8}%`, background: 'var(--gradient-brand)' }}
              />
            </div>
            <p className="text-xs tabular-nums text-ink-muted">{state.progress?.pct}% · keep this tab open</p>
          </div>
        ) : (
          <>
            {ISO_LINE}
            {HONESTY_NOTE}
            <Button size="lg" fullWidth disabled={!canProtect} onClick={handleProtect}>
              <Lock className="h-4 w-4" aria-hidden="true" />
              Protect PDF
            </Button>
            {!canProtect && (
              <p className="-mt-2 text-center text-2xs font-semibold text-ink-faint">
                Set an open password or enable at least one lock.
              </p>
            )}
            <Button variant="ghost" size="md" fullWidth onClick={handleReset}>
              Choose a different file
            </Button>
          </>
        )}
      </section>

      {state.error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-800/70 bg-red-950/60 px-4 py-3 text-xs text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      )}
    </div>
  );
};
