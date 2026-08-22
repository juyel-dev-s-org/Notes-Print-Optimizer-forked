'use client';

import React from 'react';

export const PhaseSkeleton: React.FC<{ phaseName: string }> = ({ phaseName }) => (
  <div className="flex flex-col gap-4 animate-pulse">
    <div className="h-6 w-48 rounded-lg bg-surface-2" />
    <div className="h-32 rounded-2xl border border-surface-2 bg-surface/60 p-5">
      <div className="h-4 w-3/4 rounded bg-surface-2 mb-3" />
      <div className="h-3 w-1/2 rounded bg-surface-2 mb-2" />
      <div className="h-3 w-2/3 rounded bg-surface-2" />
    </div>
    <div className="grid grid-cols-3 gap-3">
      <div className="h-24 rounded-xl bg-surface/60 border border-surface-2" />
      <div className="h-24 rounded-xl bg-surface/60 border border-surface-2" />
      <div className="h-24 rounded-xl bg-surface/60 border border-surface-2" />
    </div>
  </div>
);

export const CardSkeleton: React.FC = () => (
  <div className="flex flex-col gap-3 rounded-2xl border border-surface-2 bg-surface/60 p-4 animate-pulse">
    <div className="h-4 w-3/4 rounded bg-surface-2" />
    <div className="h-24 rounded-lg bg-surface-2/60" />
    <div className="h-3 w-1/2 rounded bg-surface-2" />
  </div>
);
