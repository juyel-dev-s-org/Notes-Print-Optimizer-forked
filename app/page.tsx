'use client';

import { useEffect, useMemo } from 'react';
import { Header } from '@/components/Header';
import { ProcessingModal } from '@/components/ProcessingModal';
import { PlatformUIOrchestrator } from '@/components/views/PlatformUIOrchestrator';
import { usePageHandlers } from '@/lib/workflow/usePageHandlers';
import { useMonitor } from '@/lib/monitoring/useMonitor';
import type { WorkflowState, WorkflowActions, WorkflowHandlers, ResumeSession } from '@/components/views/types';

export default function HomePage() {
  useMonitor();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const swPath = `${basePath}/sw.js`;
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register(swPath, { scope: `${basePath}/`, updateViaCache: 'none' })
          .then((reg) => {
            console.log('[SW] Registered with scope:', reg.scope);
            reg.addEventListener('updatefound', () => {
              const nw = reg.installing;
              if (nw) {
                nw.addEventListener('statechange', () => {
                  if (nw.state === 'activated') {
                    console.log('[SW] New version activated');
                  }
                });
              }
            });
          })
          .catch((err) => console.warn('[SW] Registration failed:', err));
      });
    }
  }, []);

  const {
    state, actions,
    handleResetWorkflow, handleFilesUpload, handleLoadSamplePdf,
    handleMoveItem, handleRemoveItem, handleDownloadMerged,
    handleSmartArrange, handleReorderItem,
    handleProceedToPhase2, handleToggleExcludePage, handleDownloadOptimized1Up,
    handleProceedToPhase3, handleReprocess, handlePreviewReprocess,
    handleResetSettings,
    handleSelectLayoutFormat, handleToggleOrientation, handleToggleBorders,
    handleTogglePageNumbers, handleUpdateOuterMargins, handleUpdateInnerMargin,
    handleApplyLayout, handleDownloadFinalPrintPdf, handleProceedToPhase4,
    handleSendFeedback, compilePhase3PrintLayout,
    handleCancelProcessing, resumeInfo, handleResumeProcessing, handleDismissResume,
    progressiveThumbnails,
  } = usePageHandlers();

  const workflowState: WorkflowState = useMemo(() => ({
    currentPhase: state.currentPhase,
    isProcessing: state.isProcessing,
    progress: state.progress,
    errorMessage: state.errorMessage,
    uploadedItems: state.uploadedItems,
    mergedPdfBlob: state.mergedPdfBlob,
    mergedPdfBytes: state.mergedPdfBytes,
    mergedPageDataUrls: state.mergedPageDataUrls,
    selectedEngineVersion: state.selectedEngineVersion,
    processedPages: state.processedPages,
    selectedPageIndex: state.selectedPageIndex,
    excludedPages: state.excludedPages,
    docProfile: state.docProfile,
    masterParams: state.masterParams,
    processingToggles: state.processingToggles,
    isPreviewProcessing: state.isPreviewProcessing,
    layoutConfig: state.layoutConfig,
    layoutDirty: state.layoutDirty,
    finalSheetPreviews: state.finalSheetPreviews,
    finalMetrics: state.finalMetrics,
    finalPrintPdfBlob: state.finalPrintPdfBlob,
    analysisTimeMs: state.analysisTimeMs,
    optimizationTimeMs: state.optimizationTimeMs,
    layoutTimeMs: state.layoutTimeMs,
    rating: state.rating,
    feedbackText: state.feedbackText,
    feedbackSubmitted: state.feedbackSubmitted,
    progressiveThumbnails,
  }), [state, progressiveThumbnails]);

  const workflowActions: WorkflowActions = useMemo(() => ({
    setPhase: actions.setPhase,
    setError: actions.setError,
    setEngineVersion: actions.setEngineVersion,
    setSelectedPageIndex: actions.setSelectedPageIndex,
    setMasterParams: actions.setMasterParams,
    setProcessingToggles: actions.setProcessingToggles,
    setExcludedPages: actions.setExcludedPages,
    setRating: actions.setRating,
    setFeedbackText: actions.setFeedbackText,
  }), [actions]);

  const workflowHandlers: WorkflowHandlers = useMemo(() => ({
    handleFilesUpload,
    handleLoadSamplePdf,
    handleMoveItem,
    handleRemoveItem,
    handleReorderItem,
    handleSmartArrange,
    handleDownloadMerged,
    handleProceedToPhase2,
    handleToggleExcludePage,
    handleDownloadOptimized1Up,
    handleProceedToPhase3,
    handleReprocess,
    handlePreviewReprocess,
    handleResetSettings,
    handleApplyLayout,
    handleSelectLayoutFormat,
    handleToggleOrientation,
    handleToggleBorders,
    handleTogglePageNumbers,
    handleUpdateOuterMargins,
    handleUpdateInnerMargin,
    handleDownloadFinalPrintPdf,
    handleProceedToPhase4,
    handleSendFeedback,
    handleResetWorkflow,
    handleCancelProcessing,
    handleResumeProcessing,
    handleDismissResume,
    compilePhase3PrintLayout,
  }), [
    handleFilesUpload, handleLoadSamplePdf, handleMoveItem, handleRemoveItem,
    handleReorderItem, handleSmartArrange, handleDownloadMerged, handleProceedToPhase2,
    handleToggleExcludePage, handleDownloadOptimized1Up, handleProceedToPhase3,
    handleReprocess, handlePreviewReprocess, handleResetSettings, handleApplyLayout,
    handleSelectLayoutFormat, handleToggleOrientation, handleToggleBorders,
    handleTogglePageNumbers, handleUpdateOuterMargins, handleUpdateInnerMargin,
    handleDownloadFinalPrintPdf, handleProceedToPhase4, handleSendFeedback,
    handleResetWorkflow, handleCancelProcessing, handleResumeProcessing,
    handleDismissResume, compilePhase3PrintLayout,
  ]);

  const resumeSession: ResumeSession = useMemo(() => ({
    resumeInfo,
  }), [resumeInfo]);

  return (
    <div className="min-h-screen bg-slate-950 app-shell-bg text-slate-100 font-sans flex flex-col pb-safe">
      {/* Skip link: lets keyboard / screen-reader users bypass header & nav (WCAG 2.4.1) */}
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Header
        currentPhase={state.currentPhase}
        onReset={handleResetWorkflow}
        onLoadSample={handleLoadSamplePdf}
        onNavigatePhase={(phase) => actions.setPhase(phase)}
        isProcessing={state.isProcessing}
      />
      <ProcessingModal progress={state.progress} onCancel={handleCancelProcessing} progressiveThumbnails={progressiveThumbnails} />
      {state.errorMessage && (
        <div className="bg-red-950/90 border-b border-red-800 text-red-200 text-xs py-2.5 px-4 text-center font-medium shadow-md">
          {state.errorMessage}
        </div>
      )}
      <main id="main-content" className="mx-auto w-full max-w-5xl lg:max-w-6xl flex-1 px-3 py-4 sm:px-6 sm:py-6 pb-28 md:pb-8">
        <PlatformUIOrchestrator
          state={workflowState}
          actions={workflowActions}
          handlers={workflowHandlers}
          resume={resumeSession}
        />
      </main>
      <footer className="border-t border-slate-800/60 px-4 py-6 text-center text-[11px] text-slate-400">
        <div className="mx-auto flex max-w-md flex-col items-center gap-1.5">
          <p className="font-medium text-slate-400">&copy; 2026 Juyel Hossain</p>
          <p>Juyel Source License v1.0</p>
          <a
            href="mailto:myself.juyel.dev@gmail.com"
            className="text-indigo-400 transition-colors duration-150 hover:text-indigo-300 hover:underline"
          >
            myself.juyel.dev@gmail.com
          </a>
        </div>
      </footer>
    </div>
  );
}
