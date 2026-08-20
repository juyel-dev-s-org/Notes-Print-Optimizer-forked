'use client';

import React, { useRef, useState } from 'react';
import { FileUp, ShieldCheck, Upload, AlertCircle } from 'lucide-react';
import { isLikelyPdfFile, MAX_FILE_SIZE_MB, MAX_TOTAL_SIZE_MB } from '@/lib/services/UploadService';
import type { EnhanceWorkflow } from '@/lib/enhance/useEnhanceWorkflow';

const MAX_FILES = 10;

export const EnhanceUploadView: React.FC<{ workflow: EnhanceWorkflow }> = ({ workflow }) => {
  const { handleUpload } = workflow;
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFileList = async (filesList: FileList | File[]) => {
    setUploadError(null);
    const validFiles: File[] = [];
    const skipped: string[] = [];
    let totalSize = 0;

    for (let i = 0; i < Math.min(filesList.length, MAX_FILES); i++) {
      const file = filesList[i];
      totalSize += file.size;
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        skipped.push(`${file.name} (over ${MAX_FILE_SIZE_MB} MB)`);
        continue;
      }
      const looksLikePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isPdf = looksLikePdf && (await isLikelyPdfFile(file));
      if (!isPdf) {
        skipped.push(file.name);
        continue;
      }
      validFiles.push(file);
    }

    if (totalSize > MAX_TOTAL_SIZE_MB * 1024 * 1024) {
      setUploadError(`Combined size exceeds the ${MAX_TOTAL_SIZE_MB} MB limit. Please upload fewer or smaller files.`);
      return;
    }

    if (validFiles.length > 0) {
      handleUpload(validFiles);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    if (skipped.length > 0) {
      const list = skipped.slice(0, 3).join(', ') + (skipped.length > 3 ? ` +${skipped.length - 3} more` : '');
      setUploadError(`Skipped ${skipped.length} file(s): ${list} — only valid PDFs up to ${MAX_FILE_SIZE_MB} MB are accepted.`);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload PDF files to enhance"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) processFileList(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex min-h-[260px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-6 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818cf8] ${
          isDragging
            ? 'border-[#5B35FF] bg-[#5B35FF]/10 scale-[1.01] border-solid'
            : 'border-slate-700 bg-slate-900/90 hover:border-[#5B35FF]/70 hover:bg-slate-800/80 shadow-lg'
        }`}
      >
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute left-1/2 top-6 h-40 w-40 -translate-x-1/2 rounded-full bg-[#5B35FF]/15 blur-3xl transition-opacity duration-300 ${
            isDragging ? 'opacity-100' : 'opacity-60'
          }`}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          aria-label="Upload PDF files"
          onChange={(e) => { if (e.target.files?.length) processFileList(e.target.files); }}
          className="hidden"
        />

        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#243BFF]/40 to-[#A12CFF]/30 text-white border border-[#5B35FF]/50 shadow-lg shadow-[#5B35FF]/20">
          <FileUp className="h-8 w-8" />
        </div>

        <div className="relative mt-4 flex flex-col items-center gap-1.5">
          <h2 className="text-base font-bold text-white">Upload Faint PDFs</h2>
          <p className="max-w-sm text-xs leading-relaxed text-slate-400">
            Tap to choose scanned or photographed notes — light ink, gray paper and camera shadows get fixed for print.
          </p>
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          className="relative mt-5 flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#243BFF] via-[#5B35FF] to-[#A12CFF] px-5 text-sm font-bold text-white shadow-md shadow-[#5B35FF]/25 transition-transform duration-150 active:scale-[0.98]"
        >
          <Upload className="h-4 w-4" />
          <span>Select PDF Files</span>
        </button>

        <div className="relative mt-6 flex flex-wrap items-center justify-center gap-2.5 border-t border-slate-800 pt-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1 font-semibold text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            100% Private On-Device
          </span>
          <span className="text-slate-600">•</span>
          <span>Up to {MAX_FILES} PDFs · {MAX_FILE_SIZE_MB} MB each</span>
        </div>
      </div>

      {uploadError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-800/70 bg-red-950/60 px-4 py-3 text-xs text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <span>{uploadError}</span>
        </div>
      )}
    </div>
  );
};