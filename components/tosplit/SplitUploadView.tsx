'use client';

import React from 'react';
import { MAX_FILE_SIZE_MB } from '@/lib/services/UploadService';
import { PdfDropzone } from '@/components/ui/PdfDropzone';
import { HowItWorks } from '@/components/ui/HowItWorks';
import type { SplitWorkflow } from '@/lib/tosplit/useSplitWorkflow';

/** Split PDF upload screen — single file dropzone + shared how-it-works. */
export const SplitUploadView: React.FC<{ workflow: SplitWorkflow }> = ({ workflow }) => (
  <div className="flex flex-col gap-4">
    <PdfDropzone
      title="Upload a PDF to Split"
      description="Pull out one page range into its own file, or burst the whole document into fixed-size parts."
      ctaLabel="Choose PDF File"
      ariaLabel="Upload a PDF file to split"
      maxFiles={1}
      minHeights="min-h-[240px]"
      onFiles={(files) => workflow.handleUpload(files)}
      footer={
        <>
          <span>Single PDF · {MAX_FILE_SIZE_MB} MB max</span>
          <span aria-hidden="true" className="text-ink-faint">•</span>
          <span>Range or burst mode</span>
        </>
      }
    />

    <HowItWorks
      steps={[
        {
          title: 'Select a PDF file',
          description: 'Choose the document you want to cut — nothing is uploaded anywhere.',
        },
        {
          title: 'Pick a split mode',
          description: 'Extract one page range into a new PDF, or burst every N pages into separate files.',
        },
        {
          title: 'Download results',
          description: 'Name your output, save it directly or grab every part inside one ZIP.',
        },
      ]}
      privacyNote="On-device splitting — pages are cut locally on your hardware. No network transmission."
    />
  </div>
);
