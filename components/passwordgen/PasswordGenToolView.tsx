'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Copy, Check, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react';

export interface PasswordGenToolViewProps {
  onBack: () => void;
}

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?/',
};
const AMBIGUOUS = /[Il1O0o]/g;

type SetKey = keyof typeof SETS;

/** Crypto-secure index in [0, max) — rejection sampling, no modulo bias. */
function randomIndex(max: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / max) * max;
  let v = 0;
  do {
    crypto.getRandomValues(buf);
    v = buf[0];
  } while (v >= limit);
  return v % max;
}

function generatePassword(length: number, pools: SetKey[], avoidAmbiguous: boolean): string {
  let alphabet = pools.map((k) => SETS[k]).join('');
  if (avoidAmbiguous) alphabet = alphabet.replace(AMBIGUOUS, '');
  if (!alphabet) return '';
  // Guarantee at least one char from each selected set, then fill randomly.
  const chars: string[] = pools
    .map((k) => {
      let set = SETS[k];
      if (avoidAmbiguous) set = set.replace(AMBIGUOUS, '');
      return set[randomIndex(set.length)];
    })
    .filter(Boolean);
  while (chars.length < length) chars.push(alphabet[randomIndex(alphabet.length)]);
  // Fisher–Yates with crypto randomness.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.slice(0, length).join('');
}

function entropyBits(length: number, poolSize: number): number {
  return Math.round(length * Math.log2(Math.max(poolSize, 2)));
}

function strengthOf(bits: number): { label: string; tone: string; bar: string; pct: number } {
  if (bits < 50) return { label: 'Weak', tone: 'text-danger', bar: 'bg-danger', pct: 25 };
  if (bits < 80) return { label: 'Fair', tone: 'text-warning', bar: 'bg-warning', pct: 50 };
  if (bits < 110) return { label: 'Strong', tone: 'text-success', bar: 'bg-success', pct: 75 };
  return { label: 'Very strong', tone: 'text-success', bar: 'bg-success', pct: 100 };
}

const QUANTITIES = [1, 3, 5, 10] as const;

/**
 * Password Generator — crypto-grade randomness, fully on-device.
 * Single-screen tool: options on the left, results on top; regenerate on
 * any option change so the output is always in sync.
 */
export const PasswordGenToolView: React.FC<PasswordGenToolViewProps> = ({ onBack }) => {
  const [length, setLength] = useState(16);
  const [pools, setPools] = useState<SetKey[]>(['lower', 'upper', 'digits', 'symbols']);
  const [avoidAmbiguous, setAvoidAmbiguous] = useState(false);
  const [quantity, setQuantity] = useState<(typeof QUANTITIES)[number]>(1);
  const [passwords, setPasswords] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const regenerate = useCallback(() => {
    if (pools.length === 0) {
      setPasswords([]);
      setError('Pick at least one character set.');
      return;
    }
    setError(null);
    setPasswords(Array.from({ length: quantity }, () => generatePassword(length, pools, avoidAmbiguous)));
  }, [length, pools, avoidAmbiguous, quantity]);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const poolSize = useMemo(() => {
    let size = pools.map((k) => SETS[k]).join('').length;
    if (avoidAmbiguous) size -= 5; // I l 1 O 0
    return Math.max(size, 0);
  }, [pools, avoidAmbiguous]);

  const bits = entropyBits(length, poolSize);
  const strength = strengthOf(bits);

  const togglePool = (key: SetKey) => {
    setPools((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      return [...prev, key];
    });
  };

  const copy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      // Clipboard blocked (insecure context) — fall back to select-all.
      setError('Copy blocked by the browser — select the text manually.');
    }
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
          <h1 className="truncate text-[15px] font-bold text-ink">Password Generator</h1>
          <p className="truncate text-[11px] text-ink-faint">Crypto-random · never stored · 100% on-device</p>
        </div>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-bold tabular-nums text-accent-soft">
          {bits} bits
        </span>
      </header>

      {/* Results */}
      <section aria-label="Generated passwords" className="flex flex-col gap-2.5 rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg sm:p-4">
        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-faint/50 px-3 py-2 text-xs font-semibold text-danger">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
        {passwords.map((pw, i) => (
          <div
            key={`${pw}-${i}`}
            className="flex items-center gap-2 rounded-xl border border-elevated/70 bg-surface-2/60 px-3 py-2.5"
          >
            <output
              aria-label={`Generated password ${i + 1}`}
              className="min-w-0 flex-1 break-all font-mono text-sm font-semibold tracking-wide text-ink select-all"
            >
              {pw}
            </output>
            <button
              type="button"
              onClick={() => copy(pw, i)}
              aria-label={`Copy password ${i + 1}`}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-95 ${
                copiedIndex === i
                  ? 'border-success/40 bg-success/15 text-success'
                  : 'border-elevated/60 bg-surface text-ink-muted hover:bg-elevated hover:text-ink'
              }`}
            >
              {copiedIndex === i ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        ))}
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={regenerate}
            disabled={pools.length === 0}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary-strong px-5 text-sm font-bold text-white shadow-md shadow-primary/20 transition hover:bg-primary hover:shadow-lg active:scale-[0.98] disabled:opacity-40"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Regenerate
          </button>
          <span className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-2 text-xs font-bold text-success">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            On-device
          </span>
        </div>
      </section>

      {/* Strength meter */}
      <section aria-label="Password strength" className="rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg sm:p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-ink">Strength</span>
          <span className={`text-sm font-extrabold ${strength.tone}`}>{strength.label}</span>
        </div>
        <div
          role="meter"
          aria-valuemin={0}
          aria-valuemax={128}
          aria-valuenow={bits}
          aria-label={`Entropy ${bits} bits — ${strength.label}`}
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-elevated"
        >
          <div className={`h-full rounded-full ${strength.bar} transition-[width] duration-300`} style={{ width: `${strength.pct}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-ink-muted">
          {bits} bits of entropy · {poolSize} character pool
        </p>
      </section>

      {/* Options */}
      <section aria-label="Password options" className="flex flex-col gap-4 rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg sm:p-4">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-ink">Length</span>
            <span className="rounded-md border border-primary/30 bg-primary/20 px-2 py-0.5 text-xs font-bold tabular-nums text-primary-soft">
              {length}
            </span>
          </div>
          <input
            type="range"
            min={8}
            max={64}
            step={1}
            value={length}
            aria-label="Password length"
            onChange={(e) => setLength(Number(e.target.value))}
            className="mt-2 w-full cursor-pointer appearance-none rounded-full bg-elevated py-2
              [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary-soft
              [&::-webkit-slider-thumb]:bg-primary-strong [&::-webkit-slider-thumb]:shadow-md
              [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary-soft [&::-moz-range-thumb]:bg-primary-strong"
            style={{ background: `linear-gradient(to right, var(--color-primary) ${((length - 8) / 56) * 100}%, var(--color-elevated) ${((length - 8) / 56) * 100}%)` }}
          />
        </div>

        <div className="flex flex-col gap-1 border-t border-surface-2 pt-2">
          {(Object.keys(SETS) as SetKey[]).map((key) => (
            <button
              key={key}
              type="button"
              role="switch"
              aria-checked={pools.includes(key)}
              onClick={() => togglePool(key)}
              className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft"
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-bold text-ink">
                  {key === 'lower' && 'Lowercase (a–z)'}
                  {key === 'upper' && 'Uppercase (A–Z)'}
                  {key === 'digits' && 'Numbers (0–9)'}
                  {key === 'symbols' && 'Symbols (!@#$…)'}
                </span>
                <span className="truncate font-mono text-xs text-ink-faint">{SETS[key]}</span>
              </span>
              <span
                aria-hidden="true"
                className={`relative inline-flex h-7 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
                  pools.includes(key) ? 'bg-primary-strong' : 'bg-elevated'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    pools.includes(key) ? 'translate-x-[22px]' : 'translate-x-[4px]'
                  }`}
                />
              </span>
            </button>
          ))}
          <button
            type="button"
            role="switch"
            aria-checked={avoidAmbiguous}
            onClick={() => setAvoidAmbiguous((v) => !v)}
            className="flex min-h-[44px] w-full items-center justify-between gap-3 border-t border-surface-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft"
          >
            <span className="flex flex-col">
              <span className="text-sm font-bold text-ink">Avoid look-alikes</span>
              <span className="text-xs text-ink-muted">Skip I l 1 O 0 — easier to read aloud</span>
            </span>
            <span
              aria-hidden="true"
              className={`relative inline-flex h-7 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
                avoidAmbiguous ? 'bg-primary-strong' : 'bg-elevated'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  avoidAmbiguous ? 'translate-x-[22px]' : 'translate-x-[4px]'
                }`}
              />
            </span>
          </button>
        </div>

        <div className="border-t border-surface-2 pt-3">
          <span className="text-sm font-bold text-ink">How many</span>
          <div className="mt-2 flex gap-2" role="group" aria-label="Number of passwords to generate">
            {QUANTITIES.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuantity(q)}
                aria-pressed={quantity === q}
                className={`h-10 flex-1 rounded-xl border text-sm font-bold transition-all active:scale-[0.97] ${
                  quantity === q
                    ? 'border-primary/40 bg-primary/15 text-primary-soft shadow-sm'
                    : 'border-elevated/60 bg-surface-2/60 text-ink-muted hover:bg-elevated'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
