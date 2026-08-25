'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';

export interface WordCountToolViewProps {
  onBack: () => void;
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it', 'its', 'this', 'that', 'these', 'those',
  'as', 'if', 'then', 'than', 'so', 'such', 'not', 'no', 'do', 'does', 'did', 'have', 'has', 'had',
  'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her', 'our', 'their', 'will', 'would',
]);

function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 1) return 'under a minute';
  const minutes = Math.round(totalMinutes);
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `~${h} hr` : `~${h} hr ${m} min`;
}

/**
 * Word Counter — live text statistics with reading/speaking time and
 * top-keyword insight. Everything computes locally as you type.
 */
export const WordCountToolView: React.FC<WordCountToolViewProps> = ({ onBack }) => {
  const [text, setText] = useState('');

  const stats = useMemo(() => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    const sentences = trimmed ? trimmed.split(/[.!?…]+(?:\s|$)/).filter((s) => s.trim().length > 0) : [];
    const paragraphs = trimmed ? trimmed.split(/\n{2,}/).filter((p) => p.trim().length > 0) : [];

    const freq = new Map<string, number>();
    for (const raw of words) {
      const w = raw.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, '');
      if (w.length < 3 || STOP_WORDS.has(w)) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
      words: words.length,
      chars: text.length,
      charsNoSpaces: text.replace(/\s/g, '').length,
      sentences: sentences.length,
      paragraphs: paragraphs.length,
      reading: formatDuration(words.length / 200),
      speaking: formatDuration(words.length / 130),
      top,
    };
  }, [text]);

  const cards: Array<{ label: string; value: string | number; accent?: boolean }> = [
    { label: 'Words', value: stats.words, accent: true },
    { label: 'Characters', value: stats.chars },
    { label: 'No spaces', value: stats.charsNoSpaces },
    { label: 'Sentences', value: stats.sentences },
    { label: 'Paragraphs', value: stats.paragraphs },
  ];

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
          <h1 className="truncate text-[15px] font-bold text-ink">Word Counter</h1>
          <p className="truncate text-[11px] text-ink-faint">Live stats · reading time · on-device</p>
        </div>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-bold tabular-nums text-accent-soft">
          {stats.words} w
        </span>
      </header>

      {/* Stat cards */}
      <section aria-label="Text statistics" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-3 text-center ${
              c.accent ? 'border-primary/30 bg-primary/10' : 'border-surface-2 bg-surface/90 shadow-sm'
            }`}
          >
            <span className={`text-xl font-extrabold tabular-nums ${c.accent ? 'text-primary-soft' : 'text-ink'}`}>
              {c.value.toLocaleString()}
            </span>
            <span className="text-[11px] font-semibold leading-tight text-ink-muted">{c.label}</span>
          </div>
        ))}
      </section>

      <section aria-label="Time estimates" className="grid grid-cols-2 gap-2">
        <div className="flex items-center justify-between rounded-xl border border-surface-2 bg-surface/90 px-3.5 py-3 shadow-sm">
          <span className="text-xs font-semibold text-ink-muted">Reading</span>
          <span className="text-sm font-extrabold text-ink">{stats.reading}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-surface-2 bg-surface/90 px-3.5 py-3 shadow-sm">
          <span className="text-xs font-semibold text-ink-muted">Speaking</span>
          <span className="text-sm font-extrabold text-ink">{stats.speaking}</span>
        </div>
      </section>

      {/* Editor */}
      <section aria-label="Your text" className="rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg sm:p-4">
        <div className="flex items-center justify-between">
          <label htmlFor="wc-text" className="text-sm font-bold text-ink">
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
          id="wc-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          placeholder="Type or paste your essay, article, or notes — stats update as you write…"
          className="mt-2 w-full resize-y rounded-xl border border-elevated bg-surface-2/60 px-3.5 py-3 text-sm leading-relaxed text-ink placeholder:text-ink-faint focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </section>

      {/* Top keywords */}
      <section aria-label="Top keywords" className="rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg sm:p-4">
        <span className="text-sm font-bold text-ink">Top keywords</span>
        {stats.top.length === 0 ? (
          <p className="mt-2 text-xs text-ink-muted">Write a few sentences to see which words you use most.</p>
        ) : (
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {stats.top.map(([word, count]) => (
              <li
                key={word}
                className="flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary-soft"
              >
                {word}
                <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-2xs tabular-nums">×{count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
