'use client';

import { useCallback } from 'react';
import { UploadService, type UploadedItem } from '../../services/UploadService';
import { planSmartOrder } from '../../rearrange';
import { ExportService } from '../../services/ExportService';
import { memoryManager } from '../../optimizer/memoryManager';
import type { WorkflowActions } from '../useWorkflow';
import type { WithProcessingFn } from './useWorkflowRuntime';

interface FileQueueParams {
  uploadedItems: UploadedItem[];
  mergedPdfBlob: Blob | null;
  mergedPageDataUrls: string[];
  actions: WorkflowActions;
  withProcessing: WithProcessingFn;
  clearProgressiveThumbnails: () => void;
}

/**
 * Phase-1 file domain: reading uploads, smart ordering, sequence
 * manipulation and merged-PDF preview generation.
 */
export function useFileQueue({
  uploadedItems,
  mergedPdfBlob,
  mergedPageDataUrls,
  actions,
  withProcessing,
  clearProgressiveThumbnails,
}: FileQueueParams) {
  const generateMergedPreview = useCallback(
    async (items: UploadedItem[]) => {
      // Revoke previous thumbnails to prevent orphaned blob URLs
      if (mergedPageDataUrls.length > 0) {
        mergedPageDataUrls.forEach((url: string) => {
          try {
            memoryManager.revokeBlobUrl(url);
          } catch {}
        });
      }
      if (items.length === 0) {
        actions.setMergeResult(null, null, []);
        clearProgressiveThumbnails();
        return;
      }
      const result = await UploadService.mergeAndPreview(items);
      if (result) actions.setMergeResult(result.pdfBlob, result.pdfBytes, result.thumbnails);
    },
    [actions, mergedPageDataUrls, clearProgressiveThumbnails],
  );

  const handleFilesUpload = useCallback(
    async (newFiles: File[]) => {
      await withProcessing(async () => {
        const items = await UploadService.readFiles(newFiles);
        const combined = [...uploadedItems, ...items];
        // Smart PDF rearrangement: auto-detect related series ("Calculus 1..13
        // Class Notes") and natural-sort them as files arrive. The rule engine
        // returns the untouched order when no confident pattern is found, so
        // this is a no-op for unrelated uploads.
        const smartPlan = planSmartOrder(combined);
        const updatedList = smartPlan.changed ? smartPlan.orderedItems : combined;
        actions.setUploadedItems(updatedList);
        await generateMergedPreview(updatedList);
      }, 'PDF cannot be opened or is corrupted.', {
        stage: 'INITIALIZING',
        currentPage: 0,
        totalPages: newFiles.length,
        percent: 20,
        currentAction: 'Reading PDF files...',
        elapsedMs: 0,
      } as never);
    },
    [uploadedItems, actions, withProcessing, generateMergedPreview],
  );

  const handleMoveItem = useCallback(
    async (index: number, direction: 'UP' | 'DOWN') => {
      const targetIdx = direction === 'UP' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= uploadedItems.length) return;
      const newList = [...uploadedItems];
      [newList[index], newList[targetIdx]] = [newList[targetIdx], newList[index]];
      actions.setUploadedItems(newList);
      await generateMergedPreview(newList);
    },
    [uploadedItems, actions, generateMergedPreview],
  );

  /**
   * Smart PDF Rearrangement - one-click rule-based ordering.
   * Detects related series ("Basic Maths and Calculus 1..13 Class Notes")
   * and natural-sorts them; standalone files keep their relative order.
   */
  const handleSmartArrange = useCallback(async () => {
    if (uploadedItems.length < 2) return;
    const plan = planSmartOrder(uploadedItems);
    if (!plan.changed) return;
    actions.setUploadedItems(plan.orderedItems);
    await generateMergedPreview(plan.orderedItems);
  }, [uploadedItems, actions, generateMergedPreview]);

  /** Drag & drop reorder: move item at fromIndex into position toIndex. */
  const handleReorderItem = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      if (fromIndex < 0 || fromIndex >= uploadedItems.length) return;
      if (toIndex < 0 || toIndex >= uploadedItems.length) return;
      const newList = [...uploadedItems];
      const [moved] = newList.splice(fromIndex, 1);
      newList.splice(toIndex, 0, moved);
      actions.setUploadedItems(newList);
      await generateMergedPreview(newList);
    },
    [uploadedItems, actions, generateMergedPreview],
  );

  const handleRemoveItem = useCallback(
    async (index: number) => {
      const newList = uploadedItems.filter((_, i) => i !== index);
      actions.setUploadedItems(newList);
      await generateMergedPreview(newList);
    },
    [uploadedItems, actions, generateMergedPreview],
  );

  const handleDownloadMerged = useCallback(() => {
    if (!mergedPdfBlob) return;
    ExportService.downloadBlob(mergedPdfBlob, 'PW_Merged_Notes.pdf');
  }, [mergedPdfBlob]);

  return {
    handleFilesUpload,
    handleMoveItem,
    handleRemoveItem,
    handleDownloadMerged,
    handleSmartArrange,
    handleReorderItem,
  };
}
