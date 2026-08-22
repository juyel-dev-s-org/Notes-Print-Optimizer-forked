'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { MAX_FILE_SIZE_MB } from '@/lib/services/UploadService';
import { PdfDropzone } from '@/components/ui/PdfDropzone';
import { MAX_ENHANCE_FILES } from '@/lib/enhance/types';
import type { EnhanceWorkflow } from '@/lib/enhance/useEnhanceWorkflow';

/** Enhance Light PDF upload screen. Thin wrapper over the shared PdfDropzone. */
export const EnhanceUploadView: React.FC<{ workflow: EnhanceWorkflow }> = ({ workflow }) => (
  <PdfDropzone
    title="Upload Faint PDFs"
    description="Tap to choose scanned or photographed notes — light ink, gray paper and camera shadows get fixed for print."
    ctaLabel="Select PDF Files"
    ariaLabel="Upload PDF files to enhance"
    multiple
    maxFiles={MAX_ENHANCE_FILES}
    minHeights="min-h-[260px]"
    onFiles={(files) => workflow.handleUpload(files)}
    footer={
      <>
        <span className="flex items-center gap-1 font-semibold text-success">
          <ShieldCheck className="h-3.5 w-3.5" />
          100% Private On-Device
        </span>
        <span aria-hidden="true" className="text-ink-faint">•</span>
        <span>Up to {MAX_ENHANCE_FILES} PDFs · {MAX_FILE_SIZE_MB} MB each</span>
      </>
    }
  />
);
