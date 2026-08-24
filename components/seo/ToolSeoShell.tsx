'use client';

import React from 'react';
import { useSeoVisibility } from './SeoVisibilityContext';

export const ToolSeoShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { visible } = useSeoVisibility();
  if (!visible) return null;
  return <div className="animate-enter">{children}</div>;
};
