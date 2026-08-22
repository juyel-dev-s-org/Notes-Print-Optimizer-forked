'use client';

import React, { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';

interface ErrorProps {
  error: Error;
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="max-w-md rounded-2xl border border-danger-strong/50 bg-danger-faint/30 p-8 text-center">
        <div className="mb-4 flex justify-center">
          <TriangleAlert className="h-12 w-12 text-danger" aria-hidden="true" />
        </div>
        <h2 className="mb-2 text-lg font-bold text-danger-soft">Something went wrong</h2>
        <p className="mb-6 text-sm text-danger/80">{error.message || 'An unexpected error occurred.'}</p>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-danger-deep px-6 py-3 text-sm font-semibold text-ink hover:bg-danger-strong transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}