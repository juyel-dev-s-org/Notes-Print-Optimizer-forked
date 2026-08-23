'use client';

import React, { useRef, useState } from 'react';
import { AlertCircle, FileUp } from 'lucide-react';
import { MAX_FILE_SIZE_MB, PDF_DROPZONE_ACCEPT, type DropzoneAccept } from '@/lib/services/UploadService';

export interface PdfDropzoneProps {
  title: string;
  description: string;
  ctaLabel?: string;
  ariaLabel?: string;
  multiple?: boolean;
  /** Omit for no file-count cap. */
  maxFiles?: number;
  minHeights?: string;
  /** What this zone accepts — defaults to PDFs for the classic tools. */
  accept?: DropzoneAccept;
  onFiles: (files: File[]) => void;
  footer?: React.ReactNode;
}

interface SkippedSummary {
  count: number;
  list: string;
}

function formatSkipped(skipped: string[]): SkippedSummary | null {
  if (skipped.length === 0) return null;
  return {
    count: skipped.length,
    list: skipped.slice(0, 3).join(', ') + (skipped.length > 3 ? ` +${skipped.length - 3} more` : ''),
  };
}

/** The one upload zone — drag/drop/tap/keyboard, shared PDF validation.
 *  Replaces the cloned UploadArea + EnhanceUploadView cores. */
export const PdfDropzone: React.FC<PdfDropzoneProps> = ({
  title,
  description,
  ctaLabel = 'Select PDF Files',
  ariaLabel = 'Upload PDF files',
  multiple = true,
  maxFiles,
  minHeights = 'min-h-[240px] lg:min-h-[280px]',
  accept = PDF_DROPZONE_ACCEPT,
  onFiles,
  footer,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFileList = async (filesList: FileList | File[]) => {
    setUploadError(null);
    const files = Array.from(filesList as FileList);
    const { validFiles, skipped, error } = await accept.validate(files, maxFiles ?? Number.MAX_SAFE_INTEGER);

    if (error) {
      setUploadError(error);
      return;
    }

    if (validFiles.length > 0) {
      onFiles(validFiles);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }

    const summary = formatSkipped(skipped);
    if (summary) {
      setUploadError(
        `Skipped ${summary.count} file(s): ${summary.list} — only supported ${accept.noun} up to ${MAX_FILE_SIZE_MB} MB are accepted.`,
      );
    } else if (validFiles.length === 0) {
      setUploadError(`No supported ${accept.noun} found — up to ${MAX_FILE_SIZE_MB} MB each.`);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files.length > 0) void processFileList(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-6 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft ${minHeights} ${
          isDragging
            ? 'border-solid border-primary bg-primary-faint/40'
            : 'border-elevated bg-surface/90 shadow-lg hover:border-primary/70 hover:bg-surface-2/80'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept.input}
          multiple={multiple}
          aria-label={ariaLabel}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) void processFileList(e.target.files);
          }}
          className="hidden"
        />

        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/25 to-accent/15 text-primary-soft shadow-lg transition-all duration-200 group-hover:scale-105 group-hover:text-ink">
          <FileUp className="h-8 w-8" />
        </div>

        <div className="relative mt-4 flex flex-col items-center gap-1.5">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <p className="max-w-sm text-xs leading-relaxed text-ink-muted lg:max-w-md lg:text-sm">{description}</p>
        </div>

        {/* Real button (not a decorative span) — stops click bubbling to the zone */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="relative mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary-strong px-6 text-sm font-bold text-white shadow-md transition-all duration-150 hover:bg-primary active:scale-[0.98]"
        >
          {ctaLabel}
        </button>

        {footer && (
          <div className="relative mt-6 flex flex-wrap items-center justify-center gap-2.5 border-t border-surface-2 pt-4 text-xs text-ink-muted">
            {footer}
          </div>
        )}
      </div>

      {uploadError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-800/70 bg-red-950/60 px-4 py-3 text-xs text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <span>{uploadError}</span>
        </div>
      )}
    </div>
  );
};