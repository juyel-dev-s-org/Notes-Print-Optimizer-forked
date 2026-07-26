'use client';

import React from 'react';
import { WorkflowUIProps } from '../types';
import { UploadArea } from '@/components/UploadArea';
import { BeforeAfterSlider } from '@/components/BeforeAfterSlider';
import { PageGrid } from '@/components/PageGrid';
import { PageSequencePreview } from '@/components/PageSequencePreview';
import { EngineSelector } from '@/components/EngineSelector';
import { InfoTooltip } from '@/components/InfoTooltip';
import { FeedbackSection } from '@/components/FeedbackSection';
import {
  Download,
  ArrowLeft,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Star,
  RotateCcw,
  Check,
  Smartphone,
} from 'lucide-react';

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
    onDownloadMerged,
    onProceedToPhase2,
    processedPages,
    selectedPageIndex,
    setSelectedPageIndex,
    excludedPages,
    onToggleExcludePage,
    onToggleExcludeAll,
    onProceedToPhase3,
    layoutConfig,
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

              {/* Mobile Reorderable File Cards */}
              <div className="flex flex-col gap-2">
                {uploadedItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-2.5 active:bg-slate-800/80 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600/30 text-indigo-300 font-bold text-xs border border-indigo-500/30">
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-100 truncate">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-slate-400">{item.sizeMB} MB</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onMoveItem(idx, 'UP')}
                        disabled={idx === 0}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 active:bg-slate-800 disabled:opacity-20"
                        title="Move Up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveItem(idx, 'DOWN')}
                        disabled={idx === uploadedItems.length - 1}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 active:bg-slate-800 disabled:opacity-20"
                        title="Move Down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(idx)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-red-400 active:bg-red-950/60"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

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
      )}

      {/* PHASE 2: ANALYZE & OPTIMIZE */}
      {currentPhase === 2 && processedPages.length > 0 && (
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
      )}

      {/* PHASE 3: LAYOUT & GENERATE */}
      {currentPhase === 3 && (
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
          </div>

          {finalSheetPreviews.length > 0 && (
            <div className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-900/90 p-3 shadow-xl">
              <h3 className="text-xs font-bold text-white border-b border-slate-800 pb-1.5">
                Sheet Previews ({finalSheetPreviews.length})
              </h3>
              <div className="grid grid-cols-1 gap-3 max-h-[360px] overflow-y-auto p-1">
                {finalSheetPreviews.map((previewUrl, sIdx) => (
                  <div key={sIdx} className="flex flex-col rounded-xl border border-slate-800 bg-slate-950 p-2">
                    <div className="mb-1 flex justify-between text-[10px] font-bold text-slate-300">
                      <span>Sheet {sIdx + 1} of {finalSheetPreviews.length}</span>
                      <span>{layoutConfig.gridFormat}</span>
                    </div>
                    <div className="relative w-full overflow-hidden rounded-lg bg-white border border-slate-200 flex items-center justify-center p-1 aspect-[1.414/1]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewUrl} alt={`Sheet ${sIdx + 1}`} className="max-h-full max-w-full object-contain" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-2 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md p-3 pb-safe shadow-2xl">
            <button
              type="button"
              onClick={() => setCurrentPhase(2)}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 text-xs font-bold text-slate-300"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onDownloadFinalPrintPdf}
              disabled={!finalPrintPdfBlob}
              className="flex-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-lg active:scale-98 transition-all disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* PHASE 4: DONE */}
      {currentPhase === 4 && (
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
            totalInputPages={processedPages.length || mergedPageDataUrls.length}
            totalOutputPages={finalSheetPreviews.length}
            excludedPagesCount={excludedPages.size}
            totalOriginalSizeMB={
              uploadedItems.reduce((acc, item) => acc + (item.file?.size || 0), 0) / (1024 * 1024)
            }
            finalMetrics={finalMetrics}
            layoutConfig={layoutConfig}
            finalPrintPdfBlob={finalPrintPdfBlob}
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
      )}
    </div>
  );
};
