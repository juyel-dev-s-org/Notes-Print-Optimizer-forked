'use client';

/**
 * Shared PWA install-prompt hook.
 *
 * Encapsulates the `beforeinstallprompt` / `appinstalled` lifecycle and
 * standalone detection so any UI (banner, button) can offer installation
 * without duplicating browser logic.
 */

import { useCallback, useEffect, useState } from 'react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function getIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function getIsIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'ios' | 'unavailable';

export interface InstallPromptState {
  /** True when the app is not installed and can be installed. */
  canInstall: boolean;
  /** True when running as an installed PWA. */
  isInstalled: boolean;
  /** True on iOS (uses a manual "Add to Home Screen" guide). */
  isIOS: boolean;
  /** Trigger the native prompt (or 'ios' when a manual guide is needed). */
  promptInstall: () => Promise<InstallOutcome>;
}

export function useInstallPrompt(): InstallPromptState {
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(getIsIOS());
    setIsInstalled(getIsStandalone());

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };
    const mql = window.matchMedia('(display-mode: standalone)');
    const onDisplayChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    mql.addEventListener('change', onDisplayChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      mql.removeEventListener('change', onDisplayChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (isIOS) return 'ios';
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') setDeferredPrompt(null);
    return choice.outcome;
  }, [deferredPrompt, isIOS]);

  const canInstall = !isInstalled && (!!deferredPrompt || isIOS);

  return { canInstall, isInstalled, isIOS, promptInstall };
}
