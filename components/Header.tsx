'use client';

import React, { useState } from 'react';
import {
  Menu,
  X,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { AppLogo } from './AppLogo';
import { motion, AnimatePresence } from 'motion/react';
import { SettingsDrawer } from './menu/SettingsDrawer';

import type { WorkflowPhase } from '@/lib/workflow/types';
export type { WorkflowPhase };

interface HeaderProps {
  currentPhase: WorkflowPhase;
  onReset?: () => void;
  onLoadSample?: () => void;
  onNavigatePhase?: (phase: WorkflowPhase) => void;
  isProcessing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentPhase,
  onReset,
  onLoadSample,
  onNavigatePhase,
  isProcessing = false,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const steps = [
    { phase: 1 as WorkflowPhase, label: 'Upload' },
    { phase: 2 as WorkflowPhase, label: 'Optimize' },
    { phase: 3 as WorkflowPhase, label: 'Layout' },
    { phase: 4 as WorkflowPhase, label: 'Download' },
  ];

  return (
    <>
      <header id="app-header" className="sticky top-0 z-40 w-full bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white pt-safe">
        <div className="mx-auto max-w-7xl px-3 py-2.5 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Hamburger Menu Button & Logo */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800/80 text-slate-200 hover:bg-slate-700 active:scale-95 transition-all border border-slate-700/60"
                aria-label="Toggle App Menu"
              >
                {isMenuOpen ? <X className="h-5 w-5 text-amber-400" /> : <Menu className="h-5 w-5 text-indigo-400" />}
              </button>

              <div className="flex items-center gap-2">
                <AppLogo className="h-9 w-9 text-indigo-400 drop-shadow-md" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-sm font-bold tracking-tight text-white sm:text-base">
                      PW Optimizer
                    </h1>
                    <span className="rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
                      PWA
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                    Android & Web Print Engine
                  </span>
                </div>
              </div>
            </div>

            {/* Middle: Compact Stepper Indicator for Mobile & Tablet */}
            <nav aria-label="Progress Stepper" className="flex items-center rounded-xl bg-slate-800/70 p-1 border border-slate-700/50">
              {steps.map((step, idx) => {
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
                    className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : isCompleted
                        ? 'text-emerald-400 hover:bg-slate-700/60'
                        : 'text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                        isActive
                          ? 'bg-white text-indigo-700'
                          : isCompleted
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-700 text-slate-400'
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
            <div className="hidden md:flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>100% Offline</span>
              </div>

              {currentPhase === 1 && onLoadSample && (
                <button
                  type="button"
                  onClick={onLoadSample}
                  disabled={isProcessing}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-600/20 px-3 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/30 transition-colors disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Sample PDF</span>
                </button>
              )}

              {currentPhase > 1 && onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Start Over</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Top Progress Line Indicator */}
        <div className="h-0.5 w-full bg-slate-800">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400"
            initial={{ width: '25%' }}
            animate={{ width: `${(currentPhase / 4) * 100}%` }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          />
        </div>
      </header>

      {/* Mobile Drawer (Hamburger Side Sheet) */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
            />

            {/* Side Drawer Content */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative flex w-80 max-w-[85vw] flex-col bg-slate-900 border-r border-slate-800 text-slate-100 shadow-2xl pt-safe pb-safe"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-slate-800 p-4">
                <div className="flex items-center gap-2.5">
                  <AppLogo className="h-8 w-8 text-indigo-400" />
                  <div>
                    <h2 className="text-sm font-bold text-white">PW Print Optimizer</h2>
                    <p className="text-[11px] text-slate-400">Settings &amp; Information</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Body: Settings & Information Center */}
              <div className="flex-1 overflow-y-auto p-3">
                <SettingsDrawer
                  onAppAction={(name) => {
                    if (name === 'goto-merge') {
                      setIsMenuOpen(false);
                      if (onNavigatePhase) onNavigatePhase(1);
                    }
                  }}
                />
              </div>

              {/* Drawer Footer */}
              <div className="space-y-0.5 border-t border-slate-800 p-3 text-center text-[10px] text-slate-500">
                <div>&copy; 2026 Juyel Hossain &bull; JSL v1.0</div>
                <a
                  href="mailto:myself.juyel.dev@gmail.com"
                  className="text-indigo-400 hover:underline"
                >
                  myself.juyel.dev@gmail.com
                </a>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};


