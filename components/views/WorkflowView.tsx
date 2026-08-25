'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Download,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Check,
} from 'lucide-react';
import { WorkflowUIProps } from './types';
import { UploadArea } from '@/components/UploadArea';
import { FileNameField } from '@/components/ui/FileNameField';
import { FileSequencePanel } from '@/components/FileSequencePanel';
import { BeforeAfterSlider } from '@/components/BeforeAfterSlider';
import { PageGrid } from '@/components/PageGrid';
import { PageSequencePreview } from '@/components/PageSequencePreview';
import { InfoTooltip } from '@/components/InfoTooltip';
import { GridFormatPicker } from '@/components/GridFormatPicker';
import { Button } from '@/components/ui/Button';
import { PhaseErrorBoundary } from '@/components/shared/PhaseErrorBoundary';
import { CardSkeleton } from '@/components/shared/LoadingSkeleton';
import { EmptyPhaseState } from '@/components/shared/EmptyPhaseState';
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

/**
 * One workflow view for every screen size. Density and structure differences
 * are pure CSS breakpoints — no JS media queries, no platform forks.
 *
 * Action bars are thumb-reachable fixed rows below md, inline rows from md up:
 * same DOM node, different positioning classes only.
 */
const ActionBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-2 border-t border-surface-2 bg-surface/95 p-3 pb-safe shadow-2xl backdrop-blur-md md:static md:border-0 md:bg-transparent md:p-0 md:pt-3 md:shadow-none md:backdrop-blur-none">
    {children}
  </div>
);

export const WorkflowView: React.FC<WorkflowUIProps> = ({ state, actions, handlers, onToolModeChange, enhanceHandoffActive, onBackToEnhance }) => {
  const {
    currentPhase,
    isProcessing,
    uploadedItems,
    mergedPdfBlob,
    mergedPdfBytes,
    mergedPageDataUrls,
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
    analysisTimeMs,
    optimizationTimeMs,
    layoutTimeMs,
  } = state;

  const {
    setPhase: setCurrentPhase,
    setSelectedPageIndex,
    setMasterParams: onMasterParamsChange,
    setProcessingToggles: onProcessingTogglesChange,
    setExcludedPages,
  } = actions;

  const {
    handleFilesUpload: onFilesUpload,
    handleMoveItem: onMoveItem,
    handleRemoveItem: onRemoveItem,
    handleReorderItem: onReorderItem,
    handleSmartArrange: onSmartArrange,
    handleDownloadMerged: onDownloadMerged,
    handleProceedToPhase2: onProceedToPhase2,
    handleToggleExcludePage: onToggleExcludePage,
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
    handleResetWorkflow: onResetWorkflow,
  } = handlers;

  const onToggleExcludeAll = (exclude: boolean) => {
    setExcludedPages(buildExcludedSet(state.processedPages.length, exclude));
  };

  // Output name for the final print PDF, shared by phase 3 and phase 4 downloads.
  const [printBase, setPrintBase] = useState(() =>
    uploadedItems[0]?.name ? uploadedItems[0].name.replace(/\.pdf$/i, '') : 'PW_Print_Ready_Notes',
  );

  const stepLabel =
    currentPhase === 1 ? '1 · Upload' : currentPhase === 2 ? '2 · Whiten' : currentPhase === 3 ? '3 · Layout' : '4 · Done';

  return (
    <div className="flex w-full max-w-full min-w-0 flex-col gap-4 md:gap-5 lg:gap-6">
      <header className="sticky top-0 z-30 -mx-4 flex items-center gap-3 border-b border-surface-2/70 bg-bg/90 px-4 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={() => {
            handlers.handleResetWorkflow();
            onToolModeChange?.(null);
          }}
          aria-label="Back to tools"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-elevated/60 bg-surface/80 text-ink transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-soft"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-[15px] font-bold text-ink">Dark Notes → Print</h1>
          <p className="truncate text-[11px] text-ink-faint">Auto-whiten · N-up · Print-ready · 100% on-device</p>
        </div>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-bold tabular-nums text-accent-soft">
          {stepLabel}
        </span>
      </header>

      {/* PHASE 1: UPLOAD & MERGE */}
      {currentPhase === 1 && (
        <PhaseErrorBoundary phaseName="Upload & Merge">
          <div className="animate-enter flex flex-col gap-4 md:gap-5">

            <div id="upload-area" className="scroll-mt-4">
              <UploadArea onFilesUpload={onFilesUpload} isProcessing={isProcessing} />
            </div>

            {uploadedItems.length > 0 && (
              <>
                <section className="flex flex-col gap-3 rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg sm:p-4 lg:p-5 sm:gap-4 sm:shadow-xl">
                  <div className="border-b border-surface-2 pb-2 sm:pb-3">
                    <h3 className="text-xs font-bold text-ink sm:text-sm">
                      PDF Sequence ({uploadedItems.length})
                    </h3>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Arrange files in lecture order before processing.
                    </p>
                  </div>

                  {/* Smart rearrangement: series-aware auto sort + drag & drop */}
                  <FileSequencePanel
                    items={uploadedItems}
                    isProcessing={isProcessing}
                    onMoveItem={onMoveItem}
                    onRemoveItem={onRemoveItem}
                    onReorderItem={onReorderItem}
                    onSmartArrange={onSmartArrange}
                    maxHeightClass="max-h-[320px]"
                  />

                  <PageSequencePreview pageUrls={mergedPageDataUrls} />
                </section>

                <ActionBar>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={onDownloadMerged}
                    disabled={!mergedPdfBlob}
                    aria-label="Download merged PDF"
                  >
                    <Download className="h-4 w-4 text-ink-muted" />
                    <span className="hidden lg:inline">Download Merged PDF</span>
                  </Button>

                  <Button
                    variant="primary"
                    size="lg"
                    onClick={onProceedToPhase2}
                    disabled={!mergedPdfBytes || isProcessing}
                    className="flex-1 md:flex-none"
                  >
                    Whiten PDF
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </ActionBar>
              </>
            )}
          </div>
        </PhaseErrorBoundary>
      )}

      {/* PHASE 2: ANALYZE & OPTIMIZE */}
      {currentPhase === 2 &&
        (processedPages.length > 0 ? (
          <PhaseErrorBoundary phaseName="Analyze & Optimize">
            <div className="animate-enter flex flex-col gap-4 md:gap-5">
              <div className="flex items-center gap-3 rounded-2xl border border-success-strong/30 bg-success-faint/40 p-3.5 shadow-lg sm:p-4 sm:shadow-xl">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-deep text-bg font-bold shadow-md sm:h-11 sm:w-11">
                  <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-success-soft">Dark Backgrounds Stripped</h3>
                  <p className="truncate text-xs text-ink-muted">
                    Processed {processedPages.length} pages · ~82% ink savings.
                  </p>
                </div>
              </div>

              {/* Processing settings (collapsed by default) */}
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

              <ActionBar>
                <Button variant="secondary" size="md" onClick={() => setCurrentPhase(1)}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>

                <Button
                  variant="primary"
                  size="lg"
                  onClick={onProceedToPhase3}
                  disabled={isProcessing}
                  className="flex-1 md:flex-none"
                >
                  Choose Layout
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </ActionBar>
            </div>
          </PhaseErrorBoundary>
        ) : (
          <EmptyPhaseState
            title="No pages to whiten yet"
            message="Upload and process your PDF first — then you can fine-tune ink savings here."
            onBack={() => setCurrentPhase(1)}
            backLabel="Back to Upload"
          />
        ))}

      {/* PHASE 3: LAYOUT & GENERATE */}
      {currentPhase === 3 &&
        (processedPages.length > 0 ? (
          <PhaseErrorBoundary phaseName="Layout & Generate">
            <div className="animate-enter flex flex-col gap-4 md:gap-5">
              <section className="flex flex-col gap-4 rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg sm:p-4 lg:p-5 sm:shadow-xl">
                <div className="border-b border-surface-2 pb-2 sm:pb-3">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-ink sm:text-sm">N-Up Grid Format</h3>
                    <InfoTooltip
                      title="Grid Layout Benefits"
                      content="Put several slides on one sheet to save paper and printing cost."
                      position="right"
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Select page density per printed A4 sheet.
                  </p>
                </div>

                <GridFormatPicker
                  gridFormat={layoutConfig.gridFormat}
                  onSelect={onSelectLayoutFormat}
                />

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-2 pt-3 text-xs">
                  <button
                    type="button"
                    onClick={onToggleOrientation}
                    className="flex h-11 items-center gap-1.5 rounded-xl border border-elevated bg-surface-2 px-3 font-semibold text-ink hover:bg-elevated transition-colors"
                  >
                    Orientation: <strong className="text-primary-soft">{layoutConfig.orientation}</strong>
                  </button>

                  <div className="flex items-center gap-4 font-medium text-ink-muted">
                    <label className="flex min-h-11 cursor-pointer select-none items-center gap-2">
                      <input
                        type="checkbox"
                        checked={layoutConfig.showSlideBorders}
                        onChange={onToggleBorders}
                        className="h-5 w-5 rounded-sm border-elevated text-primary-strong"
                      />
                      <span>Slide Borders</span>
                    </label>

                    <label className="flex min-h-11 cursor-pointer select-none items-center gap-2">
                      <input
                        type="checkbox"
                        checked={layoutConfig.showPageNumbers}
                        onChange={onTogglePageNumbers}
                        className="h-5 w-5 rounded-sm border-elevated text-primary-strong"
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
              </section>

              {/* Apply layout */}
              <div className="relative">
                <Button
                  fullWidth
                  size="lg"
                  variant={layoutDirty && !isProcessing ? 'primary' : 'secondary'}
                  loading={isProcessing}
                  disabled={!layoutDirty || isPreviewProcessing}
                  onClick={onApplyLayout}
                >
                  {!isProcessing && <Check className={`h-4 w-4 ${layoutDirty ? '' : 'opacity-40'}`} />}
                  {isProcessing ? 'Rendering Layout...' : layoutDirty ? 'Apply & Render Preview' : 'Layout Applied'}
                </Button>
                {layoutDirty && !isProcessing && (
                  <span className="absolute -top-5 right-0 text-xs font-medium text-warning">Unsaved changes</span>
                )}
              </div>

              {finalSheetPreviews.length > 0 && (
                <FullPdfViewerPreview
                  sheetPreviews={finalSheetPreviews}
                  layoutConfig={layoutConfig}
                  title="A4 Print Sheet Preview"
                />
              )}

              {/* Output name — consumed by the Download button in the ActionBar */}
              {finalPrintPdfBlob && (
                <div className="rounded-2xl border border-surface-2 bg-surface/80 p-4">
                  <FileNameField
                    baseName={printBase}
                    onChange={setPrintBase}
                    suffix="-PrintReady.pdf"
                    label="Print PDF filename"
                  />
                  <p className="mt-1.5 text-2xs text-ink-faint">Used by the Download button below.</p>
                </div>
              )}

              <ActionBar>
                {enhanceHandoffActive ? (
                  onBackToEnhance && (
                    <Button variant="secondary" size="md" onClick={onBackToEnhance}>
                      <ArrowLeft className="h-4 w-4" /> Back to Enhance
                    </Button>
                  )
                ) : (
                  <Button variant="secondary" size="md" onClick={() => setCurrentPhase(2)}>
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                )}

                <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => onDownloadFinalPrintPdf(printBase)}
                    disabled={!finalPrintPdfBlob}
                    className="flex-1 md:flex-none"
                  >
                    <Download className="h-4 w-4" /> Download
                  </Button>

                  <Button variant="secondary" size="lg" onClick={onProceedToPhase4}>
                    Finish
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </ActionBar>
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
            <div className="animate-enter mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
              <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-success-strong/30 bg-surface/90 p-6 shadow-lg sm:p-8 sm:shadow-xl">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-success-strong/30 bg-success-strong/20 text-success sm:h-16 sm:w-16">
                  <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10" />
                </div>

                <h2 className="mt-1 text-xl font-bold text-ink sm:text-display">Your PDF is Print-Ready!</h2>
                <p className="max-w-md text-xs leading-relaxed text-ink-muted sm:text-sm">
                  Your notes have been stripped of dark backgrounds, sharpened, and formatted for paper-saving printouts.
                </p>

                {finalMetrics && (
                  <div className="mt-2 flex items-center gap-2 text-xs font-bold">
                    <span className="rounded-lg border border-success-strong/30 bg-success-strong/20 px-3 py-1 text-success-soft">
                      Paper Saved: ~75%
                    </span>
                    <span className="rounded-lg border border-primary/30 bg-primary/20 px-3 py-1 text-primary-soft">
                      Ink Saved: ~{finalMetrics.inkSavedPct}%
                    </span>
                  </div>
                )}

                <Button variant="secondary" size="md" onClick={() => onDownloadFinalPrintPdf(printBase)}>
                  <Download className="h-4 w-4" />
                  Download Print PDF Again
                </Button>
              </div>

              <FeedbackSection
                currentPhase={4}
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
                analysisTimeMs={analysisTimeMs}
                optimizationTimeMs={optimizationTimeMs}
                layoutTimeMs={layoutTimeMs}
              />

              <Button variant="secondary" size="md" onClick={onResetWorkflow}>
                <RotateCcw className="h-4 w-4" />
                Optimize Another PDF
              </Button>
            </div>
          </PhaseErrorBoundary>
        ) : (
          <EmptyPhaseState
            title="Nothing here yet"
            message="Generate your print-ready PDF first — your summary and feedback form will appear here."
            onBack={() => setCurrentPhase(3)}
            backLabel="Back to Layout"
          />
        ))}
    </div>
  );
};