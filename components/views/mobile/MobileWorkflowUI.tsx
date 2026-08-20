'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { WorkflowUIProps } from '../types';
import { UploadArea } from '@/components/UploadArea';
import { LandingHero } from '@/components/LandingHero';
import { FeatureStrip } from '@/components/FeatureStrip';
import { ToolsBox } from '@/components/tools/ToolsBox';
import { EnhanceToolView } from '@/components/enhance/EnhanceToolView';
import { FileSequencePanel } from '@/components/FileSequencePanel';
import { BeforeAfterSlider } from '@/components/BeforeAfterSlider';
import { PageGrid } from '@/components/PageGrid';
import { PageSequencePreview } from '@/components/PageSequencePreview';
import { EngineSelector } from '@/components/EngineSelector';
import {
  Download,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Check,
  Smartphone,
} from 'lucide-react';
import { PhaseErrorBoundary } from '@/components/shared/PhaseErrorBoundary';
import { CardSkeleton } from '@/components/shared/LoadingSkeleton';
import { EmptyPhaseState } from '@/components/shared/EmptyPhaseState';
import { GridFormatPicker } from '@/components/GridFormatPicker';
import { buildExcludedSet } from '@/lib/workflow/phaseUtils';

const FullPdfViewerPreview = dynamic(() => import('@/components/preview/FullPdfViewerPreview').then(m => m.FullPdfViewerPreview), {
  loading: () => <CardSkeleton />,
});

const FeedbackSection = dynamic(() => import('@/components/FeedbackSection').then(m => m.FeedbackSection), {
  loading: () => <CardSkeleton />,
});

const MarginSettings = dynamic(() => import('@/components/MarginSettings').then(m => m.MarginSettings), {
  loading: () => <CardSkeleton />,
});

const ProcessingSettingsPanel = dynamic(() => import('@/components/ProcessingSettingsPanel').then(m => m.ProcessingSettingsPanel), {
  loading: () => <CardSkeleton />,
});

export const MobileWorkflowUI: React.FC<WorkflowUIProps> = ({ state, actions, handlers, toolMode, onToolModeChange }) => {
  // Enhance Light PDF tool (mobile). Rendered in place of the workflow
  // when selected from the landing tools box; back arrow restores dark-print.
  if (toolMode === 'enhance') {
    return (
      <div className="flex flex-col gap-4 pb-20 w-full max-w-full">
        <div className="flex items-center justify-between px-1 text-[10px] text-ink-muted font-mono">
          <span className="flex items-center gap-1 bg-surface/80 border border-surface-2 px-2 py-0.5 rounded-full">
            <Smartphone className="h-3 w-3 text-primary-soft" />
            Mobile UI Viewport
          </span>
          <span>Tools · Enhance</span>
        </div>
        <EnhanceToolView onBack={() => onToolModeChange?.('dark-print')} />
      </div>
    );
  }

  const {
    currentPhase,
    isProcessing,
    uploadedItems,
    mergedPdfBlob,
    mergedPdfBytes,
    mergedPageDataUrls,
    selectedEngineVersion,
    processedPages,
    selectedPageIndex,
    excludedPages,
    masterParams,
    processingToggles,
    isPreviewProcessing,
    layoutConfig,
    layoutDirty,
    finalSheetPreviews,
    finalMetrics,
    finalPrintPdfBlob,
    rating,
    feedbackText,
    feedbackSubmitted,
  } = state;

  const {
    setPhase: setCurrentPhase,
    setEngineVersion: setSelectedEngineVersion,
    setSelectedPageIndex,
    setMasterParams: onMasterParamsChange,
    setProcessingToggles: onProcessingTogglesChange,
    setRating,
    setFeedbackText,
  } = actions;

  const {
    handleFilesUpload: onFilesUpload,
    handleLoadSamplePdf: onLoadSample,
    handleMoveItem: onMoveItem,
    handleRemoveItem: onRemoveItem,
    handleReorderItem: onReorderItem,
    handleSmartArrange: onSmartArrange,
    handleDownloadMerged: onDownloadMerged,
    handleProceedToPhase2: onProceedToPhase2,
    handleToggleExcludePage: onToggleExcludePage,
    handleDownloadOptimized1Up,
    handleProceedToPhase3: onProceedToPhase3,
    handleReprocess: onReprocess,
    handlePreviewReprocess: onPreviewReprocess,
    handleResetSettings: onResetSettings,
    handleApplyLayout: onApplyLayout,
    handleSelectLayoutFormat: onSelectLayoutFormat,
    handleToggleOrientation: onToggleOrientation,
    handleToggleBorders: onToggleBorders,
    handleTogglePageNumbers: onTogglePageNumbers,
    handleDownloadFinalPrintPdf: onDownloadFinalPrintPdf,
    handleProceedToPhase4: onProceedToPhase4,
    handleSendFeedback: onSendFeedback,
    handleResetWorkflow: onResetWorkflow,
  } = handlers;

  // Alias for onToggleExcludeAll which needs state access
  const onToggleExcludeAll = (exclude: boolean) => {
    actions.setExcludedPages(buildExcludedSet(state.processedPages.length, exclude));
  };

  return (
    <div className="flex flex-col gap-4 pb-20 w-full max-w-full">
      {/* Platform Badge Indicator */}
      <div className="flex items-center justify-between px-1 text-[10px] text-ink-muted font-mono">
        <span className="flex items-center gap-1 bg-surface/80 border border-surface-2 px-2 py-0.5 rounded-full">
          <Smartphone className="h-3 w-3 text-primary-soft" />
          Mobile UI Viewport
        </span>
        <span>Touch-Optimized UX</span>
      </div>

      {/* PHASE 1: UPLOAD & MERGE */}
      {currentPhase === 1 && (
        <PhaseErrorBoundary phaseName="Upload & Merge">
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          <LandingHero />

          <ToolsBox
            onSelectDarkPrint={() => {
              onToolModeChange?.('dark-print');
              document.getElementById('upload-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            onSelectEnhance={() => onToolModeChange?.('enhance')}
          />

          <div id="upload-area" className="scroll-mt-4">
            <UploadArea
              onFilesUpload={onFilesUpload}
              onLoadSample={onLoadSample}
              isProcessing={isProcessing}
            />
          </div>

          {uploadedItems.length === 0 && !isProcessing && <FeatureStrip />}

          {uploadedItems.length > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg">
              <div className="flex items-center justify-between border-b border-surface-2 pb-2">
                <h3 className="text-xs font-bold text-white">
                  PDF Sequence ({uploadedItems.length})
                </h3>
                <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] font-bold text-primary-soft">
                  Step 1 of 4
                </span>
              </div>

              {/* Smart PDF Rearrangement: series-aware auto sort + drag & drop */}
              <FileSequencePanel
                items={uploadedItems}
                isProcessing={isProcessing}
                onMoveItem={onMoveItem}
                onRemoveItem={onRemoveItem}
                onReorderItem={onReorderItem}
                onSmartArrange={onSmartArrange}
                compact
              />

              {/* Modular Processing Engine Selector */}
              <EngineSelector
                selectedVersion={selectedEngineVersion}
                onSelectVersion={setSelectedEngineVersion}
                disabled={isProcessing}
              />

              {/* Sequence Gallery Preview */}
              <PageSequencePreview pageUrls={mergedPageDataUrls} />
            </div>
          )}

          {/* Mobile Sticky Bottom Action Bar for Phase 1 */}
          {uploadedItems.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-2 border-t border-surface-2 bg-surface/95 backdrop-blur-md p-3 pb-safe shadow-2xl">
              <button
                type="button"
                onClick={onDownloadMerged}
                disabled={!mergedPdfBlob}
                aria-label="Download merged PDF"
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-elevated bg-surface-2 px-3 text-xs font-bold text-ink-muted disabled:opacity-40"
              >
                <Download className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onProceedToPhase2}
                disabled={!mergedPdfBytes || isProcessing}
                className="flex-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-primary-strong px-4 text-sm font-bold text-white shadow-lg active:scale-98 transition-all disabled:opacity-50"
              >
                <span>Optimize PDF</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
        </PhaseErrorBoundary>
      )}

      {/* PHASE 2: ANALYZE & OPTIMIZE */}
      {currentPhase === 2 &&
        (processedPages.length > 0 ? (
        <PhaseErrorBoundary phaseName="Analyze & Optimize">
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          <div className="flex flex-col gap-2 rounded-2xl border border-success-strong/30 bg-success-faint/40 p-3.5 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-deep text-bg font-bold shadow-md">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-bold text-success-soft">Dark Backgrounds Stripped</h3>
                <p className="text-[11px] text-ink-muted truncate">
                  Processed {processedPages.length} slides with ~82% ink savings.
                </p>
              </div>
            </div>
          </div>

          {/* Processing Settings (collapsible) */}
          <ProcessingSettingsPanel
            params={masterParams}
            onParamsChange={onMasterParamsChange}
            onReprocess={onReprocess}
            isProcessing={isProcessing}
            toggles={processingToggles}
            onTogglesChange={onProcessingTogglesChange}
            onPreviewReprocess={onPreviewReprocess}
            isPreviewProcessing={isPreviewProcessing}
            onResetSettings={onResetSettings}
          />

          {processedPages[selectedPageIndex] && (
            <BeforeAfterSlider page={processedPages[selectedPageIndex]} mergedPdfBytes={mergedPdfBytes} />
          )}

          <PageGrid
            pages={processedPages}
            selectedPageIndex={selectedPageIndex}
            onSelectPage={setSelectedPageIndex}
            excludedPages={excludedPages}
            onToggleExcludePage={onToggleExcludePage}
            onToggleExcludeAll={onToggleExcludeAll}
          />

          <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-2 border-t border-surface-2 bg-surface/95 backdrop-blur-md p-3 pb-safe shadow-2xl">
            <button
              type="button"
              onClick={() => setCurrentPhase(1)}
              aria-label="Back to Upload"
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-elevated bg-surface-2 px-3 text-xs font-bold text-ink-muted"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onProceedToPhase3}
              disabled={isProcessing}
              className="flex-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-primary-strong px-4 text-sm font-bold text-white shadow-lg active:scale-98 transition-all"
            >
              <span>Choose Layout</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        </PhaseErrorBoundary>
        ) : (
          <EmptyPhaseState
            title="No pages to optimize yet"
            message="Upload and process your PDF first ÃƒÂ¢Ã¢â€šÂ¬â€ then you can fine-tune ink savings here."
            onBack={() => setCurrentPhase(1)}
            backLabel="Back to Upload"
          />
        ))}

      {/* PHASE 3: LAYOUT & GENERATE */}
      {currentPhase === 3 &&
        (processedPages.length > 0 ? (
        <PhaseErrorBoundary phaseName="Layout & Generate">
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          <div className="flex flex-col gap-3 rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-surface-2 pb-2">
              <h3 className="text-xs font-bold text-white">N-Up Grid Format</h3>
              <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] font-bold text-primary-soft">
                Step 3 of 4
              </span>
            </div>

            <GridFormatPicker
              gridFormat={layoutConfig.gridFormat}
              columns={2}
              onSelect={onSelectLayoutFormat}
            />

            <div className="flex flex-col gap-2 pt-2 border-t border-surface-2 text-xs">
              <button
                type="button"
                onClick={onToggleOrientation}
                className="flex h-10 items-center justify-between rounded-xl border border-elevated bg-surface-2 px-3 font-semibold text-ink"
              >
                <span>Orientation</span>
                <strong className="text-primary-soft">{layoutConfig.orientation}</strong>
              </button>

              <div className="flex items-center justify-between px-1">
                <label className="flex items-center gap-2 text-ink-muted font-medium text-xs">
                  <input
                    type="checkbox"
                    checked={layoutConfig.showSlideBorders}
                    onChange={onToggleBorders}
                    className="h-4 w-4 rounded-xs border-elevated text-primary-strong"
                  />
                  <span>Slide Borders</span>
                </label>

                <label className="flex items-center gap-2 text-ink-muted font-medium text-xs">
                  <input
                    type="checkbox"
                    checked={layoutConfig.showPageNumbers}
                    onChange={onTogglePageNumbers}
                    className="h-4 w-4 rounded-xs border-elevated text-primary-strong"
                  />
                  <span>Page Numbers</span>
                </label>
              </div>
            </div>

            <MarginSettings
              layoutConfig={layoutConfig}
              onUpdateOuterMargins={handlers.handleUpdateOuterMargins}
              onUpdateInnerMargin={handlers.handleUpdateInnerMargin}
            />
          </div>

          {/* Apply Layout Button */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onApplyLayout}
            disabled={!layoutDirty || isProcessing || isPreviewProcessing}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition-all active:scale-95 ${
              layoutDirty && !isProcessing
                ? 'bg-primary-strong text-white shadow-lg shadow-primary-faint/30'
                : 'bg-surface-2 text-ink-muted border border-elevated'
            }`}
          >
            {isProcessing ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Rendering...
              </>
            ) : layoutDirty ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Apply &amp; Render
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 opacity-40" />
                Applied
              </>
            )}
          </button>
          {layoutDirty && !isProcessing && (
            <span className="text-[9px] text-warning font-bold">ÃƒÂ¢â€”Ã‚Â Unsaved</span>
          )}
        </div>

        {finalSheetPreviews.length > 0 && (
            <FullPdfViewerPreview
              sheetPreviews={finalSheetPreviews}
              layoutConfig={layoutConfig}
              title="A4 Print Sheet Preview"
            />
          )}

          <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-1.5 border-t border-surface-2 bg-surface/95 backdrop-blur-md p-2.5 pb-safe shadow-2xl">
            <button
              type="button"
              onClick={() => setCurrentPhase(2)}
              aria-label="Back to Optimize"
              className="flex h-11 items-center justify-center gap-1 rounded-xl border border-elevated bg-surface-2 px-3 text-xs font-bold text-ink-muted active:scale-95 transition-all shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden min-[400px]:inline">Back</span>
            </button>

            <button
              type="button"
              onClick={onDownloadFinalPrintPdf}
              disabled={!finalPrintPdfBlob}
              className="flex-1 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary-strong px-3 text-xs font-bold text-white shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span className="truncate">Download PDF</span>
            </button>

            <button
              type="button"
              onClick={onProceedToPhase4}
              className="flex h-11 items-center justify-center gap-1 rounded-xl bg-success-deep px-3.5 text-xs font-bold text-white shadow-lg active:scale-95 transition-all shrink-0"
            >
              <span>Finish</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        </PhaseErrorBoundary>
        ) : (
          <EmptyPhaseState
            title="Nothing to lay out yet"
            message="Optimize your PDF first so we can arrange the pages onto print sheets."
            onBack={() => setCurrentPhase(1)}
            backLabel="Back to Upload"
          />
        ))}

      {/* PHASE 4: DONE */}
      {currentPhase === 4 &&
        (finalPrintPdfBlob ? (
        <PhaseErrorBoundary phaseName="Complete">
        <div className="flex flex-col items-center gap-4 text-center animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-success-strong/30 bg-surface/90 p-5 shadow-xl w-full">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success-strong/20 text-success border border-success-strong/30">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-bold text-white">PDF Print-Ready!</h2>
            {finalMetrics && (
              <div className="flex gap-2 text-xs font-bold">
                <span className="rounded-lg bg-success-strong/20 px-2.5 py-1 text-success-soft border border-success-strong/30">
                  Paper Saved: ~75%
                </span>
                <span className="rounded-lg bg-primary/20 px-2.5 py-1 text-primary-soft border border-primary/30">
                  Ink: ~{finalMetrics.inkSavedPct}%
                </span>
              </div>
            )}
            {finalPrintPdfBlob && (
              <button
                type="button"
                onClick={onDownloadFinalPrintPdf}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-strong text-xs font-bold text-white shadow-lg active:scale-98 transition-all"
              >
                <Download className="h-4 w-4" />
                <span>Download Again</span>
              </button>
            )}
          </div>

          <FeedbackSection
            currentPhase={4}
            selectedEngineVersion={selectedEngineVersion}
            uploadedItemsCount={uploadedItems.length}
            uploadedFileNames={uploadedItems.map((item) => item.name)}
            uploadedFileSizesMB={uploadedItems.map((item) => (item.file?.size || 0) / (1024 * 1024))}
            mergedPdfSizeMB={(mergedPdfBlob?.size || 0) / (1024 * 1024)}
            totalInputPages={processedPages.length || mergedPageDataUrls.length}
            totalOutputPages={finalSheetPreviews.length}
            excludedPagesCount={excludedPages.size}
            totalOriginalSizeMB={
              uploadedItems.reduce((acc, item) => acc + (item.file?.size || 0), 0) / (1024 * 1024)
            }
            finalMetrics={finalMetrics}
            layoutConfig={layoutConfig}
            finalPrintPdfBlob={finalPrintPdfBlob}
            analysisTimeMs={state.analysisTimeMs}
            optimizationTimeMs={state.optimizationTimeMs}
            layoutTimeMs={state.layoutTimeMs}
          />

          <button
            type="button"
            onClick={onResetWorkflow}
            className="flex h-11 items-center gap-2 rounded-xl border border-elevated bg-surface-2/80 px-5 text-xs font-bold text-ink"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Optimize Another PDF</span>
          </button>
        </div>
        </PhaseErrorBoundary>
        ) : (
          <EmptyPhaseState
            title="Nothing here yet"
            message="Generate your print-ready PDF first ÃƒÂ¢Ã¢â€šÂ¬â€ your summary and feedback form will appear here."
            onBack={() => setCurrentPhase(3)}
            backLabel="Back to Layout"
          />
        ))}
    </div>
  );
};
