import Link from 'next/link';
import { WifiOff, Home } from 'lucide-react';
import { RetryButton } from './RetryButton';

export const metadata = {
  title: 'Offline',
  description: 'You are offline. Core Print Optimizer tools stay available after your first visit and run 100% on-device. Reconnect to load fresh pages.',
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center animate-enter">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-faint border border-primary/20 text-primary-soft shadow-sm">
        <WifiOff className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-ink" style={{ fontFamily: 'var(--font-display)' }}>
        You Are Offline
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
        Core tools stay available offline after your first visit — everything runs on your device. Reconnect to load
        fresh pages or share, then continue privately with no uploads.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <RetryButton />
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-elevated bg-surface px-5 text-sm font-semibold text-ink shadow-sm transition hover:bg-surface-2"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          Back to tools
        </Link>
      </div>
      <p className="mt-8 text-xs text-ink-faint">Offline · Print Optimizer · Juyel Hossain</p>
    </div>
  );
}