'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { WorkflowUIProps } from '../types';
import { UploadArea } from '@/components/UploadArea';
import { LandingHero } from '@/components/LandingHero';
import { FeatureStrip } from '@/components/FeatureStrip';
import { ToolsBox } from '@/components/tools/ToolsBox';
import { FileSequencePanel } from '@/components/FileSequencePanel';
import { BeforeAfterSlider } from '@/components/BeforeAfterSlider';
import { PageGrid } from '@/components/PageGrid';
import { PageSequencePreview } from '@/components/PageSequencePreview';
import { EngineSelector } from '@/components/EngineSelector';
import { InfoTooltip } from '@/components/InfoTooltip';
import {
  Download,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Check,
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

const EnhanceToolView = dynamic(() => import('@/components/enhance/EnhanceToolView').then(m => m.EnhanceToolView), {
  loading: () => <CardSkeleton />,
});

export const DesktopWorkflowUI: React.FC<WorkflowUIProps> = ({ state, actions, handlers, toolMode, onToolModeChange }) => {
  if (toolMode === 'enhance') {
    return (
      <div className="flex flex-col gap-6 pb-12 w-full max-w-full">
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
    setExcludedPages,
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

  const onToggleExcludeAll = (exclude: boolean) => {
    setExcludedPages(buildExcludedSet(state.processedPages.length, exclude));
  };

  return (
    <div className="flex flex-col gap-6 pb-12 w-full max-w-full">
      {/* PHASE 1: UPLOAD & MERGE — Upload primary, ToolsBox + FeatureStrip follow */}
      {currentPhase === 1 && (
        <PhaseErrorBoundary phaseName="Upload & Merge">
        <div className="flex flex-col gap-5 animate-in fade-in duration-200">
          <LandingHero />

          <div id="upload-area" className="scroll-mt-4">
            <UploadArea
              onFilesUpload={onFilesUpload}
              onLoadSample={onLoadSample}
              isProcessing={isProcessing}
            />
          </div>

          <ToolsBox
            onSelectDarkPrint={() => {
              onToolModeChange?.('dark-print');
              document.getElementById('upload-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            onSelectEnhance={() => onToolModeChange?.('enhance')}
          />

          {/* Empty-state value strip: compact bottom, not blocking upload */}
          {uploadedItems.length === 0 && !isProcessing && <FeatureStrip />}

          {uploadedItems.length > 0 && (
            <div className="flex flex-col gap-4 rounded-2xl border border-surface-2 bg-surface/90 p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-surface-2 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    PDF Document Sequence ({uploadedItems.length} File{uploadedItems.length > 1 ? 's' : ''})
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Arrange files in lecture chronological order before processing.
                  </p>
                </div>
                <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary-soft border border-primary/30">
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
                maxHeightClass="max-h-[320px]"
              />

              {/* Engine Selector */}
              <EngineSelector
                selectedVersion={selectedEngineVersion}
                onSelectVersion={setSelectedEngineVersion}
                disabled={isProcessing}
              />

              {/* Page Sequence Preview Gallery */}
              <PageSequencePreview pageUrls={mergedPageDataUrls} />

              {/* Desktop Phase 1 Action Bar */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-surface-2">
                <button
                  type="button"
                  onClick={onDownloadMerged}
                  disabled={!mergedPdfBlob}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-elevated bg-surface-2/80 px-4 py-2.5 text-xs font-bold text-ink hover:bg-elevated transition-colors disabled:opacity-40"
                >
                  <Download className="h-4 w-4 text-ink-muted" />
                  <span>Download Merged PDF</span>
                </button>

                <button
                  type="button"
                  onClick={onProceedToPhase2}
                  disabled={!mergedPdfBytes || isProcessing}
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary-strong px-6 text-sm font-bold text-white shadow-lg hover:bg-primary transition-colors disabled:opacity-50"
                >
                  <span>Proceed to Optimize</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </PhaseErrorBoundary>
      )}

      {/* PHASE 2: ANALYZE & OPTIMIZE */}
      {currentPhase === 2 &&
        (processedPages.length > 0 ? (
          <PhaseErrorBoundary phaseName="Analyze & Optimize">
        <div className="flex flex-col gap-5 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-success-strong/30 bg-success-faint/40 p-4 shadow-lg">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success-deep text-bg font-bold shadow-md">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-success-soft">Dark Backgrounds Stripped</h3>
                <p className="text-xs text-ink-muted truncate">
                  Stripped dark slides & sharpened ink strokes across {processedPages.length} pages.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="rounded-lg bg-success-strong/20 px-3 py-1 text-xs font-bold text-success-soft border border-success-strong/30">
                ~82% Ink Saved
              </span>
            </div>
          </div>

          {/* Processing Settings Panel (hidden by default, toggle to expand) */}
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

          <div className="flex items-center justify-between rounded-2xl border border-surface-2 bg-surface/90 p-4 shadow-xl">
            <button
              type="button"
              onClick={() => setCurrentPhase(1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-elevated bg-surface-2 px-4 py-2.5 text-xs font-bold text-ink-muted hover:bg-elevated hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Merge</span>
            </button>

            <button
              type="button"
              onClick={onProceedToPhase3}
              disabled={isProcessing}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary-strong px-6 text-sm font-bold text-white shadow-lg hover:bg-primary transition-colors"
            >
              <span>Choose Grid Layout</span>
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
        <div className="flex flex-col gap-5 animate-in fade-in duration-200">
          <div className="flex flex-col gap-4 rounded-2xl border border-surface-2 bg-surface/90 p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-surface-2 pb-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white">N-Up Grid Layout & Format</h3>
                  <InfoTooltip
                    title="PW Grid Layout Benefits"
                    content="Put several slides on one sheet to save paper and printing cost."
                    position="right"
                  />
                </div>
                <p className="text-xs text-ink-muted">
                  Select page density per printed A4 sheet. 4-Up (2x2) saves 75% paper with high legibility.
                </p>
              </div>
              <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary-soft border border-primary/30">
                Step 3 of 4
              </span>
            </div>

            <GridFormatPicker
              gridFormat={layoutConfig.gridFormat}
              columns={6}
              onSelect={onSelectLayoutFormat}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-surface-2 text-xs">
              <button
                type="button"
                onClick={onToggleOrientation}
                className="flex h-10 items-center gap-1.5 rounded-xl border border-elevated bg-surface-2 px-3 font-semibold text-ink hover:bg-elevated"
              >
                <span>Orientation: <strong className="text-primary-soft">{layoutConfig.orientation}</strong></span>
              </button>

              <div className="flex items-center gap-4 font-medium text-ink-muted">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={layoutConfig.showSlideBorders}
                    onChange={onToggleBorders}
                    className="h-4 w-4 rounded-xs border-elevated text-primary-strong"
                  />
                  <span>Slide Borders</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
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
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={onApplyLayout}
            disabled={!layoutDirty || isProcessing || isPreviewProcessing}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all ${
              layoutDirty && !isProcessing
                ? 'bg-primary-strong text-white hover:bg-primary shadow-lg shadow-primary-faint/30 active:scale-[0.98]'
                : 'bg-surface-2 text-ink-muted cursor-not-allowed border border-elevated'
            }`}
          >
            {isProcessing ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Rendering Layout...
              </>
            ) : layoutDirty ? (
              <>
                <Check className="h-4 w-4" />
                Apply &amp; Render Preview
              </>
            ) : (
              <>
                <Check className="h-4 w-4 opacity-40" />
                Layout Applied
              </>
            )}
          </button>
          {layoutDirty && !isProcessing && (
            <span className="text-[10px] text-warning font-medium">ÃƒÂ¢â€”Ã‚Â Unsaved changes</span>
          )}
        </div>

        {finalSheetPreviews.length > 0 && (
            <FullPdfViewerPreview
              sheetPreviews={finalSheetPreviews}
              layoutConfig={layoutConfig}
              title="A4 Print Sheet Preview"
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-2 bg-surface/90 p-4 shadow-xl">
            <button
              type="button"
              onClick={() => setCurrentPhase(2)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-elevated bg-surface-2 px-4 py-2.5 text-xs font-bold text-ink-muted hover:bg-elevated hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Optimize</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDownloadFinalPrintPdf}
                disabled={!finalPrintPdfBlob}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary-strong px-6 text-sm font-bold text-white shadow-lg hover:bg-primary transition-colors disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                <span>Download Final Print PDF</span>
              </button>

              <button
                type="button"
                onClick={onProceedToPhase4}
                className="inline-flex h-12 items-center gap-1 rounded-xl bg-surface-2 px-4 text-xs font-bold text-ink hover:bg-elevated transition-colors"
              >
                <span>Finish</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
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
        <div className="flex flex-col items-center gap-5 text-center animate-in fade-in duration-200 max-w-xl mx-auto">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-success-strong/30 bg-surface/90 p-8 shadow-xl w-full">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success-strong/20 text-success border border-success-strong/30">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <h2 className="text-xl font-bold text-white mt-1">Your PDF is Print-Ready!</h2>
            <p className="text-xs text-ink-muted max-w-md leading-relaxed">
              Your Physics Wallah class notes have been stripped of dark backgrounds, sharpened, and formatted for paper-saving printouts.
            </p>

            {finalMetrics && (
              <div className="mt-2 flex items-center gap-2 text-xs font-bold">
                <span className="rounded-lg bg-success-strong/20 px-3 py-1 text-success-soft border border-success-strong/30">
                  Paper Saved: ~75%
                </span>
                <span className="rounded-lg bg-primary/20 px-3 py-1 text-primary-soft border border-primary/30">
                  Ink Saved: ~{finalMetrics.inkSavedPct}%
                </span>
              </div>
            )}

            {finalPrintPdfBlob && (
              <button
                type="button"
                onClick={onDownloadFinalPrintPdf}
                className="mt-4 flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-primary-strong px-6 text-sm font-bold text-white shadow-lg hover:bg-primary transition-all"
              >
                <Download className="h-4 w-4" />
                <span>Download Print PDF Again</span>
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
            className="flex h-12 items-center gap-2 rounded-xl border border-elevated bg-surface-2/80 px-6 text-xs font-bold text-ink hover:bg-elevated shadow-md"
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
