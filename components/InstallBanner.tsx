'use client';

import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { useInstallPrompt } from '@/lib/pwa/useInstallPrompt';

/**
 * PWA install banner shown at the top of the Settings & Information drawer.
 *
 * Visibility follows install best practice: it renders only when the app is
 * NOT already installed and installation is available (native prompt captured
 * or iOS). Once installed, the hook reports `isInstalled` and this hides.
 */
export const InstallBanner: React.FC = () => {
  const { canInstall, isIOS, promptInstall } = useInstallPrompt();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!canInstall || dismissed) return null;

  const handleInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === 'ios') setShowIOSGuide((prev) => !prev);
  };

  return (
    <div className="rounded-xl border border-indigo-500/40 bg-gradient-to-br from-indigo-950 to-slate-900 p-3.5 shadow-lg">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-xs font-semibold text-indigo-300">
          <Smartphone className="h-4 w-4 text-indigo-400" />
          <span>Install App</span>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss install banner"
          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mb-3 text-[11px] leading-relaxed text-slate-300">
        Install Notes Print Optimizer for home-screen access, offline support
        and a full-screen workspace.
      </p>

      <button
        type="button"
        onClick={handleInstall}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-indigo-500 active:scale-[0.98]"
      >
        <Download className="h-3.5 w-3.5" />
        <span>{isIOS ? 'How to Install' : 'Install App'}</span>
      </button>

      {showIOSGuide && isIOS && (
        <ol className="mt-3 space-y-1.5 border-t border-slate-700/50 pt-2 text-[11px] text-slate-300">
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
  );
};
