'use client';

import React from 'react';
import { Images } from 'lucide-react';
import { MAX_FILE_SIZE_MB } from '@/lib/services/UploadService';
import { PdfDropzone } from '@/components/ui/PdfDropzone';
import { HowItWorks } from '@/components/ui/HowItWorks';
import type { ImagesWorkflow } from '@/lib/toimages/useImagesWorkflow';

/** PDF to Images upload screen — dropzone + shared how-it-works timeline. */
export const ImagesUploadView: React.FC<{ workflow: ImagesWorkflow }> = ({ workflow }) => (
  <div className="flex flex-col gap-4">
    <PdfDropzone
      title="Upload a PDF"
      description="Every sheet becomes a crisp, individually downloadable image — pick your resolution, get one tidy ZIP."
      ctaLabel="Choose PDF File"
      ariaLabel="Upload a PDF file to convert to images"
      maxFiles={1}
      minHeights="min-h-[240px]"
      onFiles={(files) => workflow.handleUpload(files)}
      footer={
        <>
          <span>Single PDF · {MAX_FILE_SIZE_MB} MB max</span>
          <span aria-hidden="true" className="text-ink-faint">•</span>
          <span>JPG · PNG · WebP</span>
        </>
      }
    />

    <HowItWorks
      steps={[
        {
          title: 'Select a PDF file',
          description: 'Choose the document from your device that you want to convert into images.',
        },
        {
          title: 'Select resolution',
          description: 'Pick Low (72 DPI), Balanced (150 DPI) or High (300 DPI), then choose JPG, PNG or WebP.',
        },
        {
          title: 'Convert & share',
          description: 'Preview every page, download images individually or export everything as one ZIP.',
        },
      ]}
      privacyNote="On-device image extraction — pages are rendered locally on your hardware. No network transmission."
    />
  </div>
);
