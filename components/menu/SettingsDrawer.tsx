'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { ChevronDown, ExternalLink, Loader2 } from 'lucide-react';
import { clearAppCaches, menuRegistry } from '@/lib/menu';
import type { ContentId, MenuItemConfig, ResolvedMenuSection } from '@/lib/menu';
import { getMenuIcon } from './icons';
import { ContentModal } from './ContentModal';
import { FeedbackModal } from './FeedbackModal';
import { InstallShareCard } from '@/components/InstallShareCard';
import { useToast } from '@/components/shared/Toast';

interface SettingsDrawerProps {
  /** Escape hatch for app-level actions declared in config (e.g. 'goto-merge'). */
  onAppAction?: (name: string) => void;
}

/**
 * Settings & Information Center.
 *
 * A generic, config-driven drawer. It renders whatever `menu.config.ts` declares
 * (via the MenuRegistry) and never hardcodes entries. Accordion behaviour:
 * every section starts collapsed, only one section is open at a time, and the
 * state is intentionally not persisted across reloads.
 */
export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ onAppAction }) => {
  const sections = useMemo<ResolvedMenuSection[]>(() => menuRegistry.resolve(), []);

  const [openSection, setOpenSection] = useState<string | null>(null);
  const [contentModal, setContentModal] = useState<ContentId | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const headerRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const toggleSection = useCallback((id: string) => {
    setOpenSection((prev) => (prev === id ? null : id));
  }, []);

  const { toast } = useToast();

  /** Keyboard navigation between accordion headers. */
  const onHeaderKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const last = sections.length - 1;
      let target: number | null = null;
      if (e.key === 'ArrowDown') target = index === last ? 0 : index + 1;
      else if (e.key === 'ArrowUp') target = index === 0 ? last : index - 1;
      else if (e.key === 'Home') target = 0;
      else if (e.key === 'End') target = last;
      if (target !== null) {
        e.preventDefault();
        headerRefs.current[target]?.focus();
      }
    },
    [sections.length]
  );

  /** Dispatch an item's declarative action. */
  const runAction = useCallback(
    async (item: MenuItemConfig) => {
      if (item.disabled) return;
      const action = item.action;
      switch (action.type) {
        case 'content':
          setContentModal(action.contentId);
          break;
        case 'feedback':
          setFeedbackOpen(true);
          break;
        case 'clear-cache':
          setBusy(true);
          try {
            const result = await clearAppCaches();
            toast(result.message, result.ok ? 'success' : 'error');
          } catch {
            toast('Could not clear cache.', 'error');
          } finally {
            setBusy(false);
          }
          break;
        case 'app':
          onAppAction?.(action.name);
          break;
        case 'link':
        case 'noop':
        default:
          break;
      }
    },
    [onAppAction, toast]
  );

  const renderItem = (item: MenuItemConfig) => {
    const Icon = getMenuIcon(item.icon);
    const disabled = !!item.disabled;

    const inner = (
      <>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-elevated/60 bg-surface-2/60">
          <Icon className="h-4 w-4 text-primary-soft" />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-1.5">
            <span className={`truncate text-xs font-semibold ${disabled ? 'text-ink-muted' : 'text-ink'}`}>
              {item.title}
            </span>
            {item.badge && (
              <span className="shrink-0 rounded-full border border-primary/30 bg-primary/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-primary-soft">
                {item.badge}
              </span>
            )}
          </span>
          {item.description && (
            <span className="block truncate text-2xs text-ink-muted">{item.description}</span>
          )}
        </span>
        {item.action.type === 'link' && item.action.external && (
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
        )}
      </>
    );

    const rowClass =
      'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 transition-colors ' +
      (disabled
        ? 'cursor-not-allowed opacity-60'
        : 'hover:bg-surface-2/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary');

    if (item.action.type === 'link' && !disabled) {
      return (
        <a
          key={item.id}
          href={item.action.href}
          target={item.action.external ? '_blank' : undefined}
          rel={item.action.external ? 'noopener noreferrer' : undefined}
          className={rowClass}
        >
          {inner}
        </a>
      );
    }

    return (
      <button
        key={item.id}
        type="button"
        disabled={disabled}
        onClick={() => runAction(item)}
        className={rowClass}
      >
        {inner}
      </button>
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-2">
      {/* PWA install/share card - install when not installed, share once installed */}
      <InstallShareCard />

      {/* Accordion sections */}
      {sections.map((section, sIdx) => {
        const isOpen = openSection === section.id;
        const SectionIcon = getMenuIcon(section.icon);
        const headerId = `menu-header-${section.id}`;
        const panelId = `menu-panel-${section.id}`;

        return (
          <div key={section.id} className="overflow-hidden rounded-xl border border-surface-2 bg-bg/40">
            <button
              ref={(el) => { headerRefs.current[sIdx] = el; }}
              id={headerId}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggleSection(section.id)}
              onKeyDown={(e) => onHeaderKeyDown(e, sIdx)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-2/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <SectionIcon className="h-4 w-4 shrink-0 text-primary-soft" />
              <span className="flex-1 text-xs font-bold uppercase tracking-wide text-ink">
                {section.title}
              </span>
              <span className="text-2xs font-medium text-ink-muted">{section.items.length}</span>
              <motion.span
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.18 }}
                className="text-ink-muted"
              >
                <ChevronDown className="h-4 w-4" />
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panelId}
                  role="region"
                  aria-labelledby={headerId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="space-y-0.5 px-2 pb-2 pt-1">
                    {section.items.map((item) => renderItem(item))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Busy indicator for async actions */}
      {busy && (
        <div role="status" className="flex items-center justify-center gap-2 py-1 text-[11px] text-ink-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Working&hellip;</span>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {contentModal && (
          <ContentModal key="content" contentId={contentModal} onClose={() => setContentModal(null)} />
        )}
        {feedbackOpen && <FeedbackModal key="feedback" onClose={() => setFeedbackOpen(false)} />}
      </AnimatePresence>
      </div>
    </MotionConfig>
  );
};
