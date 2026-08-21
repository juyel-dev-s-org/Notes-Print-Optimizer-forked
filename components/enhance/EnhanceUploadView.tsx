'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { MAX_FILE_SIZE_MB } from '@/lib/services/UploadService';
import { PdfDropzone } from '@/components/ui/PdfDropzone';
import type { EnhanceWorkflow } from '@/lib/enhance/useEnhanceWorkflow';

const MAX_FILES = 10;

/** Enhance Light PDF upload screen. Thin wrapper over the shared PdfDropzone. */
export const EnhanceUploadView: React.FC<{ workflow: EnhanceWorkflow }> = ({ workflow }) => (
  <PdfDropzone
    title="Upload Faint PDFs"
    description="Tap to choose scanned or photographed notes — light ink, gray paper and camera shadows get fixed for print."
    ctaLabel="Select PDF Files"
    ariaLabel="Upload PDF files to enhance"
    multiple
    maxFiles={MAX_FILES}
    minHeights="min-h-[260px]"
    onFiles={(files) => workflow.handleUpload(files)}
    footer={
      <>
        <span className="flex items-center gap-1 font-semibold text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          100% Private On-Device
        </span>
        <span aria-hidden="true" className="text-slate-600">•</span>
        <span>Up to {MAX_FILES} PDFs · {MAX_FILE_SIZE_MB} MB each</span>
      </>
    }
  />
);
