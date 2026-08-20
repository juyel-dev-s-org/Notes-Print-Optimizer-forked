'use client';

import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  Menu,
  X,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { AppLogo } from './AppLogo';
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
  onLoadSample?: () => void;
  onNavigatePhase?: (phase: WorkflowPhase) => void;
  isProcessing?: boolean;
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
  onLoadSample,
  onNavigatePhase,
  isProcessing = false,
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
      } else if (name === 'goto-enhance') {
        setIsMenuOpen(false);
        if (onNavigatePhase) onNavigatePhase(2);
      }
    },
    [onNavigatePhase],
  );

  const steps = [
    { phase: 1 as WorkflowPhase, label: 'Upload' },
    { phase: 2 as WorkflowPhase, label: 'Optimize' },
    { phase: 3 as WorkflowPhase, label: 'Layout' },
    { phase: 4 as WorkflowPhase, label: 'Download' },
  ];

  return (
    <>
      <header id="app-header" className="sticky top-0 z-40 w-full bg-surface/95 backdrop-blur-md border-b border-surface-2 text-white pt-safe">
        <div className="mx-auto max-w-7xl px-3 py-2.5 sm:px-6 lg:py-3">
          <div className="flex items-center justify-between gap-2 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-4">
            {/* Left: Hamburger Menu Button & Logo */}
            <div className="flex items-center gap-2 lg:justify-self-start">
              <button
                ref={hamburgerRef}
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="Toggle App Menu"
                aria-expanded={isMenuOpen}
                aria-controls="settings-drawer"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2/80 text-ink hover:bg-elevated active:scale-95 transition-all border border-elevated/60"
              >
                {isMenuOpen ? <X className="h-5 w-5 text-warning" /> : <Menu className="h-5 w-5 text-primary-soft" />}
              </button>

              <div className="flex items-center gap-2">
                <AppLogo className="h-9 w-9 text-primary-soft drop-shadow-md lg:h-10 lg:w-10" />
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-sm font-bold tracking-tight text-white sm:text-base">
                      PW Optimizer
                    </h1>
                    <span className="rounded-md bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary-soft border border-primary/30">
                      PWA
                    </span>
                  </div>
                  <span className="text-[10px] text-ink-muted font-medium hidden sm:inline">
                    Android & Web Print Engine
                  </span>
                </div>
              </div>
            </div>

            {/* Middle: Compact Stepper Indicator for Mobile & Tablet */}
            <nav aria-label="Progress Stepper" className="flex items-center gap-1 rounded-xl bg-surface-2/70 p-1 border border-elevated/50 lg:justify-self-center">
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
                    className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-primary-strong text-white shadow-xs lg:scale-105'
                        : isCompleted
                        ? 'text-success hover:bg-elevated/60'
                        : 'text-ink-muted cursor-not-allowed'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                        isActive
                          ? 'bg-white text-primary-deep'
                          : isCompleted
                          ? 'bg-success-strong text-bg'
                          : 'bg-elevated text-ink-muted'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : step.phase}
                    </span>
                    <span className="hidden min-[400px]:inline text-[11px] sm:text-xs">{step.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Right: Quick Action Buttons for Desktop / Tablet */}
            <div className="hidden md:flex items-center gap-2 lg:justify-self-end">
              <div className="flex items-center gap-1.5 rounded-lg border border-success-strong/30 bg-success-strong/10 px-2.5 py-1 text-xs font-medium text-success-soft">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                <span>100% Offline</span>
              </div>

              {currentPhase === 1 && onLoadSample && (
                <button
                  type="button"
                  onClick={onLoadSample}
                  disabled={isProcessing}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary-strong/20 px-3 text-xs font-semibold text-primary-soft hover:bg-primary-strong/30 transition-colors disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary-soft" />
                  <span>Sample PDF</span>
                </button>
              )}

              {currentPhase > 1 && onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-elevated bg-surface-2 px-3 text-xs font-medium text-ink-muted hover:bg-elevated hover:text-white transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Start Over</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Top Progress Line Indicator */}
        <div className="h-0.5 w-full bg-surface-2">
          <div
            className="h-full bg-gradient-to-r from-primary via-accent-soft to-success transition-[width] duration-200 ease-in-out"
            style={{ width: `${(currentPhase / 4) * 100}%` }}
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
                  <AppLogo className="h-8 w-8 text-primary-soft" />
                  <div>
                    <h2 className="text-sm font-bold text-white">PW Print Optimizer</h2>
                    <p className="text-[11px] text-ink-muted">Settings &amp; Information</p>
                  </div>
                </div>
                <button
                  ref={drawerCloseRef}
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-ink-muted hover:text-white"
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


