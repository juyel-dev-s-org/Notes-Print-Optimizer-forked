'use client';

import React from 'react';

interface ErrorProps {
  error: Error;
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="max-w-md rounded-2xl border border-red-800/50 bg-red-950/30 p-8 text-center">
        <div className="mb-4 text-4xl">⚠️</div>
        <h2 className="mb-2 text-lg font-bold text-red-300">Something went wrong</h2>
        <p className="mb-6 text-sm text-red-400/80">{error.message || 'An unexpected error occurred.'}</p>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-red-700 px-6 py-3 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
