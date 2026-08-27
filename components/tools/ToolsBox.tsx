'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, SearchX, X } from 'lucide-react';
import { ToolCard } from './ToolCard';
import { TOOL_REGISTRY, getToolCategories, toolHref, type ToolCategory, type ToolDefinition } from '@/lib/tools/registry';
import { searchTools } from '@/lib/tools/search';

/** Most-requested conversion pair — pinned as quick pills under the search box. */
const QUICK_TOOL_IDS = ['to-pdf', 'to-images'] as const;

const QUICK_LABELS: Record<(typeof QUICK_TOOL_IDS)[number], string> = {
  'to-pdf': 'Image → PDF',
  'to-images': 'PDF → Images',
};

/**
 * Tool selector shown on all surfaces (mobile / tablet / desktop).
 * Stacked on mobile, 2-column grid from sm+ — upload stays primary above it.
 * Registry-driven: searchable by title/alias/keyword with fuzzy fallback;
 * category shortcut chips appear automatically once >1 category exists.
 *
 * Cards are real <Link>s to /tools/<slug>/ — the URL is the source of
 * truth for the active tool (deep-linkable + crawlable), so this component
 * needs no navigation props.
 */
export const ToolsBox: React.FC = () => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | ToolCategory>('all');

  const categories = useMemo(() => getToolCategories(TOOL_REGISTRY), []);

  const quickTools = useMemo(
    () =>
      QUICK_TOOL_IDS.map((id) => TOOL_REGISTRY.find((t) => t.id === id)).filter(
        (t): t is ToolDefinition => Boolean(t),
      ),
    [],
  );

  const visibleTools = useMemo(
    () =>
      searchTools(
        activeCategory === 'all' ? TOOL_REGISTRY : TOOL_REGISTRY.filter((t) => t.category === activeCategory),
        query,
      ),
    [activeCategory, query],
  );

  return (
    <section
      id="tools"
      aria-label="Choose a tool"
      className="flex flex-col gap-3 animate-slide-up scroll-mt-20"
      style={{ animationDelay: '80ms' }}
    >
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold tracking-wide text-ink">Choose a Tool for Your Notes</h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/15 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">12 Free • No sign-up</span>
      </div>

      {/* Search — student-friendly */}
      <div role="search" className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search — PYQ, dark slides, handwritten, image to pdf…"
          aria-label="Search tools"
          className="h-11 w-full rounded-xl border border-elevated bg-surface/80 pl-10 pr-10 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-emerald-500/30 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-soft"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Quick image-conversion shortcuts — top user intent, one tap away */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Quick image tools">
        {quickTools.map((tool) => (
          <Link
            key={tool.id}
            href={toolHref(tool.id)}
            prefetch={false}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-elevated bg-surface px-3 text-xs font-bold text-ink transition-colors hover:border-primary/40 hover:text-primary-soft"
          >
            <tool.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {QUICK_LABELS[tool.id as (typeof QUICK_TOOL_IDS)[number]]}
          </Link>
        ))}
      </div>

      {/* Category shortcut chips — horizontal scroll, future-proof for many categories */}
      {categories.length > 1 && (
        <div
          className="flex flex-nowrap gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
          role="group"
          aria-label="Filter tools by category"
        >
          {(['all', ...categories] as const).map((cat) => {
            const active = activeCategory === cat;
            const label =
              cat === 'all' ? 'All' : cat === 'pdf' ? 'PDF Tools' : cat === 'image' ? 'Image Tools' : 'Security Tools';
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveCategory(cat)}
                className={`h-8 shrink-0 snap-start rounded-full border px-3.5 text-xs font-bold capitalize transition-colors ${
                  active
                    ? 'border-primary/50 bg-primary-faint text-primary-soft'
                    : 'border-elevated bg-surface text-ink-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Cards */}
      {visibleTools.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr">
          {visibleTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <ToolCard
                key={tool.id}
                title={tool.title}
                description={tool.description}
                icon={Icon}
                gradient={tool.gradient}
                chips={tool.chips}
                cta={tool.cta}
                href={toolHref(tool.id)}
              />
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-elevated bg-surface/50 px-4 py-8 text-center">
          <SearchX className="h-6 w-6 text-ink-faint" aria-hidden="true" />
          <p className="text-sm font-bold text-ink">No tool found</p>
          <p className="text-xs text-ink-muted">
            Nothing matches &ldquo;{query.trim()}&rdquo; — try &ldquo;image&rdquo;, &ldquo;merge&rdquo; or &ldquo;password&rdquo;.
          </p>
        </div>
      )}
    </section>
  );
};
