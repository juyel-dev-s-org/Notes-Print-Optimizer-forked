'use client';

import React, { useState } from 'react';
import { useInstallPrompt } from '@/lib/pwa/useInstallPrompt';

/**
 * Compact header-style install button. Shares install logic with
 * `InstallBanner` via the `useInstallPrompt` hook. Hidden once installed.
 */
export function InstallButton() {
  const { canInstall, isIOS, promptInstall } = useInstallPrompt();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const handleInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === 'ios') setShowIOSGuide((prev) => !prev);
  };

  if (!canInstall) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleInstall}
        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-600/20 px-3 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-600/30"
        aria-label="Install PW Notes Print Optimizer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>Install App</span>
      </button>

      {showIOSGuide && isIOS && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Install on iOS</h3>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="cursor-pointer text-slate-400 hover:text-white"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <ol className="space-y-2 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">1</span>
              <span>Tap the <strong>Share</strong> button in Safari</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">2</span>
              <span>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">3</span>
              <span>Tap <strong>&quot;Add&quot;</strong> in the top-right corner</span>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
