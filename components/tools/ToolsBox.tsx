'use client';

import React, { useMemo, useState } from 'react';
import { Search, SearchX, X } from 'lucide-react';
import { ToolCard } from './ToolCard';
import { TOOL_REGISTRY, getToolCategories, type ToolCategory } from '@/lib/tools/registry';
import { searchTools } from '@/lib/tools/search';
import type { ToolMode } from '@/lib/enhance/types';

export interface ToolsBoxProps {
  onSelectDarkPrint: () => void;
  onSelectEnhance: () => void;
  onSelectProtect: () => void;
  onSelectToImages: () => void;
  onSelectMerge: () => void;
  onSelectSplit: () => void;
}

type LaunchMap = Record<ToolMode, () => void>;

/**
 * Tool selector shown on all surfaces (mobile / tablet / desktop).
 * Stacked on mobile, 2-column grid from sm+ — upload stays primary above it.
 * Registry-driven: searchable by title/alias/keyword with fuzzy fallback;
 * category shortcut chips appear automatically once >1 category exists.
 */
export const ToolsBox: React.FC<ToolsBoxProps> = ({ onSelectDarkPrint, onSelectEnhance, onSelectProtect, onSelectToImages, onSelectMerge, onSelectSplit }) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | ToolCategory>('all');

  const categories = useMemo(() => getToolCategories(TOOL_REGISTRY), []);
  const launches: LaunchMap = { 'dark-print': onSelectDarkPrint, enhance: onSelectEnhance, protect: onSelectProtect, 'to-images': onSelectToImages, merge: onSelectMerge, split: onSelectSplit };

  const visibleTools = useMemo(
    () =>
      searchTools(
        activeCategory === 'all' ? TOOL_REGISTRY : TOOL_REGISTRY.filter((t) => t.category === activeCategory),
        query,
      ),
    [activeCategory, query],
  );

  return (
    <section aria-label="Choose a tool" className="flex flex-col gap-3 animate-slide-up" style={{ animationDelay: '80ms' }}>
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold tracking-wide text-ink">Choose a Tool</h2>
        <span className="text-[10px] font-medium text-ink-faint">Free · No sign-up</span>
      </div>

      {/* Search */}
      <div role="search" className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools — password, whiten, faint…"
          aria-label="Search tools"
          className="h-11 w-full rounded-xl border border-elevated bg-surface/80 pl-10 pr-10 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-primary/50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-soft"
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

      {/* Category shortcut chips — auto-render once multiple categories exist */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter tools by category">
          {(['all', ...categories] as const).map((cat) => {
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveCategory(cat)}
                className={`h-8 rounded-full border px-3.5 text-xs font-bold capitalize transition-colors ${
                  active
                    ? 'border-primary/50 bg-primary-faint text-primary-soft'
                    : 'border-elevated bg-surface text-ink-muted hover:text-ink'
                }`}
              >
                {cat === 'all' ? 'All' : cat === 'pdf' ? 'PDF Tools' : `${cat} Tools`}
              </button>
            );
          })}
        </div>
      )}

      {/* Cards */}
      {visibleTools.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 min-[375px]:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr">
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
                onClick={launches[tool.id]}
              />
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-elevated bg-surface/50 px-4 py-8 text-center">
          <SearchX className="h-6 w-6 text-ink-faint" aria-hidden="true" />
          <p className="text-sm font-bold text-ink">No tool found</p>
          <p className="text-xs text-ink-muted">
            Nothing matches &ldquo;{query.trim()}&rdquo; — try &ldquo;print&rdquo;, &ldquo;scan&rdquo; or &ldquo;password&rdquo;.
          </p>
        </div>
      )}
    </section>
  );
};
