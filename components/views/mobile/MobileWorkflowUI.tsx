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

export const MobileWorkflowUI: React.FC<WorkflowUIProps> = (props) => {
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
    <div className="flex flex-col gap-4 pb-20 w-full max-w-full">
      {/* Platform Badge Indicator */}
      <div className="flex items-center justify-between px-1 text-[10px] text-slate-400 font-mono">
        <span className="flex items-center gap-1 bg-slate-900/80 border border-slate-800 px-2 py-0.5 rounded-full">
          <Smartphone className="h-3 w-3 text-indigo-400" />
          Mobile UI Viewport
        </span>
        <span>Touch-Optimized UX</span>
      </div>

      {/* PHASE 1: UPLOAD & MERGE */}
      {currentPhase === 1 && (
        <PhaseErrorBoundary phaseName="Upload & Merge">
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          <UploadArea
            onFilesUpload={onFilesUpload}
            onLoadSample={onLoadSample}
            isProcessing={isProcessing}
          />

          {uploadedItems.length > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-xs font-bold text-white">
                  PDF Sequence ({uploadedItems.length})
                </h3>
                <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[10px] font-bold text-indigo-300">
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
            <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-2 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md p-3 pb-safe shadow-2xl">
              <button
                type="button"
                onClick={onDownloadMerged}
                disabled={!mergedPdfBlob}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 text-xs font-bold text-slate-300 disabled:opacity-40"
              >
                <Download className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onProceedToPhase2}
                disabled={!mergedPdfBytes || isProcessing}
                className="flex-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-lg active:scale-98 transition-all disabled:opacity-50"
              >
                <span>Optimize PDF →</span>
              </button>
            </div>
          )}
        </div>
        </PhaseErrorBoundary>
      )}

      {/* PHASE 2: ANALYZE & OPTIMIZE */}
      {currentPhase === 2 && processedPages.length > 0 && (
        <PhaseErrorBoundary phaseName="Analyze & Optimize">
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          <div className="flex flex-col gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-slate-950 font-bold shadow-md">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-bold text-emerald-300">Dark Backgrounds Stripped</h3>
                <p className="text-[11px] text-slate-300 truncate">
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

          <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-2 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md p-3 pb-safe shadow-2xl">
            <button
              type="button"
              onClick={() => setCurrentPhase(1)}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 text-xs font-bold text-slate-300"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onProceedToPhase3}
              disabled={isProcessing}
              className="flex-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-lg active:scale-98 transition-all"
            >
              <span>Choose Layout →</span>
            </button>
          </div>
        </div>
        </PhaseErrorBoundary>
      )}

      {/* PHASE 3: LAYOUT & GENERATE */}
      {currentPhase === 3 && (
        <PhaseErrorBoundary phaseName="Layout & Generate">
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-white">N-Up Grid Format</h3>
              <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[10px] font-bold text-indigo-300">
                Step 3 of 4
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { format: '2x2', label: '4-Up (2x2)', desc: '4 slides/sheet', recommended: true },
                { format: '1x2', label: '2-Up (1x2)', desc: '2 slides/sheet', recommended: false },
                { format: '2x3', label: '6-Up (2x3)', desc: '6 slides/sheet', recommended: false },
                { format: '2x4', label: '8-Up (2x4)', desc: '8 slides/sheet', recommended: false },
                { format: '2x5', label: '10-Up (2x5)', desc: '10 slides/sheet', recommended: false },
                { format: '1x1', label: '1-Up (1x1)', desc: '1 slide/sheet', recommended: false },
              ].map((item) => {
                const isSelected = layoutConfig.gridFormat === item.format || (item.format === '2x2' && layoutConfig.gridFormat === '4up');
                return (
                  <button
                    key={item.format}
                    type="button"
                    onClick={() => onSelectLayoutFormat(item.format as any)}
                    className={`flex flex-col justify-between rounded-xl border p-2.5 text-left active:scale-98 transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-950/60 ring-1 ring-indigo-500 shadow-md'
                        : 'border-slate-800 bg-slate-950/60'
                    }`}
                  >
                    <div>
                      {item.recommended && (
                        <span className="mb-1 inline-block rounded-xs bg-indigo-600 px-1 py-0.5 text-[8px] font-bold text-white">
                          REC
                        </span>
                      )}
                      <h4 className="text-xs font-bold text-white">{item.label}</h4>
                      <p className="text-[10px] text-slate-400">{item.desc}</p>
                    </div>
                    {isSelected && (
                      <div className="mt-1 flex justify-end">
                        <Check className="h-3.5 w-3.5 text-indigo-400" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={onToggleOrientation}
                className="flex h-10 items-center justify-between rounded-xl border border-slate-700 bg-slate-800 px-3 font-semibold text-slate-200"
              >
                <span>Orientation</span>
                <strong className="text-indigo-300">{layoutConfig.orientation}</strong>
              </button>

              <div className="flex items-center justify-between px-1">
                <label className="flex items-center gap-2 text-slate-300 font-medium text-xs">
                  <input
                    type="checkbox"
                    checked={layoutConfig.showSlideBorders}
                    onChange={onToggleBorders}
                    className="h-4 w-4 rounded-xs border-slate-700 text-indigo-600"
                  />
                  <span>Slide Borders</span>
                </label>

                <label className="flex items-center gap-2 text-slate-300 font-medium text-xs">
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
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onApplyLayout}
            disabled={!layoutDirty || isProcessing}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition-all active:scale-95 ${
              layoutDirty && !isProcessing
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
                : 'bg-slate-800 text-slate-500 border border-slate-700'
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
                Applied ✓
              </>
            )}
          </button>
          {layoutDirty && !isProcessing && (
            <span className="text-[9px] text-amber-400 font-bold">● Unsaved</span>
          )}
        </div>

        {finalSheetPreviews.length > 0 && (
            <FullPdfViewerPreview
              sheetPreviews={finalSheetPreviews}
              layoutConfig={layoutConfig}
              title="A4 Print Sheet Preview"
            />
          )}

          <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-1.5 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md p-2.5 pb-safe shadow-2xl">
            <button
              type="button"
              onClick={() => setCurrentPhase(2)}
              className="flex h-11 items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 text-xs font-bold text-slate-300 active:scale-95 transition-all shrink-0"
              title="Back to Phase 2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden xs:inline">Back</span>
            </button>

            <button
              type="button"
              onClick={onDownloadFinalPrintPdf}
              disabled={!finalPrintPdfBlob}
              className="flex-1 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-xs font-bold text-white shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span className="truncate">Download PDF</span>
            </button>

            <button
              type="button"
              onClick={onProceedToPhase4}
              className="flex h-11 items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-lg active:scale-95 transition-all shrink-0"
            >
              <span>Finish</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        </PhaseErrorBoundary>
      )}

      {/* PHASE 4: DONE */}
      {currentPhase === 4 && (
        <PhaseErrorBoundary phaseName="Complete">
        <div className="flex flex-col items-center gap-4 text-center animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-slate-900/90 p-5 shadow-xl w-full">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-bold text-white">PDF Print-Ready!</h2>
            {finalMetrics && (
              <div className="flex gap-2 text-xs font-bold">
                <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-emerald-300 border border-emerald-500/30">
                  Paper Saved: ~75%
                </span>
                <span className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-indigo-300 border border-indigo-500/30">
                  Ink: ~{finalMetrics.inkSavedPct}%
                </span>
              </div>
            )}
            {finalPrintPdfBlob && (
              <button
                type="button"
                onClick={onDownloadFinalPrintPdf}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-xs font-bold text-white shadow-lg active:scale-98 transition-all"
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
            analysisTimeMs={props.analysisTimeMs}
            optimizationTimeMs={props.optimizationTimeMs}
            layoutTimeMs={props.layoutTimeMs}
          />

          <button
            type="button"
            onClick={onResetWorkflow}
            className="flex h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-5 text-xs font-bold text-slate-200"
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
