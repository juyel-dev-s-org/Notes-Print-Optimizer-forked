'use client';

import React, { useCallback, useEffect } from 'react';
import { Header } from '@/components/Header';
import { ProcessingModal } from '@/components/ProcessingModal';
import { PlatformUIOrchestrator } from '@/components/views/PlatformUIOrchestrator';

import { SamplePdfGenerator } from '@/lib/optimizer/samplePdfGenerator';
import { PdfExporter } from '@/lib/optimizer/pdfExporter';
import { pwOptimizerStorage } from '@/lib/optimizer/storage';
import { memoryManager } from '@/lib/optimizer/memoryManager';

import { useWorkflow } from '@/lib/workflow/useWorkflow';

import type {
  GridFormat,
  LayoutConfig,
  OuterMarginConfig,
} from '@/lib/optimizer/types';

interface UploadedPdfItem {
  id: string;
  file: File;
  name: string;
  sizeMB: string;
  arrayBuffer: ArrayBuffer;
}

export default function HomePage() {
  const { state, actions } = useWorkflow();
  const {
    currentPhase, isProcessing, progress, errorMessage,
    uploadedItems, mergedPdfBlob, mergedPdfBytes, mergedPageDataUrls,
    rawPagesData, pageProfiles, docProfile,
    processedPages, optimized1UpBlob, selectedPageIndex, excludedPages,
    selectedEngineVersion, masterParams,
    layoutConfig, finalPrintPdfBlob, finalSheetPreviews, finalMetrics, layoutDirty,
    rating, feedbackText, feedbackSubmitted,
    analysisTimeMs, optimizationTimeMs, layoutTimeMs,
  } = state;

  // Temporary IndexedDB session cache lifecycle manager
  useEffect(() => {
    pwOptimizerStorage.clearCache();

    const handleUnload = () => {
      pwOptimizerStorage.clearCache();
      memoryManager.revokeAllBlobUrls();
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, []);

  // Reset entire workflow memory according to memory policy
  const handleResetWorkflow = useCallback(() => {
    pwOptimizerStorage.clearCache();
    memoryManager.revokeAllBlobUrls();
    actions.resetWorkflow();
  }, [actions]);

  // -------------------------------------------------------------
  // PHASE 1 HANDLERS: Upload, Arrange, Merge
  // -------------------------------------------------------------

  const handleFilesUpload = async (newFiles: File[]) => {
    actions.setError(null);
    actions.setProcessing(true);
    actions.setProgress({
      stage: 'INITIALIZING',
      currentPage: 0,
      totalPages: newFiles.length,
      percent: 20,
      currentAction: 'Reading PDF files...',
      elapsedMs: 0,
    });

    try {
      let fileIdCounter = 0;
      const itemsToAdd: UploadedPdfItem[] = [];
      for (const file of newFiles) {
        fileIdCounter++;
        const buffer = await file.arrayBuffer();
        itemsToAdd.push({
          id: `file-${fileIdCounter}-${file.name.replace(/[^a-zA-Z0-9]/g, '')}`,
          file,
          name: file.name,
          sizeMB: (file.size / (1024 * 1024)).toFixed(2),
          arrayBuffer: buffer,
        });
      }

      const updatedList = [...uploadedItems, ...itemsToAdd];
      actions.setUploadedItems(updatedList);
      await generateMergedPreview(updatedList);
    } catch (err: any) {
      console.error(err);
      actions.setError('PDF cannot be opened or is corrupted.');
    } finally {
      actions.setProcessing(false);
      actions.setProgress(null);
    }
  };

  const handleLoadSamplePdf = async () => {
    actions.setError(null);
    actions.setProcessing(true);
    actions.setProgress({
      stage: 'INITIALIZING',
      currentPage: 1,
      totalPages: 1,
      percent: 30,
      currentAction: 'Generating sample Physics Wallah class slides...',
      elapsedMs: 0,
    });

    try {
      const sampleBytes = await SamplePdfGenerator.generateSamplePWDoc();
      const pdfBuffer = sampleBytes.buffer as ArrayBuffer;
      const sampleFile = new File([pdfBuffer], 'PW_Sample_Class_Notes.pdf', {
        type: 'application/pdf',
      });
      const sampleItem: UploadedPdfItem = {
        id: 'sample-pw-notes',
        file: sampleFile,
        name: sampleFile.name,
        sizeMB: (sampleFile.size / (1024 * 1024)).toFixed(2),
        arrayBuffer: pdfBuffer,
      };

      const updatedList = [sampleItem];
      actions.setUploadedItems(updatedList);
      await generateMergedPreview(updatedList);
    } catch (err: any) {
      console.error(err);
      actions.setError('Failed to load sample PDF.');
    } finally {
      actions.setProcessing(false);
      actions.setProgress(null);
    }
  };

  const handleMoveItem = async (index: number, direction: 'UP' | 'DOWN') => {
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= uploadedItems.length) return;

    const newList = [...uploadedItems];
    const temp = newList[index];
    newList[index] = newList[targetIdx];
    newList[targetIdx] = temp;

    actions.setUploadedItems(newList);
    await generateMergedPreview(newList);
  };

  const handleRemoveItem = async (index: number) => {
    const newList = uploadedItems.filter((_, i) => i !== index);
    actions.setUploadedItems(newList);
    if (newList.length > 0) {
      await generateMergedPreview(newList);
    } else {
      actions.setMergeResult(null, null, []);
    }
  };

  const generateMergedPreview = async (items: UploadedPdfItem[]) => {
    if (items.length === 0) return;

    try {
      const buffers = items.map((it) => it.arrayBuffer);
      const { pdfBytes, pdfBlob } = await PdfExporter.mergePdfBuffers(buffers);

      const pdfjsLib = await PdfExporter.initPdfJs();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) });
      const pdfDoc = await loadingTask.promise;
      const totalPages = pdfDoc.numPages;

      const thumbnails: string[] = [];
      const renderCount = Math.min(totalPages, 12);

      for (let i = 1; i <= renderCount; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        thumbnails.push(canvas.toDataURL('image/jpeg', 0.6));
      }

      actions.setMergeResult(pdfBlob, pdfBytes, thumbnails);
    } catch (err: any) {
      console.error('Merge preview error:', err);
      actions.setError('Failed to merge uploaded PDF files.');
    }
  };

  const handleDownloadMerged = () => {
    if (!mergedPdfBlob) return;
    const url = URL.createObjectURL(mergedPdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PW_Merged_Notes.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleProceedToPhase2 = useCallback(async () => {
    if (!mergedPdfBytes) return;

    actions.setProcessing(true);
    actions.setError(null);
    const startTime = Date.now();

    const pdfId = `pw_doc_${Date.now()}`;

    try {
      const { processedPages: pages, docProfile: dProf } = await PdfExporter.processPdfStreaming(
        mergedPdfBytes.buffer as ArrayBuffer,
        pdfId,
        masterParams.preset,
        (curr: number, total: number, action: string) => {
          actions.setProgress({
            stage: 'OPTIMIZING',
            currentPage: curr,
            totalPages: total,
            percent: Math.round((curr / total) * 100),
            currentAction: action,
            elapsedMs: Date.now() - startTime,
          });
        },
        selectedEngineVersion
      );

      const phase2Elapsed = Date.now() - startTime;
      actions.setTiming({
        analysisTimeMs: Math.round(phase2Elapsed * 0.15),
        optimizationTimeMs: Math.round(phase2Elapsed * 0.85),
      });

      actions.setDocProfile(dProf);
      actions.setPageProfiles(dProf.pages);
      actions.setProcessedPages(pages);

      actions.setMergeResult(null, null, []);

      actions.setPhase(2);
    } catch (err: any) {
      console.error('Phase 2 optimization error:', err);
      actions.setError('Processing failed due to browser memory limits.');
    } finally {
      actions.setProcessing(false);
      actions.setProgress(null);
    }
  }, [mergedPdfBytes, masterParams.preset, selectedEngineVersion, actions]);

  // -------------------------------------------------------------
  // PHASE 3 HANDLERS: Choose Layout & Generate Print PDF
  // (Defined before Phase 2 toggle handler which references compilePhase3PrintLayout)
  // -------------------------------------------------------------

  const compilePhase3PrintLayout = useCallback(async (
    config: LayoutConfig,
    overrideExcludedPages?: Set<number>
  ) => {
    if (processedPages.length === 0) return;

    memoryManager.revokeAllBlobUrls();

    actions.setProcessing(true);
    actions.setError(null);
    const startTime = Date.now();

    try {
      const activeExcluded = overrideExcludedPages || excludedPages;
      const activePages = processedPages.filter((p) => !activeExcluded.has(p.pageIndex));

      if (activePages.length === 0) {
        alert('Please include at least one page to generate layout.');
        return;
      }

      const { finalPdfBlob, sheetPreviews, metrics } = await PdfExporter.compileSheetsAndExportPdf(
        activePages,
        config,
        (curr: number, total: number, action: string) => {
          actions.setProgress({
            stage: 'BUILDING_GRID',
            currentPage: curr,
            totalPages: total,
            percent: Math.round((curr / total) * 100),
            currentAction: action,
            elapsedMs: Date.now() - startTime,
          });
        }
      );

      const layoutElapsed = Date.now() - startTime;
      actions.setTiming({ layoutTimeMs: layoutElapsed });
      actions.setLayoutResult(finalPdfBlob, sheetPreviews, metrics);
    } catch (err: any) {
      console.error('Phase 3 layout error:', err);
      actions.setError('Failed to generate print layout PDF.');
    } finally {
      actions.setProcessing(false);
      actions.setProgress(null);
    }
  }, [processedPages, excludedPages, actions]);

  const handleSelectLayoutFormat = (format: GridFormat) => {
    const updated = { ...layoutConfig, gridFormat: format };
    actions.setLayoutConfig(updated);
    actions.setLayoutDirty(true);
  };

  const handleToggleOrientation = () => {
    const nextOrient = layoutConfig.orientation === 'PORTRAIT' ? 'LANDSCAPE' : 'PORTRAIT';
    const updated = { ...layoutConfig, orientation: nextOrient as 'PORTRAIT' | 'LANDSCAPE' };
    actions.setLayoutConfig(updated);
    actions.setLayoutDirty(true);
  };

  const handleToggleBorders = () => {
    const updated = { ...layoutConfig, showSlideBorders: !layoutConfig.showSlideBorders };
    actions.setLayoutConfig(updated);
    actions.setLayoutDirty(true);
  };

  const handleTogglePageNumbers = () => {
    const updated = { ...layoutConfig, showPageNumbers: !layoutConfig.showPageNumbers };
    actions.setLayoutConfig(updated);
    actions.setLayoutDirty(true);
  };

  const handleUpdateOuterMargins = (outerMargins: OuterMarginConfig) => {
    const updated = { ...layoutConfig, outerMarginMm: outerMargins };
    actions.setLayoutConfig(updated);
    actions.setLayoutDirty(true);
  };

  const handleUpdateInnerMargin = (innerMarginMm: number) => {
    const updated = { ...layoutConfig, innerMarginMm };
    actions.setLayoutConfig(updated);
    actions.setLayoutDirty(true);
  };

  const handleApplyLayout = useCallback(async () => {
    if (!layoutDirty) return;
    await compilePhase3PrintLayout(layoutConfig);
    actions.setLayoutDirty(false);
  }, [layoutDirty, layoutConfig, compilePhase3PrintLayout, actions]);

  const handleDownloadFinalPrintPdf = () => {
    if (!finalPrintPdfBlob) return;
    const url = URL.createObjectURL(finalPrintPdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PW_Print_Ready_Notes.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleProceedToPhase4 = () => {
    pwOptimizerStorage.clearCache();
    memoryManager.revokeAllBlobUrls();
    actions.setPhase(4);
  };

  // -------------------------------------------------------------
  // PHASE 2 HANDLERS: Optimize Preview, Exclude Pages
  // -------------------------------------------------------------

  const handleToggleExcludePage = useCallback((pageIdx: number) => {
    const next = new Set(excludedPages);
    if (next.has(pageIdx)) {
      next.delete(pageIdx);
    } else {
      next.add(pageIdx);
    }
    actions.setExcludedPages(next);

    if (currentPhase === 3 && processedPages.length > 0) {
      const activePages = processedPages.filter((p) => !next.has(p.pageIndex));
      if (activePages.length > 0) {
        setTimeout(() => {
          compilePhase3PrintLayout(layoutConfig, next);
        }, 0);
      }
    }
  }, [excludedPages, currentPhase, processedPages, layoutConfig, compilePhase3PrintLayout, actions]);

  const handleDownloadOptimized1Up = useCallback(async () => {
    let blob = optimized1UpBlob;
    if (!blob) {
      actions.setProcessing(true);
      try {
        blob = await PdfExporter.export1UpOptimizedPdf(processedPages);
        actions.setOptimized1UpBlob(blob);
      } catch (err) {
        console.error('1-up export failed:', err);
        actions.setProcessing(false);
        return;
      }
      actions.setProcessing(false);
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PW_Optimized_1Up.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }, [optimized1UpBlob, processedPages, actions]);

  const handleProceedToPhase3 = async () => {
    actions.setPhase(3);
  };

  const handleSendFeedback = async () => {
    actions.setFeedbackSubmitted(true);
    const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL ||
      (window as unknown as Record<string, string>).__NEXT_FEEDBACK_URL ||
      'https://script.google.com/macros/s/AKfycbxQ-ENm_QT9lUD9wwX-GhSc-apEW_myrocrys46zX1Kj28q5xXZ4QCNYHIJk7lB3-DX9w/exec';

    if (feedbackUrl) {
      try {
        await fetch(feedbackUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rating,
            feedback: feedbackText,
            timestamp: new Date().toLocaleString(),
            source: 'Notes Print Optimizer',
          }),
        });
      } catch (err) {
        console.error('Failed to dispatch feedback:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col pb-safe">
      {/* Top Header App Bar */}
      <Header
        currentPhase={currentPhase}
        onReset={handleResetWorkflow}
        onLoadSample={handleLoadSamplePdf}
        onNavigatePhase={(phase) => actions.setPhase(phase)}
        isProcessing={isProcessing}
      />

      {/* Progress & Processing Modal */}
      <ProcessingModal progress={progress} />

      {/* Error Message Bar */}
      {errorMessage && (
        <div className="bg-red-950/90 border-b border-red-800 text-red-200 text-xs py-2.5 px-4 text-center font-medium shadow-md">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* MAIN PHASE CONTENT CONTAINER WITH MODULAR PLATFORM UI ORCHESTRATOR */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-4 sm:px-6 sm:py-6 pb-28 md:pb-8">
        <PlatformUIOrchestrator
          currentPhase={currentPhase}
          setCurrentPhase={(phase) => actions.setPhase(phase)}
          isProcessing={isProcessing}
          progress={progress}
          errorMessage={errorMessage}
          setErrorMessage={(msg) => actions.setError(msg)}
          uploadedItems={uploadedItems}
          mergedPdfBlob={mergedPdfBlob}
          mergedPdfBytes={mergedPdfBytes}
          mergedPageDataUrls={mergedPageDataUrls}
          selectedEngineVersion={selectedEngineVersion}
          setSelectedEngineVersion={(version) => actions.setEngineVersion(version)}
          onFilesUpload={handleFilesUpload}
          onLoadSample={handleLoadSamplePdf}
          onMoveItem={handleMoveItem}
          onRemoveItem={handleRemoveItem}
          onDownloadMerged={handleDownloadMerged}
          onProceedToPhase2={handleProceedToPhase2}
          processedPages={processedPages}
          selectedPageIndex={selectedPageIndex}
          setSelectedPageIndex={(idx) => actions.setSelectedPageIndex(idx)}
          excludedPages={excludedPages}
          docProfile={docProfile}
          onToggleExcludePage={handleToggleExcludePage}
          onToggleExcludeAll={(exclude) => {
            const next = new Set<number>();
            if (exclude) {
              processedPages.forEach((_, idx) => next.add(idx));
            }
            actions.setExcludedPages(next);
          }}
          onDownloadOptimized1Up={handleDownloadOptimized1Up}
          onProceedToPhase3={handleProceedToPhase3}
          layoutDirty={layoutDirty}
          onApplyLayout={handleApplyLayout}
          layoutConfig={layoutConfig}
          finalSheetPreviews={finalSheetPreviews}
          finalMetrics={finalMetrics}
          finalPrintPdfBlob={finalPrintPdfBlob}
          onSelectLayoutFormat={handleSelectLayoutFormat}
          onToggleOrientation={handleToggleOrientation}
          onToggleBorders={handleToggleBorders}
          onTogglePageNumbers={handleTogglePageNumbers}
          onUpdateOuterMargins={handleUpdateOuterMargins}
          onUpdateInnerMargin={handleUpdateInnerMargin}
          onDownloadFinalPrintPdf={handleDownloadFinalPrintPdf}
          onProceedToPhase4={handleProceedToPhase4}
          analysisTimeMs={analysisTimeMs}
          optimizationTimeMs={optimizationTimeMs}
          layoutTimeMs={layoutTimeMs}
          rating={rating}
          setRating={(r) => actions.setRating(r)}
          feedbackText={feedbackText}
          setFeedbackText={(t) => actions.setFeedbackText(t)}
          feedbackSubmitted={feedbackSubmitted}
          onSendFeedback={handleSendFeedback}
          onResetWorkflow={handleResetWorkflow}
        />
      </main>
    </div>
  );
}
