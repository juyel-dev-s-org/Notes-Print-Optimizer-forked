'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Header, WorkflowPhase } from '@/components/Header';
import { ProcessingModal } from '@/components/ProcessingModal';
import { PlatformUIOrchestrator } from '@/components/views/PlatformUIOrchestrator';

import { SamplePdfGenerator } from '@/lib/optimizer/samplePdfGenerator';
import { ParameterGenerator } from '@/lib/optimizer/parameterGenerator';
import { LayoutEngine } from '@/lib/optimizer/layoutEngine';
import { PdfExporter } from '@/lib/optimizer/pdfExporter';
import { pwOptimizerStorage } from '@/lib/optimizer/storage';
import { memoryManager } from '@/lib/optimizer/memoryManager';
import { EngineVersion } from '@/lib/optimizer/engine';

import {
  DocumentProfile,
  GridFormat,
  LayoutConfig,
  OptimizationMetrics,
  OuterMarginConfig,
  PageProfile,
  ProcessedPage,
  ProcessingParameters,
  ProcessingProgress,
} from '@/lib/optimizer/types';

interface UploadedPdfItem {
  id: string;
  file: File;
  name: string;
  sizeMB: string;
  arrayBuffer: ArrayBuffer;
}

export default function HomePage() {
  // Navigation Phase State: 1 | 2 | 3 | 4
  const [currentPhase, setCurrentPhase] = useState<WorkflowPhase>(1);

  // General Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- Phase 1 State: Upload & Merge ---
  const [uploadedItems, setUploadedItems] = useState<UploadedPdfItem[]>([]);
  const [mergedPdfBlob, setMergedPdfBlob] = useState<Blob | null>(null);
  const [mergedPdfBytes, setMergedPdfBytes] = useState<Uint8Array | null>(null);
  const [mergedPageDataUrls, setMergedPageDataUrls] = useState<string[]>([]);

  // Raw Page Extract
  const [rawPagesData, setRawPagesData] = useState<ImageData[]>([]);
  const [pageProfiles, setPageProfiles] = useState<PageProfile[]>([]);
  const [docProfile, setDocProfile] = useState<DocumentProfile | null>(null);

  // --- Phase 2 State: Optimize ---
  const [processedPages, setProcessedPages] = useState<ProcessedPage[]>([]);
  const [optimized1UpBlob, setOptimized1UpBlob] = useState<Blob | null>(null);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [excludedPages, setExcludedPages] = useState<Set<number>>(new Set());

  // Master Parameters
  const [selectedEngineVersion, setSelectedEngineVersion] = useState<EngineVersion>('v1');
  const [masterParams] = useState<ProcessingParameters>(
    ParameterGenerator.getPresetParameters('AUTO_ADAPTIVE')
  );

  // --- Phase 3 State: Choose Layout & Generate ---
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>({
    gridFormat: '2x2', // 4-up grid (optimal for PW Notes!)
    paperSize: 'A4',
    orientation: 'PORTRAIT',
    outerMarginMm: {
      top: 2,
      left: 5,
      right: 3,
      bottom: 2,
    },
    innerMarginMm: 1,
    marginMm: 2,
    spacingMm: 1,
    showSlideBorders: false,
    showPageNumbers: false,
    headerTitle: '',
  });

  const [finalPrintPdfBlob, setFinalPrintPdfBlob] = useState<Blob | null>(null);
  const [finalSheetPreviews, setFinalSheetPreviews] = useState<string[]>([]);
  const [finalMetrics, setFinalMetrics] = useState<OptimizationMetrics | null>(null);
  const [layoutDirty, setLayoutDirty] = useState(false);

  // --- Phase 4 State: Done & Feedback ---
  const [rating, setRating] = useState<number>(5);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);

  // Workflow Timing Diagnostics
  const [analysisTimeMs, setAnalysisTimeMs] = useState<number | undefined>(undefined);
  const [optimizationTimeMs, setOptimizationTimeMs] = useState<number | undefined>(undefined);
  const [layoutTimeMs, setLayoutTimeMs] = useState<number | undefined>(undefined);

  // Temporary IndexedDB session cache lifecycle manager
  useEffect(() => {
    // Clear any stale temporary IndexedDB cache on initial app mount
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

    setUploadedItems([]);
    setMergedPdfBlob(null);
    setMergedPdfBytes(null);
    setMergedPageDataUrls([]);

    setRawPagesData([]);
    setPageProfiles([]);
    setDocProfile(null);

    setProcessedPages([]);
    setOptimized1UpBlob(null);
    setSelectedPageIndex(0);
    setExcludedPages(new Set());

    setFinalPrintPdfBlob(null);
    setFinalSheetPreviews([]);
    setFinalMetrics(null);

    setAnalysisTimeMs(undefined);
    setOptimizationTimeMs(undefined);
    setLayoutTimeMs(undefined);

    setFeedbackSubmitted(false);
    setFeedbackText('');
    setErrorMessage(null);

    setCurrentPhase(1);
  }, []);

  // -------------------------------------------------------------
  // PHASE 1 HANDLERS: Upload, Arrange, Merge
  // -------------------------------------------------------------

  // Handle file uploads
  const handleFilesUpload = async (newFiles: File[]) => {
    setErrorMessage(null);
    setIsProcessing(true);
    setProgress({
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
      setUploadedItems(updatedList);
      await generateMergedPreview(updatedList);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('PDF cannot be opened or is corrupted.');
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  // Load sample Physics Wallah PDF
  const handleLoadSamplePdf = async () => {
    setErrorMessage(null);
    setIsProcessing(true);
    setProgress({
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
      setUploadedItems(updatedList);
      await generateMergedPreview(updatedList);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Failed to load sample PDF.');
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  // Reorder or Delete items in Phase 1
  const handleMoveItem = async (index: number, direction: 'UP' | 'DOWN') => {
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= uploadedItems.length) return;

    const newList = [...uploadedItems];
    const temp = newList[index];
    newList[index] = newList[targetIdx];
    newList[targetIdx] = temp;

    setUploadedItems(newList);
    await generateMergedPreview(newList);
  };

  const handleRemoveItem = async (index: number) => {
    const newList = uploadedItems.filter((_, i) => i !== index);
    setUploadedItems(newList);
    if (newList.length > 0) {
      await generateMergedPreview(newList);
    } else {
      setMergedPdfBlob(null);
      setMergedPdfBytes(null);
      setMergedPageDataUrls([]);
    }
  };

  // Generate Merged PDF & Extract Thumbnail Data URLs
  const generateMergedPreview = async (items: UploadedPdfItem[]) => {
    if (items.length === 0) return;

    try {
      const buffers = items.map((it) => it.arrayBuffer);
      const { pdfBytes, pdfBlob } = await PdfExporter.mergePdfBuffers(buffers);
      setMergedPdfBytes(pdfBytes);
      setMergedPdfBlob(pdfBlob);

      // Render low-res preview thumbnails of merged PDF
      const pdfjsLib = await PdfExporter.initPdfJs();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) });
      const pdfDoc = await loadingTask.promise;
      const totalPages = pdfDoc.numPages;

      const thumbnails: string[] = [];
      const renderCount = Math.min(totalPages, 12); // Preview up to 12 pages for fast UI

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

      setMergedPageDataUrls(thumbnails);
    } catch (err: any) {
      console.error('Merge preview error:', err);
      setErrorMessage('Failed to merge uploaded PDF files.');
    }
  };

  // Download Merged PDF
  const handleDownloadMerged = () => {
    if (!mergedPdfBlob) return;
    const url = URL.createObjectURL(mergedPdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PW_Merged_Notes.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Proceed from Phase 1 to Phase 2: Analyze & Optimize
  const handleProceedToPhase2 = useCallback(async () => {
    if (!mergedPdfBytes) return;

    setIsProcessing(true);
    setErrorMessage(null);
    const startTime = Date.now();

    const pdfId = `pw_doc_${Date.now()}`;

    try {
      const { processedPages: pages, docProfile: dProf } = await PdfExporter.processPdfStreaming(
        mergedPdfBytes.buffer as ArrayBuffer,
        pdfId,
        masterParams.preset,
        (curr, total, action) => {
          setProgress({
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
      setAnalysisTimeMs(Math.round(phase2Elapsed * 0.15));
      setOptimizationTimeMs(Math.round(phase2Elapsed * 0.85));

      setDocProfile(dProf);
      setPageProfiles(dProf.pages);
      setProcessedPages(pages);

      // Generate 1-Up optimized PDF blob for optional download (streaming)
      const optBlob = await PdfExporter.export1UpOptimizedPdf(pages);
      setOptimized1UpBlob(optBlob);

      // Release raw merged bytes to keep memory lightweight
      setMergedPdfBytes(null);

      // Transition to Phase 2
      setCurrentPhase(2);
    } catch (err: any) {
      console.error('Phase 2 optimization error:', err);
      setErrorMessage('Processing failed due to browser memory limits.');
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  }, [mergedPdfBytes, masterParams.preset, selectedEngineVersion]);

  // -------------------------------------------------------------
  // PHASE 2 HANDLERS: Optimize Preview, Exclude Pages
  // -------------------------------------------------------------

  const handleToggleExcludePage = (pageIdx: number) => {
    setExcludedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageIdx)) {
        next.delete(pageIdx);
      } else {
        next.add(pageIdx);
      }

      // If already in Phase 3, re-compile layout for remaining pages
      if (currentPhase === 3 && processedPages.length > 0) {
        const activePages = processedPages.filter((p) => !next.has(p.pageIndex));
        if (activePages.length > 0) {
          setTimeout(() => {
            compilePhase3PrintLayout(layoutConfig, next);
          }, 0);
        }
      }

      return next;
    });
  };

  const handleDownloadOptimized1Up = () => {
    if (!optimized1UpBlob) return;
    const url = URL.createObjectURL(optimized1UpBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PW_Optimized_1Up.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Proceed from Phase 2 to Phase 3: Choose Layout
  const handleProceedToPhase3 = async () => {
    setCurrentPhase(3);
  };

  // -------------------------------------------------------------
  // PHASE 3 HANDLERS: Choose Layout & Generate Print PDF
  // -------------------------------------------------------------

  const compilePhase3PrintLayout = useCallback(async (
    config: LayoutConfig,
    overrideExcludedPages?: Set<number>
  ) => {
    if (processedPages.length === 0) return;

    // Revoke previous sheet preview Object URLs before building new ones
    memoryManager.revokeAllBlobUrls();

    setIsProcessing(true);
    setErrorMessage(null);
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
        (curr, total, action) => {
          setProgress({
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
      setLayoutTimeMs(layoutElapsed);

      setFinalSheetPreviews(sheetPreviews);
      setFinalPrintPdfBlob(finalPdfBlob);
      setFinalMetrics(metrics);
    } catch (err: any) {
      console.error('Phase 3 layout error:', err);
      setErrorMessage('Failed to generate print layout PDF.');
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  }, [processedPages, excludedPages]);

  // Handle changing layout settings
  const handleSelectLayoutFormat = (format: GridFormat) => {
    const updated = { ...layoutConfig, gridFormat: format };
    setLayoutConfig(updated);
    setLayoutDirty(true);
  };

  const handleToggleOrientation = () => {
    const nextOrient = layoutConfig.orientation === 'PORTRAIT' ? 'LANDSCAPE' : 'PORTRAIT';
    const updated = { ...layoutConfig, orientation: nextOrient as 'PORTRAIT' | 'LANDSCAPE' };
    setLayoutConfig(updated);
    setLayoutDirty(true);
  };

  const handleToggleBorders = () => {
    const updated = { ...layoutConfig, showSlideBorders: !layoutConfig.showSlideBorders };
    setLayoutConfig(updated);
    setLayoutDirty(true);
  };

  const handleTogglePageNumbers = () => {
    const updated = { ...layoutConfig, showPageNumbers: !layoutConfig.showPageNumbers };
    setLayoutConfig(updated);
    setLayoutDirty(true);
  };

  const handleUpdateOuterMargins = (outerMargins: OuterMarginConfig) => {
    const updated = { ...layoutConfig, outerMarginMm: outerMargins };
    setLayoutConfig(updated);
    setLayoutDirty(true);
  };

  const handleUpdateInnerMargin = (innerMarginMm: number) => {
    const updated = { ...layoutConfig, innerMarginMm };
    setLayoutConfig(updated);
    setLayoutDirty(true);
  };
  // Apply layout: only renders when user explicitly clicks Apply
  const handleApplyLayout = useCallback(async () => {
    if (!layoutDirty) return;
    await compilePhase3PrintLayout(layoutConfig);
    setLayoutDirty(false);
  }, [layoutDirty, layoutConfig, compilePhase3PrintLayout]);


  const handleDownloadFinalPrintPdf = () => {
    if (!finalPrintPdfBlob) return;
    const url = URL.createObjectURL(finalPrintPdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PW_Print_Ready_Notes.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Proceed to Phase 4 (Done)
  const handleProceedToPhase4 = () => {
    pwOptimizerStorage.clearCache();
    memoryManager.revokeAllBlobUrls();
    setCurrentPhase(4);
  };

  // Submit Feedback
  const handleSendFeedback = async () => {
    setFeedbackSubmitted(true);
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
        onNavigatePhase={(phase) => setCurrentPhase(phase)}
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
          setCurrentPhase={setCurrentPhase}
          isProcessing={isProcessing}
          progress={progress}
          errorMessage={errorMessage}
          setErrorMessage={setErrorMessage}
          uploadedItems={uploadedItems}
          mergedPdfBlob={mergedPdfBlob}
          mergedPdfBytes={mergedPdfBytes}
          mergedPageDataUrls={mergedPageDataUrls}
          selectedEngineVersion={selectedEngineVersion}
          setSelectedEngineVersion={setSelectedEngineVersion}
          onFilesUpload={handleFilesUpload}
          onLoadSample={handleLoadSamplePdf}
          onMoveItem={handleMoveItem}
          onRemoveItem={handleRemoveItem}
          onDownloadMerged={handleDownloadMerged}
          onProceedToPhase2={handleProceedToPhase2}
          processedPages={processedPages}
          selectedPageIndex={selectedPageIndex}
          setSelectedPageIndex={setSelectedPageIndex}
          excludedPages={excludedPages}
          docProfile={docProfile}
          onToggleExcludePage={handleToggleExcludePage}
          onToggleExcludeAll={(exclude) => {
            const next = new Set<number>();
            if (exclude) {
              processedPages.forEach((_, idx) => next.add(idx));
            }
            setExcludedPages(next);
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
          setRating={setRating}
          feedbackText={feedbackText}
          setFeedbackText={setFeedbackText}
          feedbackSubmitted={feedbackSubmitted}
          onSendFeedback={handleSendFeedback}
          onResetWorkflow={handleResetWorkflow}
        />
      </main>
    </div>
  );
}
