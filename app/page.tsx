'use client';

import { useEffect } from 'react';
import { Header } from '@/components/Header';
import { ProcessingModal } from '@/components/ProcessingModal';
import { PlatformUIOrchestrator } from '@/components/views/PlatformUIOrchestrator';
import { usePageHandlers } from '@/lib/workflow/usePageHandlers';
import { useMonitor } from '@/lib/monitoring/useMonitor';

export default function HomePage() {
  useMonitor();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const swPath = `${basePath}/sw.js`;
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register(swPath, { scope: `${basePath}/` })
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

  return (
    <div className="min-h-screen bg-slate-950 app-shell-bg text-slate-100 font-sans flex flex-col pb-safe">
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
      <main className="mx-auto w-full max-w-5xl lg:max-w-6xl flex-1 px-3 py-4 sm:px-6 sm:py-6 pb-28 md:pb-8">
        <PlatformUIOrchestrator
          currentPhase={state.currentPhase}
          setCurrentPhase={(phase) => actions.setPhase(phase)}
          isProcessing={state.isProcessing}
          progress={state.progress}
          errorMessage={state.errorMessage}
          setErrorMessage={(msg) => actions.setError(msg)}
          uploadedItems={state.uploadedItems}
          mergedPdfBlob={state.mergedPdfBlob}
          mergedPdfBytes={state.mergedPdfBytes}
          mergedPageDataUrls={state.mergedPageDataUrls}
          selectedEngineVersion={state.selectedEngineVersion}
          setSelectedEngineVersion={(v) => actions.setEngineVersion(v)}
          onFilesUpload={handleFilesUpload}
          onLoadSample={handleLoadSamplePdf}
          onMoveItem={handleMoveItem}
          onRemoveItem={handleRemoveItem}
          onReorderItem={handleReorderItem}
          onSmartArrange={handleSmartArrange}
          onDownloadMerged={handleDownloadMerged}
          onProceedToPhase2={handleProceedToPhase2}
          processedPages={state.processedPages}
          selectedPageIndex={state.selectedPageIndex}
          setSelectedPageIndex={(idx) => actions.setSelectedPageIndex(idx)}
          excludedPages={state.excludedPages}
          docProfile={state.docProfile}
          onToggleExcludePage={handleToggleExcludePage}
          onToggleExcludeAll={(exclude) => {
            const next = new Set<number>();
            if (exclude) state.processedPages.forEach((_, idx) => next.add(idx));
            actions.setExcludedPages(next);
          }}
          onDownloadOptimized1Up={handleDownloadOptimized1Up}
          onProceedToPhase3={handleProceedToPhase3}
          masterParams={state.masterParams}
          onMasterParamsChange={(p) => actions.setMasterParams(p)}
          onReprocess={handleReprocess}
          processingToggles={state.processingToggles}
          onProcessingTogglesChange={(t) => actions.setProcessingToggles(t)}
          onPreviewReprocess={handlePreviewReprocess}
          isPreviewProcessing={state.isPreviewProcessing}
          onResetSettings={handleResetSettings}
          layoutDirty={state.layoutDirty}
          onApplyLayout={handleApplyLayout}
          layoutConfig={state.layoutConfig}
          finalSheetPreviews={state.finalSheetPreviews}
          finalMetrics={state.finalMetrics}
          finalPrintPdfBlob={state.finalPrintPdfBlob}
          onSelectLayoutFormat={handleSelectLayoutFormat}
          onToggleOrientation={handleToggleOrientation}
          onToggleBorders={handleToggleBorders}
          onTogglePageNumbers={handleTogglePageNumbers}
          onUpdateOuterMargins={handleUpdateOuterMargins}
          onUpdateInnerMargin={handleUpdateInnerMargin}
          onDownloadFinalPrintPdf={handleDownloadFinalPrintPdf}
          onProceedToPhase4={handleProceedToPhase4}
          analysisTimeMs={state.analysisTimeMs}
          optimizationTimeMs={state.optimizationTimeMs}
          layoutTimeMs={state.layoutTimeMs}
          rating={state.rating}
          setRating={(r) => actions.setRating(r)}
          feedbackText={state.feedbackText}
          setFeedbackText={(t) => actions.setFeedbackText(t)}
          feedbackSubmitted={state.feedbackSubmitted}
          onSendFeedback={handleSendFeedback}
          onResetWorkflow={handleResetWorkflow}
          onCancelProcessing={handleCancelProcessing}
          resumeInfo={resumeInfo}
          onResumeProcessing={handleResumeProcessing}
          onDismissResume={handleDismissResume}
          progressiveThumbnails={progressiveThumbnails}
        />
      </main>
      <footer className="border-t border-slate-800/60 px-4 py-6 text-center text-[11px] text-slate-500">
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
