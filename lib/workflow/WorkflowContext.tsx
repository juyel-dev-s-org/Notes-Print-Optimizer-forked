'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useWorkflow, type WorkflowActions } from './useWorkflow';
import type { WorkflowState } from './types';

interface WorkflowContextValue {
  state: WorkflowState;
  actions: WorkflowActions;
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

export function WorkflowProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state, actions } = useWorkflow();

  const value = useMemo(
    () => ({ state, actions }),
    [state, actions]
  );

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflowContext(): WorkflowContextValue {
  const ctx = useContext(WorkflowContext);
  if (!ctx) {
    throw new Error(
      'useWorkflowContext must be used within a <WorkflowProvider>'
    );
  }
  return ctx;
}
