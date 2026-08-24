'use client';

import { RefreshCw } from 'lucide-react';

export function RetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="inline-flex h-11 items-center gap-2 rounded-full bg-primary-strong px-6 text-sm font-bold text-white shadow-md shadow-primary/20 transition hover:bg-primary hover:shadow-lg active:scale-[0.98]"
    >
      <RefreshCw className="h-4 w-4" aria-hidden="true" />
      Try Again
    </button>
  );
}
