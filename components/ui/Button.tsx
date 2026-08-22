'use client';

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

const VARIANT: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-primary-strong text-white hover:bg-primary shadow-lg shadow-primary-faint/30',
  secondary: 'border border-elevated bg-surface-2 text-ink hover:bg-elevated',
  ghost: 'border border-elevated bg-surface text-ink hover:bg-surface-2 hover:text-ink',
  danger: 'border border-danger-deep/60 bg-danger-faint text-danger-soft hover:bg-danger-faint/70',
};

const SIZE: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-10 px-3.5 gap-1.5 rounded-lg text-xs font-bold',
  md: 'h-11 px-4 gap-2 rounded-xl text-sm font-bold',
  lg: 'h-12 px-6 gap-2 rounded-xl text-sm font-bold',
};

/** The one button. 44px min target, one press feel, tokenized colors. */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}) => (
  <button
    type="button"
    disabled={disabled || loading}
    className={`inline-flex items-center justify-center whitespace-nowrap transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft disabled:pointer-events-none disabled:opacity-50 ${VARIANT[variant]} ${SIZE[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    {...rest}
  >
    {loading && (
      <span
        aria-hidden="true"
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current"
      />
    )}
    {children}
  </button>
);