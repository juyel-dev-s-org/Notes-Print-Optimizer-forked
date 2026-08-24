'use client';

import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

/**
 * Flips data-theme on <html> and persists the choice.
 * Initial paint is handled by the inline script in app/layout.tsx;
 * this control only reads the resolved value after mount.
 */
export const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('po:theme', next);
    } catch {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'light' ? '#f4f6fb' : '#020617');
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
      className={`flex h-10 w-10 items-center justify-center rounded-xl border border-elevated/60 bg-surface/80 text-ink-muted transition-all hover:bg-elevated hover:text-ink active:scale-95 sm:h-11 sm:w-11 ${className ?? ''}`}
    >
      {theme === 'light' ? (
        <Moon className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Sun className="h-5 w-5 text-primary-soft" aria-hidden="true" />
      )}
    </button>
  );
};
