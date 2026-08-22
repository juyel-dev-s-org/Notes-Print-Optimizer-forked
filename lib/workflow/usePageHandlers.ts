'use client';

import { useWorkflowRuntime } from './hooks/useWorkflowRuntime';
import { useFileQueue } from './hooks/useFileQueue';
import { useOptimization } from './hooks/useOptimization';
import { useLayoutEngine } from './hooks/useLayoutEngine';
import { useExclusion } from './hooks/useExclusion';
import { useSessionFlow } from './hooks/useSessionFlow';

/**
 * Facade over the workflow handler domains. Composes the focused
 * hooks (file queue / optimization / layout / exclusion / session)
 * and preserves the historical single-object API for consumers.
 */
export function usePageHandlers() {
  const {
    state,
    actions,
    abortRef,
    withProcessing,
    progressiveThumbnails,
    setProgressiveThumbnails,
    clearProgressiveThumbnails,
    previewBlobUrlRef,
    previewPdfDocRef,
    excludeLayoutTimerRef,
    excludeLayoutArgsRef,
    revokePreviewAssets,
  } = useWorkflowRuntime();

  const fileQueue = useFileQueue({
    uploadedItems: state.uploadedItems,
    mergedPdfBlob: state.mergedPdfBlob,
    mergedPageDataUrls: state.mergedPageDataUrls,
    actions,
    withProcessing,
    clearProgressiveThumbnails,
  });

  const optimization = useOptimization({
    mergedPdfBytes: state.mergedPdfBytes,
    masterParams: state.masterParams,
    processingToggles: state.processingToggles,
    selectedPageIndex: state.selectedPageIndex,
    processedPages: state.processedPages,
    pageProfiles: state.pageProfiles,
    actions,
    abortRef,
    previewBlobUrlRef,
    previewPdfDocRef,
    withProcessing,
    setProgressiveThumbnails,
    clearProgressiveThumbnails,
  });

  const layout = useLayoutEngine({
    processedPages: state.processedPages,
    excludedPages: state.excludedPages,
    layoutConfig: state.layoutConfig,
    layoutDirty: state.layoutDirty,
    actions,
    abortRef,
    withProcessing,
  });

  const exclusion = useExclusion({
    excludedPages: state.excludedPages,
    currentPhase: state.currentPhase,
    processedPages: state.processedPages,
    layoutConfig: state.layoutConfig,
    actions,
    compilePhase3PrintLayout: layout.compilePhase3PrintLayout,
    excludeLayoutTimerRef,
    excludeLayoutArgsRef,
  });

  const session = useSessionFlow({
    actions,
    abortRef,
    revokePreviewAssets,
    clearProgressiveThumbnails,
    withProcessing,
    finalPrintPdfBlob: state.finalPrintPdfBlob,
    optimized1UpBlob: state.optimized1UpBlob,
    processedPages: state.processedPages,
    rating: state.rating,
    feedbackText: state.feedbackText,
  });

  return {
    state, actions,
    handleResetWorkflow: session.handleResetWorkflow,
    handleEnhanceLayoutHandoff: session.handleEnhanceLayoutHandoff,
    handleFilesUpload: fileQueue.handleFilesUpload,
    handleMoveItem: fileQueue.handleMoveItem,
    handleRemoveItem: fileQueue.handleRemoveItem,
    handleDownloadMerged: fileQueue.handleDownloadMerged,
    handleSmartArrange: fileQueue.handleSmartArrange,
    handleReorderItem: fileQueue.handleReorderItem,
    handleProceedToPhase2: optimization.handleProceedToPhase2,
    handleToggleExcludePage: exclusion.handleToggleExcludePage,
    handleDownloadOptimized1Up: session.handleDownloadOptimized1Up,
    handleProceedToPhase3: session.handleProceedToPhase3,
    handleReprocess: optimization.handleReprocess,
    handlePreviewReprocess: optimization.handlePreviewReprocess,
    handleResetSettings: optimization.handleResetSettings,
    handleSelectLayoutFormat: layout.handleSelectLayoutFormat,
    handleToggleOrientation: layout.handleToggleOrientation,
    handleToggleBorders: layout.handleToggleBorders,
    handleTogglePageNumbers: layout.handleTogglePageNumbers,
    handleUpdateOuterMargins: layout.handleUpdateOuterMargins,
    handleUpdateInnerMargin: layout.handleUpdateInnerMargin,
    handleApplyLayout: layout.handleApplyLayout,
    handleDownloadFinalPrintPdf: session.handleDownloadFinalPrintPdf,
    handleProceedToPhase4: session.handleProceedToPhase4,
    handleSendFeedback: session.handleSendFeedback,
    compilePhase3PrintLayout: layout.compilePhase3PrintLayout,
    handleCancelProcessing: session.handleCancelProcessing,
    progressiveThumbnails,
  };
}
