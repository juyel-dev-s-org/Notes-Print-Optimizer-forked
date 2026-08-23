'use client';

import { useCallback } from 'react';
import { ExportService } from '../../services/ExportService';
import { EnhanceHandoffService, type HandoffPageInput } from '../../services/EnhanceHandoffService';
import { sanitizeBaseName } from '../../shared/filename';
import { pwOptimizerStorage } from '../../optimizer/storage';
import { memoryManager } from '../../optimizer/memoryManager';
import { sendFeedbackToGas } from '../../feedback/gasClient';
import type { ProcessedPage } from '../../optimizer/types';
import type { WorkflowActions } from '../useWorkflow';
import type { WithProcessingFn } from './useWorkflowRuntime';

interface SessionFlowParams {
  actions: WorkflowActions;
  abortRef: React.MutableRefObject<AbortController | null>;
  revokePreviewAssets: () => void;
  clearProgressiveThumbnails: () => void;
  withProcessing: WithProcessingFn;
  finalPrintPdfBlob: Blob | null;
  optimized1UpBlob: Blob | null;
  processedPages: ProcessedPage[];
  rating: number;
  feedbackText: string;
}

/**
 * Session lifecycle: cancel/reset, phase transitions, exports and
 * the best-effort feedback submission.
 */
export function useSessionFlow({
  actions,
  abortRef,
  revokePreviewAssets,
  clearProgressiveThumbnails,
  withProcessing,
  finalPrintPdfBlob,
  optimized1UpBlob,
  processedPages,
  rating,
  feedbackText,
}: SessionFlowParams) {
  const handleCancelProcessing = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    actions.setProcessing(false);
    actions.setProgress(null);
    actions.setError(null);
    actions.setPhase(1);
  }, [actions, abortRef]);

  const handleResetWorkflow = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    pwOptimizerStorage.clearCache();
    memoryManager.revokeAllBlobUrls();
    revokePreviewAssets();
    clearProgressiveThumbnails();
    actions.resetWorkflow();
  }, [actions, abortRef, revokePreviewAssets, clearProgressiveThumbnails]);

  /**
   * Enhance tool -> LAYOUT phase handoff. Reset clears the whole page cache,
   * so ordering matters: reset FIRST, then persist the enhanced JPEGs and
   * publish the manifest. No optimizer pass — enhance output is already the
   * final processed imagery and N-Up is pure geometry.
   */
  const handleEnhanceLayoutHandoff = useCallback(async (pages: HandoffPageInput[]) => {
    if (pages.length === 0) return;
    handleResetWorkflow();
    const pdfId = EnhanceHandoffService.buildPdfId();
    await EnhanceHandoffService.persistPages(pages, pdfId);
    actions.setProcessedPages(EnhanceHandoffService.buildProcessedPages(pages, pdfId));
    actions.setPhase(3);
  }, [actions, handleResetWorkflow]);

  const handleDownloadFinalPrintPdf = useCallback((customBase?: string) => {
    if (!finalPrintPdfBlob) return;
    const clean = sanitizeBaseName(customBase ?? '') || 'PW_Print_Ready_Notes';
    ExportService.downloadBlob(finalPrintPdfBlob, `${clean}-PrintReady.pdf`);
  }, [finalPrintPdfBlob]);

  const handleProceedToPhase4 = useCallback(() => {
    pwOptimizerStorage.clearCache();
    memoryManager.revokeAllBlobUrls();
    revokePreviewAssets();
    actions.setPhase(4);
  }, [actions, revokePreviewAssets]);

  const handleDownloadOptimized1Up = useCallback(async () => {
    let blob = optimized1UpBlob;
    if (!blob) {
      await withProcessing(
        async () => {
          blob = await ExportService.exportOptimized1Up(processedPages);
          actions.setOptimized1UpBlob(blob!);
        },
        '1-up export failed.',
        null,
      );
    }
    if (blob) ExportService.downloadBlob(blob, 'PW_Optimized_1Up.pdf');
  }, [optimized1UpBlob, processedPages, actions, withProcessing]);

  const handleProceedToPhase3 = useCallback(() => actions.setPhase(3), [actions]);

  const handleSendFeedback = useCallback(async () => {
    actions.setFeedbackSubmitted(true);
    const url = process.env.NEXT_PUBLIC_FEEDBACK_URL;
    if (!url) return;
    try {
      const text = (feedbackText || '').trim().slice(0, 2000);
      if (!text) return;
      await sendFeedbackToGas(url, {
        version: '1.0',
        provider: 'telegram',
        operations: [
          {
            endpoint: 'sendMessage',
            payload: {
              text: `📮 *Feedback*\n\n${text}\n\n_Note: PDF Print Optimizer_`,
              parse_mode: 'Markdown',
              disable_web_page_preview: true,
            },
          },
        ],
        meta: {
          schemaVersion: '1.0.0',
          appVersion: '1.2.0',
          engineVersion: 'v2.0.0-wasm',
          payloadVersion: '1.0.0',
          timestamp: new Date().toISOString(),
        },
        feedback: {
          rating,
          category: 'General',
          text,
          attachPdfRequested: false,
          includeDiagnostics: false,
        },
      });
    } catch {
      /* feedback is best-effort */
    }
  }, [actions, rating, feedbackText]);

  return {
    handleCancelProcessing,
    handleResetWorkflow,
    handleEnhanceLayoutHandoff,
    handleProceedToPhase3,
    handleProceedToPhase4,
    handleDownloadFinalPrintPdf,
    handleDownloadOptimized1Up,
    handleSendFeedback,
  };
}
