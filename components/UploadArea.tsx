'use client';

import React, { useRef, useState } from 'react';
import { FileUp, Sparkles, ShieldCheck, FileText, Upload, HardDrive, AlertCircle } from 'lucide-react';
import { isLikelyPdfFile, MAX_FILE_SIZE_MB, MAX_TOTAL_SIZE_MB } from '@/lib/services/UploadService';

interface UploadAreaProps {
  onFilesUpload: (files: File[]) => void;
  onLoadSample: () => void;
  isProcessing: boolean;
}

export const UploadArea: React.FC<UploadAreaProps> = ({
  onFilesUpload,
  onLoadSample,
  isProcessing,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFileList = async (filesList: FileList | File[]) => {
    setUploadError(null);
    const validFiles: File[] = [];
    const skipped: string[] = [];
    let totalSize = 0;

    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      totalSize += file.size;
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        skipped.push(`${file.name} (over ${MAX_FILE_SIZE_MB} MB)`);
        continue;
      }
      const looksLikePdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isPdf = looksLikePdf && (await isLikelyPdfFile(file));
      if (!isPdf) {
        skipped.push(file.name);
        continue;
      }
      validFiles.push(file);
    }

    if (totalSize > MAX_TOTAL_SIZE_MB * 1024 * 1024) {
      setUploadError(
        `Combined size exceeds the ${MAX_TOTAL_SIZE_MB} MB limit. Please upload fewer or smaller files.`
      );
      return;
    }

    if (validFiles.length > 0) {
      onFilesUpload(validFiles);
      fileInputRef.current && (fileInputRef.current.value = '');
    }
    if (skipped.length > 0) {
      const skippedList = skipped.slice(0, 3).join(', ') + (skipped.length > 3 ? ` +${skipped.length - 3} more` : '');
      setUploadError(`Skipped ${skipped.length} file(s): ${skippedList} — only valid PDFs up to ${MAX_FILE_SIZE_MB} MB are accepted.`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFileList(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFileList(e.target.files);
    }
  };

  const handleDropZoneKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Touch-optimized File Drop & Pick Area */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload PDF files"
        onKeyDown={handleDropZoneKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative flex min-h-[240px] lg:min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-2xl lg:rounded-[20px] border-2 border-dashed p-6 lg:p-10 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
          isDragging
            ? 'border-indigo-500 bg-indigo-950/40 scale-[1.01]'
            : 'border-slate-700 bg-slate-900/90 hover:border-indigo-500 hover:bg-slate-800/80 shadow-lg lg:shadow-xl lg:hover:shadow-indigo-500/10'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          aria-label="Upload PDF files"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex h-16 w-16 lg:h-20 lg:w-20 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-md">
          <FileUp className="h-8 w-8 lg:h-10 lg:w-10" />
        </div>

        <div className="mt-4 lg:mt-6 flex flex-col items-center gap-1.5">
          <h2 className="text-base font-bold text-white sm:text-lg lg:text-2xl">
            Upload Class Note PDFs
          </h2>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed lg:max-w-md lg:text-sm">
            Tap to choose PDFs from your phone or drag & drop lecture slides to convert for eco-friendly printing.
          </p>
        </div>

        {/* Action Buttons with Large Touch Area (min 48px height) */}
        <div className="mt-5 lg:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 lg:gap-4 w-full max-w-xs lg:max-w-md">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="w-full flex h-12 items-center justify-center gap-2 rounded-xl lg:rounded-[14px] bg-indigo-600 px-5 lg:px-6 text-sm font-bold text-white shadow-md hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/25 active:scale-98 transition-all duration-150"
          >
            <Upload className="h-4 w-4" />
            <span>Select PDF Files</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLoadSample();
            }}
            disabled={isProcessing}
            className="w-full flex h-12 items-center justify-center gap-2 rounded-xl lg:rounded-[14px] border border-indigo-500/40 bg-indigo-950/50 px-4 lg:px-6 text-sm font-bold text-indigo-300 hover:bg-indigo-900/60 active:scale-98 transition-all duration-150 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span>Try Demo PDF</span>
          </button>
        </div>

        {/* Feature Pills */}
        <div className="mt-6 lg:mt-8 flex flex-wrap items-center justify-center gap-2.5 pt-4 border-t border-slate-800 text-[11px] text-slate-400">
          <span className="flex items-center gap-1 font-semibold text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            100% Private On-Device
          </span>
          <span className="text-slate-600">•</span>
          <span>Saves 80% Paper & Ink</span>
          <span className="text-slate-600">•</span>
          <span>Instant Auto-Whitening</span>
        </div>
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


