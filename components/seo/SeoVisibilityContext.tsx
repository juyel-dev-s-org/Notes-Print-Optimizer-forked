'use client';

import { createContext, useContext } from 'react';

interface SeoVisibilityContextValue {
  visible: boolean;
  setVisible: (v: boolean) => void;
}

export const SeoVisibilityContext = createContext<SeoVisibilityContextValue | null>(null);

export function useSeoVisibility(): SeoVisibilityContextValue {
  const ctx = useContext(SeoVisibilityContext);
  if (!ctx) {
    throw new Error('useSeoVisibility must be used within SeoVisibilityContext.Provider');
  }
  return ctx;
}
