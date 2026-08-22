'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { MAX_FILE_SIZE_MB, MAX_TOTAL_SIZE_MB } from '@/lib/services/UploadService';
import { PdfDropzone } from '@/components/ui/PdfDropzone';

interface UploadAreaProps {
  onFilesUpload: (files: File[]) => void;
  isProcessing: boolean;
}

/** Dark-Notes→Print upload screen. Thin wrapper over the shared PdfDropzone. */
export const UploadArea: React.FC<UploadAreaProps> = ({ onFilesUpload }) => (
  <PdfDropzone
    title="Upload Class Note PDFs"
    description="Tap to choose PDFs from your phone or drag & drop lecture slides to convert for eco-friendly printing."
    ctaLabel="Select PDF Files"
    ariaLabel="Upload PDF files"
    multiple
    onFiles={onFilesUpload}
    footer={
      <>
        <span className="flex items-center gap-1 font-semibold text-success">
          <ShieldCheck className="h-3.5 w-3.5" />
          100% Private On-Device
        </span>
        <span aria-hidden="true" className="text-ink-faint">•</span>
        <span>Saves 80% Paper &amp; Ink</span>
        <span aria-hidden="true" className="text-ink-faint">•</span>
        <span>Up to {MAX_TOTAL_SIZE_MB} MB total · {MAX_FILE_SIZE_MB} MB each</span>
      </>
    }
  />
);
