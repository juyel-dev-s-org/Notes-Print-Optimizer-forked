'use client';

import { useEffect, useState, useCallback } from 'react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function getIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

function getIsIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<InstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    setIsIOS(getIsIOS());
    setIsStandalone(getIsStandalone());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as InstallPromptEvent);
    };

    const installedHandler = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    const mql = window.matchMedia('(display-mode: standalone)');
    const displayChangeHandler = (e: MediaQueryListEvent) => {
      if (e.matches) setIsStandalone(true);
    };
    mql.addEventListener('change', displayChangeHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
      mql.removeEventListener('change', displayChangeHandler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (isIOS) {
      setShowIOSGuide((prev) => !prev);
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt, isIOS]);

  if (isStandalone) return null;
  if (!deferredPrompt && !isIOS) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleInstall}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-600/20 px-3 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/30 transition-colors cursor-pointer"
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
        <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">Install on iOS</h3>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
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
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                1
              </span>
              <span>
                Tap the <strong>Share</strong> button in Safari
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                2
              </span>
              <span>
                Scroll down and tap{' '}
                <strong>&quot;Add to Home Screen&quot;</strong>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                3
              </span>
              <span>
                Tap <strong>&quot;Add&quot;</strong> in the top-right corner
              </span>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
