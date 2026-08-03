'use client';

import React, { useCallback, useState } from 'react';
import {
  Check,
  Download,
  Share2,
  ShieldCheck,
  Smartphone,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { useInstallPrompt } from '@/lib/pwa/useInstallPrompt';
import { AppLogo } from './AppLogo';

/**
 * Adaptive PWA card rendered ONLY at the top of the Settings drawer.
 *
 * - Not installed (and installable) -> a beautiful "Install App" card with an
 *   install button that triggers the native add-to-home-screen prompt.
 * - Already installed              -> a "Share this app" card using the Web
 *   Share API (with a copy-link fallback).
 *
 * It never renders outside the drawer and hides entirely when there is
 * nothing useful to offer (e.g. a non-installable desktop browser).
 */
export const InstallShareCard: React.FC = () => {
  const { canInstall, isInstalled, isIOS, promptInstall } = useInstallPrompt();

  const [dismissed, setDismissed] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleInstall = useCallback(async () => {
    const outcome = await promptInstall();
    if (outcome === 'ios') setShowIOSGuide((prev) => !prev);
  }, [promptInstall]);

  const handleShare = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.origin + (process.env.NEXT_PUBLIC_BASE_PATH || '');
    const data = {
      title: 'Notes Print Optimizer',
      text: 'Turn dark lecture slides into clean, ink-saving print PDFs. 100% private, on-device.',
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
    } catch {
      /* user dismissed the share sheet - fall through to copy */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard unavailable - no-op */
    }
  }, []);

  if (dismissed) return null;

  // Nothing useful to offer (not installed and can't install) -> hide.
  if (!isInstalled && !canInstall) return null;

  const dismissButton = (
    <button
      type="button"
      onClick={() => setDismissed(true)}
      aria-label="Dismiss"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );

  /* ------------------------------- INSTALLED ------------------------------ */
  if (isInstalled) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/70 via-slate-900 to-slate-950 p-4 shadow-lg">
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-teal-500/10 blur-2xl" />

        <div className="relative">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 shadow-md ring-1 ring-white/10">
                <AppLogo className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Share this app</h3>
                <p className="flex items-center gap-1 text-[11px] font-medium text-emerald-300/90">
                  <Check className="h-3 w-3" /> Installed on your device
                </p>
              </div>
            </div>
            {dismissButton}
          </div>

          <p className="mt-3 text-xs leading-relaxed text-slate-300">
            Enjoying it? Share Notes Print Optimizer with friends who want to
            save ink and paper.
          </p>

          <button
            type="button"
            onClick={handleShare}
            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-emerald-500 active:scale-[0.98]"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
            <span>{copied ? 'Link copied!' : 'Share App'}</span>
          </button>
        </div>
      </div>
    );
  }

  /* ----------------------------- NOT INSTALLED ---------------------------- */
  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/80 via-slate-900 to-slate-950 p-4 shadow-lg">
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-indigo-500/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-violet-500/15 blur-2xl" />

      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 shadow-md ring-1 ring-white/10">
              <AppLogo className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Install App</h3>
              <p className="text-[11px] font-medium text-indigo-300/90">
                One tap &middot; Home screen
              </p>
            </div>
          </div>
          {dismissButton}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-300">
          Add Notes Print Optimizer to your home screen for instant access,
          offline support and a full-screen workspace.
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-800/60 px-2 py-0.5 text-[10px] font-medium text-slate-300">
            <Zap className="h-3 w-3 text-amber-400" /> Fast
          </span>
          <span className="flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-800/60 px-2 py-0.5 text-[10px] font-medium text-slate-300">
            <WifiOff className="h-3 w-3 text-sky-400" /> Offline
          </span>
          <span className="flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-800/60 px-2 py-0.5 text-[10px] font-medium text-slate-300">
            <ShieldCheck className="h-3 w-3 text-emerald-400" /> Private
          </span>
        </div>

        <button
          type="button"
          onClick={handleInstall}
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-indigo-500 active:scale-[0.98]"
        >
          {isIOS ? <Smartphone className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
          <span>{isIOS ? 'How to Install' : 'Install App'}</span>
        </button>

        {showIOSGuide && isIOS && (
          <ol className="mt-3 space-y-1.5 border-t border-slate-700/50 pt-2.5 text-[11px] text-slate-300">
            <li>
              1. Tap the <strong>Share</strong> button in Safari
            </li>
            <li>
              2. Tap <strong>&quot;Add to Home Screen&quot;</strong>
            </li>
            <li>
              3. Tap <strong>&quot;Add&quot;</strong>
            </li>
          </ol>
        )}
      </div>
    </div>
  );
};
