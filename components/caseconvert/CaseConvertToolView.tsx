'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Copy, Check, Trash2 } from 'lucide-react';

export interface CaseConvertToolViewProps {
  onBack: () => void;
}

type CaseKey =
  | 'upper'
  | 'lower'
  | 'title'
  | 'sentence'
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'kebab'
  | 'constant'
  | 'alternating'
  | 'inverse';

const CASES: Array<{ key: CaseKey; label: string; hint: string }> = [
  { key: 'upper', label: 'UPPERCASE', hint: 'HELLO WORLD' },
  { key: 'lower', label: 'lowercase', hint: 'hello world' },
  { key: 'title', label: 'Title Case', hint: 'Hello World' },
  { key: 'sentence', label: 'Sentence case', hint: 'Hello world' },
  { key: 'camel', label: 'camelCase', hint: 'helloWorld' },
  { key: 'pascal', label: 'PascalCase', hint: 'HelloWorld' },
  { key: 'snake', label: 'snake_case', hint: 'hello_world' },
  { key: 'kebab', label: 'kebab-case', hint: 'hello-world' },
  { key: 'constant', label: 'CONSTANT_CASE', hint: 'HELLO_WORLD' },
  { key: 'alternating', label: 'aLtErNaTiNg', hint: 'hElLo WoRlD' },
  { key: 'inverse', label: 'InVeRsE CaSe', hint: 'hELLO wORLD' },
];

function toWords(text: string): string[] {
  return text
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .flatMap((w) => w.split(/(?=[A-Z])/))
    .join(' ')
    .split(/\s+/)
    .filter(Boolean);
}

function convert(text: string, key: CaseKey): string {
  if (!text.trim()) return '';
  const words = toWords(text);
  switch (key) {
    case 'upper':
      return text.toUpperCase();
    case 'lower':
      return text.toLowerCase();
    case 'title':
      return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    case 'sentence': {
      const lower = text.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }
    case 'camel':
      return words
        .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
        .join('');
    case 'pascal':
      return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    case 'snake':
      return words.map((w) => w.toLowerCase()).join('_');
    case 'kebab':
      return words.map((w) => w.toLowerCase()).join('-');
    case 'constant':
      return words.map((w) => w.toUpperCase()).join('_');
    case 'alternating': {
      let out = '';
      let upper = false;
      for (const ch of text) {
        if (/[a-zA-Z]/.test(ch)) {
          out += upper ? ch.toUpperCase() : ch.toLowerCase();
          upper = !upper;
        } else out += ch;
      }
      return out;
    }
    case 'inverse':
      return [...text].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('');
  }
}

/**
 * Case Converter — 11 formats live as you type, each with one-tap copy.
 * Fully on-device, no upload.
 */
export const CaseConvertToolView: React.FC<CaseConvertToolViewProps> = ({ onBack }) => {
  const [text, setText] = useState('The quick brown fox jumps over the lazy dog');
  const [copiedKey, setCopiedKey] = useState<CaseKey | null>(null);

  const outputs = useMemo(() => CASES.map((c) => ({ ...c, value: convert(text, c.key) })), [text]);

  const copy = async (value: string, key: CaseKey) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1500);
    } catch {}
  };

  return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <header className="sticky top-0 z-30 -mx-4 flex items-center gap-3 border-b border-surface-2/70 bg-bg/90 px-4 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to tools"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-elevated/60 bg-surface/80 text-ink transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-soft"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-[15px] font-bold text-ink">Case Converter</h1>
          <p className="truncate text-[11px] text-ink-faint">UPPER · lower · camel · snake · on-device</p>
        </div>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-bold tabular-nums text-accent-soft">
          11 forms
        </span>
      </header>

      <section aria-label="Your text" className="rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg sm:p-4">
        <div className="flex items-center justify-between">
          <label htmlFor="cc-text" className="text-sm font-bold text-ink">
            Your text
          </label>
          {text && (
            <button
              type="button"
              onClick={() => setText('')}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-ink-muted transition hover:bg-elevated hover:text-ink"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </button>
          )}
        </div>
        <textarea
          id="cc-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Type or paste any text…"
          className="mt-2 w-full resize-y rounded-xl border border-elevated bg-surface-2/60 px-3.5 py-3 text-sm leading-relaxed text-ink placeholder:text-ink-faint focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </section>

      <section aria-label="Converted cases" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {outputs.map((c) => (
          <div
            key={c.key}
            className="flex flex-col gap-2 rounded-xl border border-elevated/70 bg-surface/80 p-3 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold tracking-wide text-ink-muted">{c.label}</span>
              <span className="truncate text-2xs font-medium text-ink-faint">{c.hint}</span>
            </div>
            <div className="flex items-center gap-2">
              <output
                aria-label={`${c.label} result`}
                className="min-w-0 flex-1 break-words rounded-lg border border-elevated/50 bg-surface-2/50 px-3 py-2.5 font-mono text-sm text-ink select-all"
              >
                {c.value || <span className="text-ink-faint">—</span>}
              </output>
              <button
                type="button"
                onClick={() => copy(c.value, c.key)}
                disabled={!c.value}
                aria-label={`Copy ${c.label}`}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-95 ${
                  copiedKey === c.key
                    ? 'border-success/40 bg-success/15 text-success'
                    : 'border-elevated/60 bg-surface text-ink-muted hover:bg-elevated hover:text-ink disabled:opacity-40'
                }`}
              >
                {copiedKey === c.key ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};
