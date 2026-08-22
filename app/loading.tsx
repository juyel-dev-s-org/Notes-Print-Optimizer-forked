import React from 'react';

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary-soft" />
        <p className="text-xs text-ink-muted font-medium">Loading Print Optimizer...</p>
      </div>
    </div>
  );
}
