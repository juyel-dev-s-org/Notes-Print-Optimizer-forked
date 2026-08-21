'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Modal } from './Modal';
import { initialLayoutConfig } from '@/lib/workflow/workflowReducer';
import { CardSkeleton } from '@/components/shared/LoadingSkeleton';

// Lazy-load the existing feedback form so it stays out of the initial bundle.
const FeedbackSection = dynamic(
  () => import('@/components/FeedbackSection').then((m) => m.FeedbackSection),
  { loading: () => <CardSkeleton /> }
);

interface FeedbackModalProps {
  onClose: () => void;
}

/**
 * Opens the existing FeedbackSection inside a modal so it is reachable from the
 * menu at any time (not only after processing). Safe defaults are supplied for
 * the workflow stats; the component treats them as "no job yet".
 */
export const FeedbackModal: React.FC<FeedbackModalProps> = ({ onClose }) => {
  return (
    <Modal title="Send Feedback" subtitle="Ratings, bugs and feature requests" onClose={onClose}>
      <FeedbackSection
        currentPhase={4}
        uploadedItemsCount={0}
        uploadedFileNames={[]}
        totalInputPages={0}
        totalOutputPages={0}
        excludedPagesCount={0}
        totalOriginalSizeMB={0}
        finalMetrics={null}
        layoutConfig={initialLayoutConfig}
        finalPrintPdfBlob={null}
      />
    </Modal>
  );
};
