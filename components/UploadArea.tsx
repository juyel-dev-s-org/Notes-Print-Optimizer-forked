'use client';

import React, { useRef, useState } from 'react';
import { FileUp, Sparkles, ShieldCheck, FileText, Upload, HardDrive } from 'lucide-react';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFileList = (filesList: FileList | File[]) => {
    const validFiles: File[] = [];
    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        validFiles.push(file);
      }
    }
    if (validFiles.length > 0) {
      onFilesUpload(validFiles);
    } else {
      alert('Please upload valid PDF files.');
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

  return (
    <div className="flex flex-col gap-4">
      {/* Touch-optimized File Drop & Pick Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative flex min-h-[240px] lg:min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-2xl lg:rounded-[20px] border-2 border-dashed p-6 lg:p-10 text-center transition-all ${
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
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex h-16 w-16 lg:h-20 lg:w-20 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-md">
          <FileUp className="h-8 w-8 lg:h-10 lg:w-10" />
        </div>

        <div className="mt-4 lg:mt-6 flex flex-col items-center gap-1.5">
          <h3 className="text-base font-bold text-white sm:text-lg lg:text-2xl">
            Upload Class Note PDFs
          </h3>
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
    </div>
  );
};


