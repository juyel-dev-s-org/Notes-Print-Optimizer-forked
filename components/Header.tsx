'use client';

import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  Menu,
  X,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { AppLogo } from './AppLogo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useDialogFocus } from '@/lib/ui/useDialogFocus';

import type { WorkflowPhase } from '@/lib/workflow/types';
export type { WorkflowPhase };

/* SettingsDrawer is heavy (markdown renderer, menu registry, feedback modal,
 * install/share card) but only renders when the menu opens - code-split it
 * out of First Load and preload on hamburger hover/focus for instant open. */
const LazySettingsDrawer = lazy(() => import('./menu/SettingsDrawer').then((m) => ({ default: m.SettingsDrawer })));

interface HeaderProps {
  currentPhase: WorkflowPhase;
  onReset?: () => void;
  onNavigatePhase?: (phase: WorkflowPhase) => void;
  isProcessing?: boolean;
  /** Controls stepper visibility — landing has no stepper until a tool is chosen */
  showStepper?: boolean;
}

interface SettingsDrawerProps {
  onAppAction?: (name: string) => void;
}

const SettingsDrawer = ({ onAppAction }: SettingsDrawerProps) => (
  <Suspense fallback={<div className="flex h-40 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-soft border-t-transparent" /></div>}>
    <LazySettingsDrawer onAppAction={onAppAction} />
  </Suspense>
);

export const Header: React.FC<HeaderProps> = ({
  currentPhase,
  onReset,
  onNavigatePhase,
  isProcessing = false,
  showStepper = false,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Escape closes the drawer, unless a nested dialog owns the focus.
  useEffect(() => {
    if (!isMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        const dlg = active.closest('[role="dialog"]');
        if (dlg && dlg !== drawerRef.current) return;
      }
      setIsMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMenuOpen]);

  // Move focus into the drawer when it opens; return it to the hamburger
  // only when the drawer was actually open (never on initial page load).
  const wasMenuOpenRef = useRef(false);
  useEffect(() => {
    if (isMenuOpen) {
      wasMenuOpenRef.current = true;
      drawerCloseRef.current?.focus();
    } else if (wasMenuOpenRef.current) {
      wasMenuOpenRef.current = false;
      hamburgerRef.current?.focus();
    }
  }, [isMenuOpen]);

  useDialogFocus({
    open: isMenuOpen,
    containerRef: drawerRef,
    initialFocusRef: drawerCloseRef,
    restoreFocusRef: hamburgerRef,
  });

  const handleAppAction = useCallback(
    (name: string) => {
      if (name === 'goto-merge') {
        setIsMenuOpen(false);
        if (onNavigatePhase) onNavigatePhase(1);
      }
    },
    [onNavigatePhase],
  );

  const steps = [
    { phase: 1 as WorkflowPhase, label: 'Upload' },
    { phase: 2 as WorkflowPhase, label: 'Whiten' },
    { phase: 3 as WorkflowPhase, label: 'Layout' },
    { phase: 4 as WorkflowPhase, label: 'Download' },
  ];

  return (
    <>
      <header
        id="app-header"
        className="sticky top-0 z-40 w-full border-b border-surface-2/60 bg-surface/80 backdrop-blur-xl supports-[backdrop-filter]:bg-surface/70 text-ink shadow-sm pt-safe"
      >
        <div className="mx-auto flex h-[56px] max-w-7xl items-center justify-between gap-3 px-3 sm:px-6 lg:h-[60px]">
          {/* Left: Hamburger */}
          <div className="flex items-center gap-2">
            <button
              ref={hamburgerRef}
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle App Menu"
              aria-expanded={isMenuOpen}
              aria-controls="settings-drawer"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-elevated/60 bg-surface/80 text-ink shadow-sm transition-all hover:bg-elevated hover:shadow active:scale-95 sm:h-11 sm:w-11"
            >
              {isMenuOpen ? <X className="h-5 w-5 text-warning" /> : <Menu className="h-5 w-5 text-primary-soft" />}
            </button>
          </div>

          {/* Logo — div (not h1) so each page has a single semantic h1 in its main content */}
          <div
            className={`flex items-center gap-2.5 ${showStepper ? '' : 'absolute left-1/2 -translate-x-1/2 sm:static sm:translate-x-0'}`}
          >
            <AppLogo className="h-8 w-8 lg:h-9 lg:w-9 drop-shadow-sm" />
            <div
              className="text-[17px] font-bold tracking-[-0.02em] sm:text-[18px] lg:text-[19px]"
              style={{ fontFamily: 'var(--font-display)' }}
              aria-label="Print Optimizer"
            >
              <span className="bg-gradient-to-r from-[#5B8CFF] via-[#8B6BFF] to-[#C14DFF] bg-clip-text text-transparent">
                Print
              </span>{' '}
              <span className="text-ink">Optimizer</span>
            </div>
          </div>

          {/* Middle: Stepper — centred, pill, premium */}
          {showStepper && (
            <nav
              aria-label="Progress Stepper"
              className="hidden items-center gap-1 rounded-full border border-elevated/40 bg-surface-2/60 p-1 shadow-sm backdrop-blur sm:flex"
            >
              {steps.map((step) => {
                const isActive = currentPhase === step.phase;
                const isCompleted = currentPhase > step.phase;

                return (
                  <button
                    key={step.phase}
                    onClick={() => {
                      if (isCompleted && onNavigatePhase) {
                        onNavigatePhase(step.phase);
                      }
                    }}
                    disabled={!isCompleted && !isActive}
                    aria-current={isActive ? 'step' : undefined}
                    aria-label={`Step ${step.phase}: ${step.label}`}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-primary-strong text-white shadow-sm'
                        : isCompleted
                          ? 'bg-success/15 text-success-soft hover:bg-success/25 border border-success/20'
                          : 'text-ink bg-elevated/60 border border-elevated/60 cursor-not-allowed'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ring-1 ${
                        isActive
                          ? 'bg-white text-indigo-700 ring-white/20'
                          : isCompleted
                            ? 'bg-success-strong text-white ring-success/30'
                            : 'bg-elevated text-ink ring-primary/20'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.phase}
                    </span>
                    <span className="hidden min-[400px]:inline text-xs tracking-wide">{step.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Right: Theme + Start Over */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {currentPhase > 1 && onReset && (
              <button
                type="button"
                onClick={onReset}
                className="hidden h-9 items-center gap-1.5 rounded-full border border-elevated bg-surface px-3 text-xs font-semibold text-ink-muted shadow-sm transition-colors hover:bg-elevated hover:text-ink sm:flex"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Start Over</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress line — premium 1px with glow */}
        <div aria-hidden="true" className="h-1 w-full bg-surface-2/60">
          <div
            aria-hidden="true"
            className="h-full rounded-full bg-gradient-to-r from-primary via-accent-soft to-success shadow-[0_0_8px_rgba(99,102,241,0.35)] transition-[width] duration-300 ease-out"
            style={{ width: showStepper ? `${(currentPhase / 4) * 100}%` : '0%' }}
          />
        </div>
      </header>

      {/* Mobile Drawer (Hamburger Side Sheet) */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
            className="fixed inset-0 bg-bg/70 backdrop-blur-xs animate-fade-in"
          />

          {/* Side Drawer Content */}
          <aside
            ref={drawerRef}
            id="settings-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Settings and information"
            className="relative flex w-96 max-w-[90vw] flex-col bg-surface border-r border-surface-2 text-ink shadow-2xl pt-safe pb-safe animate-slide-in-left"
          >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-surface-2 p-4">
                <div className="flex items-center gap-2.5">
                  <AppLogo className="h-8 w-8 text-primary-soft drop-shadow-sm" />
                  <div>
                    <h2 className="text-sm font-bold tracking-[-0.01em] text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                      Print Optimizer
                    </h2>
                    <p className="text-[11px] text-ink-muted">Settings &amp; Information</p>
                  </div>
                </div>
                <button
                  ref={drawerCloseRef}
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-2 text-ink-muted hover:text-ink"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Body: Settings & Information Center */}
              <div className="flex-1 overflow-y-auto p-4">
                <SettingsDrawer onAppAction={handleAppAction} />
              </div>

              {/* Drawer Footer */}
              <div className="space-y-0.5 border-t border-surface-2 p-3 text-center text-[10px] text-ink-muted">
                <div>&copy; 2026 Juyel Hossain &bull; JSL v1.0</div>
                <a
                  href="mailto:myself.juyel.dev@gmail.com"
                  className="text-primary-soft hover:underline"
                >
                  myself.juyel.dev@gmail.com
                </a>
              </div>
          </aside>
        </div>
      )}
    </>
  );
};

