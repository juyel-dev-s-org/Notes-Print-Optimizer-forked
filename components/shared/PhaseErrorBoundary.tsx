'use client';

import React from 'react';
import { TriangleAlert } from 'lucide-react';

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
        <div className="mx-auto max-w-md rounded-xl border border-danger-strong/50 bg-danger-faint/30 p-6 text-center">
          <div className="mb-3 flex justify-center">
            <TriangleAlert className="h-10 w-10 text-danger" aria-hidden="true" />
          </div>
          <h3 className="mb-1 text-sm font-bold text-danger-soft">
            {this.props.phaseName} &mdash; Something went wrong
          </h3>
          <p className="mb-4 text-xs text-danger/80">
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-lg bg-danger-deep px-4 py-2 text-xs font-semibold text-white hover:bg-danger-strong transition-colors"
            >
              Retry
            </button>
            {this.props.onReset && (
              <button
                type="button"
                onClick={this.handleReset}
                className="rounded-lg border border-elevated bg-surface-2 px-4 py-2 text-xs font-medium text-ink-muted hover:bg-elevated transition-colors"
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