'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { WorkflowUIProps } from '../types';
import { UploadArea } from '@/components/UploadArea';
import { FileSequencePanel } from '@/components/FileSequencePanel';
import { BeforeAfterSlider } from '@/components/BeforeAfterSlider';
import { PageGrid } from '@/components/PageGrid';
import { PageSequencePreview } from '@/components/PageSequencePreview';
import { EngineSelector } from '@/components/EngineSelector';
import { InfoTooltip } from '@/components/InfoTooltip';
import {
  Download,
  ArrowLeft,
  CheckCircle2,
  RotateCcw,
  Check,
  Monitor,
} from 'lucide-react';
import { PhaseErrorBoundary } from '@/components/shared/PhaseErrorBoundary';
import { CardSkeleton } from '@/components/shared/LoadingSkeleton';

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

export const DesktopWorkflowUI: React.FC<WorkflowUIProps> = (props) => {
  const {
    currentPhase,
    setCurrentPhase,
    isProcessing,
    uploadedItems,
    mergedPdfBlob,
    mergedPdfBytes,
    mergedPageDataUrls,
    selectedEngineVersion,
    setSelectedEngineVersion,
    onFilesUpload,
    onLoadSample,
    onMoveItem,
    onRemoveItem,
    onReorderItem,
    onSmartArrange,
    onDownloadMerged,
    onProceedToPhase2,
    processedPages,
    selectedPageIndex,
    setSelectedPageIndex,
    excludedPages,
    onToggleExcludePage,
    onToggleExcludeAll,
    onProceedToPhase3,
    masterParams,
    onMasterParamsChange,
    onReprocess,
    processingToggles,
    onProcessingTogglesChange,
    onPreviewReprocess,
    isPreviewProcessing,
    onResetSettings,
    layoutConfig,
    layoutDirty,
    onApplyLayout,
    finalSheetPreviews,
    finalMetrics,
    finalPrintPdfBlob,
    onSelectLayoutFormat,
    onToggleOrientation,
    onToggleBorders,
    onTogglePageNumbers,
    onDownloadFinalPrintPdf,
    onProceedToPhase4,
    rating,
    setRating,
    feedbackText,
    setFeedbackText,
    feedbackSubmitted,
    onSendFeedback,
    onResetWorkflow,
  } = props;

  return (
    <div className="flex flex-col gap-6 pb-12 w-full max-w-full">
      {/* Platform Badge Indicator */}
      <div className="flex items-center justify-between px-1 text-[10px] text-slate-400 font-mono">
        <span className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-3 py-1 rounded-full">
          <Monitor className="h-3.5 w-3.5 text-indigo-400" />
          Desktop / Laptop Viewport
        </span>
        <span>Expanded Multi-Column Dashboard</span>
      </div>

      {/* PHASE 1: UPLOAD & MERGE */}
      {currentPhase === 1 && (
        <PhaseErrorBoundary phaseName="Upload & Merge">
        <div className="flex flex-col gap-5 animate-in fade-in duration-200">
          <UploadArea
            onFilesUpload={onFilesUpload}
            onLoadSample={onLoadSample}
            isProcessing={isProcessing}
          />

          {uploadedItems.length > 0 && (
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    PDF Document Sequence ({uploadedItems.length} File{uploadedItems.length > 1 ? 's' : ''})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Arrange files in lecture chronological order before processing.
                  </p>
                </div>
                <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300 border border-indigo-500/30">
                  Stage 1 of 4
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
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onDownloadMerged}
                  disabled={!mergedPdfBlob}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-40"
                >
                  <Download className="h-4 w-4 text-slate-400" />
                  <span>Download Merged PDF</span>
                </button>

                <button
                  type="button"
                  onClick={onProceedToPhase2}
                  disabled={!mergedPdfBytes || isProcessing}
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-bold text-white shadow-lg hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  <span>Proceed to Optimize →</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </PhaseErrorBoundary>
      )}

      {/* PHASE 2: ANALYZE & OPTIMIZE */}
      {currentPhase === 2 && processedPages.length > 0 && (
        <PhaseErrorBoundary phaseName="Analyze & Optimize">
        <div className="flex flex-col gap-5 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-4 shadow-lg">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-slate-950 font-bold shadow-md">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-emerald-300">Dark Backgrounds Stripped</h3>
                <p className="text-xs text-slate-300 truncate">
                  Stripped dark slides & sharpened ink strokes across {processedPages.length} pages.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="rounded-lg bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/30">
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
            <BeforeAfterSlider page={processedPages[selectedPageIndex]} />
          )}

          <PageGrid
            pages={processedPages}
            selectedPageIndex={selectedPageIndex}
            onSelectPage={setSelectedPageIndex}
            excludedPages={excludedPages}
            onToggleExcludePage={onToggleExcludePage}
            onToggleExcludeAll={onToggleExcludeAll}
          />

          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl">
            <button
              type="button"
              onClick={() => setCurrentPhase(1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Merge</span>
            </button>

            <button
              type="button"
              onClick={onProceedToPhase3}
              disabled={isProcessing}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-bold text-white shadow-lg hover:bg-indigo-500 transition-colors"
            >
              <span>Choose Grid Layout →</span>
            </button>
          </div>
        </div>
        </PhaseErrorBoundary>
      )}

      {/* PHASE 3: LAYOUT & GENERATE */}
      {currentPhase === 3 && (
        <PhaseErrorBoundary phaseName="Layout & Generate">
        <div className="flex flex-col gap-5 animate-in fade-in duration-200">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white">N-Up Grid Layout & Format</h3>
                  <InfoTooltip
                    title="PW Grid Layout Benefits"
                    content="Combines multiple slides onto a single sheet to reduce paper thickness and printing costs."
                    position="right"
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Select page density per printed A4 sheet. 4-Up (2x2) saves 75% paper with high legibility.
                </p>
              </div>
              <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300 border border-indigo-500/30">
                Stage 3 of 4
              </span>
            </div>

            <div className="grid grid-cols-6 gap-3">
              {[
                { format: '2x2', label: '4-Up (2x2)', desc: '4 pages per sheet', recommended: true, pwTip: 'PW Recommended: High legibility math & physics.' },
                { format: '1x2', label: '2-Up (1x2)', desc: '2 pages per sheet', recommended: false, pwTip: 'High detail layout for circuit diagrams.' },
                { format: '2x3', label: '6-Up (2x3)', desc: '6 pages per sheet', recommended: false, pwTip: 'Formula revision layout.' },
                { format: '2x4', label: '8-Up (2x4)', desc: '8 pages per sheet', recommended: false, pwTip: 'Compact cheatsheet layout.' },
                { format: '2x5', label: '10-Up (2x5)', desc: '10 pages per sheet', recommended: false, pwTip: 'Ultra-compact notes layout.' },
                { format: '1x1', label: '1-Up (1x1)', desc: '1 page per sheet', recommended: false, pwTip: 'Original full-page layout.' },
              ].map((item) => {
                const isSelected = layoutConfig.gridFormat === item.format || (item.format === '2x2' && layoutConfig.gridFormat === '4up');
                return (
                  <div
                    key={item.format}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectLayoutFormat(item.format as any)}
                    className={`relative flex flex-col justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-950/60 ring-2 ring-indigo-500 shadow-md'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {item.recommended && (
                        <span className="mb-1 inline-block rounded-xs bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                          RECOMMENDED
                        </span>
                      )}
                      <h4 className="text-xs font-bold text-white">{item.label}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-2 text-[10px] font-semibold text-slate-400">
                      <span>{item.format}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-indigo-400" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={onToggleOrientation}
                className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 font-semibold text-slate-200 hover:bg-slate-700"
              >
                <span>Orientation: <strong className="text-indigo-300">{layoutConfig.orientation}</strong></span>
              </button>

              <div className="flex items-center gap-4 font-medium text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={layoutConfig.showSlideBorders}
                    onChange={onToggleBorders}
                    className="h-4 w-4 rounded-xs border-slate-700 text-indigo-600"
                  />
                  <span>Slide Borders</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={layoutConfig.showPageNumbers}
                    onChange={onTogglePageNumbers}
                    className="h-4 w-4 rounded-xs border-slate-700 text-indigo-600"
                  />
                  <span>Page Numbers</span>
                </label>
              </div>
            </div>

            <MarginSettings
              layoutConfig={layoutConfig}
              onUpdateOuterMargins={props.onUpdateOuterMargins}
              onUpdateInnerMargin={props.onUpdateInnerMargin}
            />
          </div>

          {/* Apply Layout Button */}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={onApplyLayout}
            disabled={!layoutDirty || isProcessing}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all ${
              layoutDirty && !isProcessing
                ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/30 active:scale-[0.98]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
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
                Layout Applied ✓
              </>
            )}
          </button>
          {layoutDirty && !isProcessing && (
            <span className="text-[10px] text-amber-400 font-medium">● Unsaved changes</span>
          )}
        </div>

        {finalSheetPreviews.length > 0 && (
            <FullPdfViewerPreview
              sheetPreviews={finalSheetPreviews}
              layoutConfig={layoutConfig}
              title="A4 Print Sheet Preview"
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl">
            <button
              type="button"
              onClick={() => setCurrentPhase(2)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Optimize</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDownloadFinalPrintPdf}
                disabled={!finalPrintPdfBlob}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-bold text-white shadow-lg hover:bg-indigo-500 transition-colors disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                <span>Download Final Print PDF</span>
              </button>

              <button
                type="button"
                onClick={onProceedToPhase4}
                className="inline-flex h-12 items-center gap-1 rounded-xl bg-slate-800 px-4 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors"
              >
                <span>Finish →</span>
              </button>
            </div>
          </div>
        </div>
        </PhaseErrorBoundary>
      )}

      {/* PHASE 4: DONE */}
      {currentPhase === 4 && (
        <PhaseErrorBoundary phaseName="Complete">
        <div className="flex flex-col items-center gap-5 text-center animate-in fade-in duration-200 max-w-xl mx-auto">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/30 bg-slate-900/90 p-8 shadow-xl w-full">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <h2 className="text-xl font-bold text-white mt-1">Your PDF is Print-Ready!</h2>
            <p className="text-xs text-slate-300 max-w-md leading-relaxed">
              Your Physics Wallah class notes have been stripped of dark backgrounds, sharpened, and formatted for paper-saving printouts.
            </p>

            {finalMetrics && (
              <div className="mt-2 flex items-center gap-2 text-xs font-bold">
                <span className="rounded-lg bg-emerald-500/20 px-3 py-1 text-emerald-300 border border-emerald-500/30">
                  Paper Saved: ~75%
                </span>
                <span className="rounded-lg bg-indigo-500/20 px-3 py-1 text-indigo-300 border border-indigo-500/30">
                  Ink Saved: ~{finalMetrics.inkSavedPct}%
                </span>
              </div>
            )}

            {finalPrintPdfBlob && (
              <button
                type="button"
                onClick={onDownloadFinalPrintPdf}
                className="mt-4 flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-bold text-white shadow-lg hover:bg-indigo-500 transition-all"
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
            analysisTimeMs={props.analysisTimeMs}
            optimizationTimeMs={props.optimizationTimeMs}
            layoutTimeMs={props.layoutTimeMs}
          />

          <button
            type="button"
            onClick={onResetWorkflow}
            className="flex h-12 items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-6 text-xs font-bold text-slate-200 hover:bg-slate-700 shadow-md"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Optimize Another PDF</span>
          </button>
        </div>
        </PhaseErrorBoundary>
      )}
    </div>
  );
};
