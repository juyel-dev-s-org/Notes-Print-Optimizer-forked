'use client';

import React from 'react';

interface PhaseErrorBoundaryProps {
  children: React.ReactNode;
  phaseName: string;
  onReset?: () => void;
}

interface PhaseErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PhaseErrorBoundary extends React.Component<
  PhaseErrorBoundaryProps,
  PhaseErrorBoundaryState
> {
  constructor(props: PhaseErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PhaseErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[PhaseErrorBoundary:${this.props.phaseName}]`, error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-md rounded-xl border border-red-800/50 bg-red-950/30 p-6 text-center">
          <div className="mb-3 text-3xl">⚠️</div>
          <h3 className="mb-1 text-sm font-bold text-red-300">
            {this.props.phaseName} — Something went wrong
          </h3>
          <p className="mb-4 text-xs text-red-400/80">
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
            >
              Retry
            </button>
            {this.props.onReset && (
              <button
                type="button"
                onClick={this.handleReset}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
