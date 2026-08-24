import Link from 'next/link';
import { FileQuestion, ArrowLeft, Home } from 'lucide-react';

export const metadata = {
  title: '404 — Page Not Found',
  description: 'The page you are looking for does not exist. Return to Print Optimizer to merge, split, protect and convert your PDFs — 100% on-device.',
};

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center animate-enter">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-faint border border-primary/20 text-primary-soft shadow-sm">
        <FileQuestion className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-ink" style={{ fontFamily: 'var(--font-display)' }}>
        404 - Page Not Found
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
        The page you’re looking for doesn’t exist or was moved. Let’s get you back to your tools — everything still runs
        privately on your device.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-primary-strong px-6 text-sm font-bold text-white shadow-md shadow-primary/20 transition hover:bg-primary hover:shadow-lg active:scale-[0.98]"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          Back to tools
        </Link>
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-elevated bg-surface px-5 text-sm font-semibold text-ink shadow-sm transition hover:bg-surface-2"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Go home
        </Link>
      </div>
      <p className="mt-8 text-xs text-ink-faint">Error 404 · Print Optimizer · Juyel Hossain</p>
    </div>
  );
}
