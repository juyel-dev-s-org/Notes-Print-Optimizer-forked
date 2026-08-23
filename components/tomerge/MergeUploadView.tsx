'use client';

import React from 'react';
import { MAX_FILE_SIZE_MB } from '@/lib/services/UploadService';
import { PdfDropzone } from '@/components/ui/PdfDropzone';
import { HowItWorks } from '@/components/ui/HowItWorks';
import type { MergeWorkflow } from '@/lib/tomerge/useMergeWorkflow';

/** Merge PDFs upload screen — multi-file dropzone + shared how-it-works. */
export const MergeUploadView: React.FC<{ workflow: MergeWorkflow }> = ({ workflow }) => (
  <div className="flex flex-col gap-4">
    <PdfDropzone
      title="Upload PDFs to Merge"
      description="Combine lecture notes, chapters or handouts into one tidy document — arrange the order before merging."
      ctaLabel="Select PDF Files"
      ariaLabel="Upload PDF files to merge"
      multiple
      maxFiles={workflow.maxFiles}
      minHeights="min-h-[240px]"
      onFiles={(files) => workflow.handleUpload(files)}
      footer={
        <>
          <span>Up to {workflow.maxFiles} PDFs · {MAX_FILE_SIZE_MB} MB each</span>
          <span aria-hidden="true" className="text-ink-faint">•</span>
          <span>Order stays editable</span>
        </>
      }
    />

    <HowItWorks
      steps={[
        {
          title: 'Select your PDF files',
          description: `Pick two or more documents — up to ${workflow.maxFiles} — in any order.`,
        },
        {
          title: 'Arrange the order',
          description: 'Drag files, use arrows or tap Smart Arrange to detect natural series ordering.',
        },
        {
          title: 'Merge & download',
          description: 'One combined PDF comes out with a filename you choose — ready to share.',
        },
      ]}
      privacyNote="On-device merging — files are combined locally on your hardware. No network transmission."
    />
  </div>
);
