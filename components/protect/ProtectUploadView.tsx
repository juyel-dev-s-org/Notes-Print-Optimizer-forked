'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { MAX_FILE_SIZE_MB } from '@/lib/services/UploadService';
import { PdfDropzone } from '@/components/ui/PdfDropzone';
import type { ProtectWorkflow } from '@/lib/protect/useProtectWorkflow';

/** Protect PDF upload screen — single file, reuses the shared dropzone. */
export const ProtectUploadView: React.FC<{ workflow: ProtectWorkflow }> = ({ workflow }) => (
  <PdfDropzone
    title="Upload PDF to Protect"
    description="Add AES-256 encryption, an open password, or lock printing, copying and editing — all on this device."
    ctaLabel="Select a PDF File"
    ariaLabel="Upload a PDF file to protect"
    maxFiles={1}
    minHeights="min-h-[260px]"
    onFiles={(files) => workflow.handleUpload(files)}
    footer={
      <>
        <span className="flex items-center gap-1 font-semibold text-success">
          <ShieldCheck className="h-3.5 w-3.5" />
          100% Private On-Device
        </span>
        <span aria-hidden="true" className="text-ink-faint">•</span>
        <span>Single PDF · {MAX_FILE_SIZE_MB} MB max</span>
      </>
    }
  />
);
