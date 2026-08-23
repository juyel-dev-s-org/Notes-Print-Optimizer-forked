'use client';

import React from 'react';
import { MAX_FILE_SIZE_MB } from '@/lib/services/UploadService';
import { PdfDropzone } from '@/components/ui/PdfDropzone';
import { HowItWorks } from '@/components/ui/HowItWorks';
import type { ImagePdfWorkflow } from '@/lib/img2pdf/useImagePdfWorkflow';

/** Image to PDF upload screen — multi-image dropzone + shared how-it-works. */
export const ImagePdfUploadView: React.FC<{ workflow: ImagePdfWorkflow }> = ({ workflow }) => (
  <div className="flex flex-col gap-4">
    <PdfDropzone
      title="Upload Images"
      description="Photos of notes, whiteboards or handouts — combine them into one clean, shareable PDF in your chosen order."
      ctaLabel="Select Images"
      ariaLabel="Upload images to convert into a PDF"
      multiple
      maxFiles={workflow.maxFiles}
      minHeights="min-h-[240px]"
      onFiles={(files) => workflow.handleUpload(files)}
      footer={
        <>
          <span>Up to {workflow.maxFiles} images · {MAX_FILE_SIZE_MB} MB each</span>
          <span aria-hidden="true" className="text-ink-faint">•</span>
          <span>JPG · PNG · WebP</span>
        </>
      }
    />

    <HowItWorks
      steps={[
        {
          title: 'Select your images',
          description: `Pick photos or screenshots — up to ${workflow.maxFiles} — in any order.`,
        },
        {
          title: 'Arrange & choose page size',
          description: 'Drag them into reading order, then keep each page fitted to its image or use A4.',
        },
        {
          title: 'Create & download',
          description: 'One tidy PDF comes out with a filename you choose — ready to share.',
        },
      ]}
      privacyNote="On-device conversion — images are embedded locally on your hardware. No network transmission."
    />
  </div>
);
