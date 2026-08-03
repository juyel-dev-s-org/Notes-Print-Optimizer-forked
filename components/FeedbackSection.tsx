'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Code,
  Copy,
  FileText,
  Info,
  Loader2,
  Paperclip,
  Send,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { EngineVersion } from '@/lib/optimizer/engine';
import { LayoutConfig, OptimizationMetrics } from '@/lib/optimizer/types';
import { FeedbackCategory, FeedbackUserInput, PdfStats, ProcessingSettings } from '@/lib/feedback/types';
import { buildFeedbackPayload } from '@/lib/feedback/payloadBuilder';
import { sendFeedbackToGas } from '@/lib/feedback/gasClient';
import { GOOGLE_APPS_SCRIPT_CODE } from '@/lib/feedback/gasScriptTemplate';

interface FeedbackSectionProps {
  currentPhase: number;
  selectedEngineVersion: EngineVersion;
  uploadedItemsCount: number;
  uploadedFileNames: string[];
  uploadedFileSizesMB?: number[];
  mergedPdfSizeMB?: number;
  totalInputPages: number;
  totalOutputPages: number;
  excludedPagesCount: number;
  totalOriginalSizeMB: number;
  finalMetrics: OptimizationMetrics | null;
  layoutConfig: LayoutConfig;
  finalPrintPdfBlob: Blob | null;
  analysisTimeMs?: number;
  optimizationTimeMs?: number;
  layoutTimeMs?: number;
  endpointUrl?: string;
}

export const FeedbackSection: React.FC<FeedbackSectionProps> = ({
  currentPhase,
  selectedEngineVersion,
  uploadedItemsCount,
  uploadedFileNames,
  uploadedFileSizesMB,
  mergedPdfSizeMB,
  totalInputPages,
  totalOutputPages,
  excludedPagesCount,
  totalOriginalSizeMB,
  finalMetrics,
  layoutConfig,
  finalPrintPdfBlob,
  analysisTimeMs,
  optimizationTimeMs,
  layoutTimeMs,
  endpointUrl = 'https://script.google.com/macros/s/AKfycbyYBvhRphdbvTAEI-hktpUWcpYyFjdsOjSHhHwuQyt0K310uqIX3ManTNfQ1Kx7UEtw/exec',
}) => {
  // Form State
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [category, setCategory] = useState<FeedbackCategory>('General');
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [attachPdf, setAttachPdf] = useState<boolean>(false);
  const [includeDiagnostics, setIncludeDiagnostics] = useState<boolean>(true);

  // Status State
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal / Preview State
  const [showDeveloperModal, setShowDeveloperModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'payload' | 'telegram' | 'gas'>('payload');
  const [payloadPreview, setPayloadPreview] = useState<string>('');
  const [telegramPreview, setTelegramPreview] = useState<string>('');
  const [copiedGas, setCopiedGas] = useState<boolean>(false);

  const categories: { id: FeedbackCategory; label: string; icon: string }[] = [
    { id: 'General', label: 'General', icon: '💬' },
    { id: 'Bug', label: 'Bug Report', icon: '🐞' },
    { id: 'Print Quality', label: 'Print Quality', icon: '🖨️' },
    { id: 'Feature Request', label: 'Feature Request', icon: '🚀' },
  ];

  const ratingLabels: Record<number, string> = {
    1: '1/5 Poor',
    2: '2/5 Fair',
    3: '3/5 Good',
    4: '4/5 Very Good',
    5: '5/5 Excellent',
  };

  // Compile PDF Stats
  const getPdfStats = (): PdfStats => ({
    originalFilesCount: uploadedItemsCount || 0,
    originalFileNames: uploadedFileNames || [],
    originalFileSizesMB: uploadedFileSizesMB || [],
    mergedPdfSizeMB,
    totalInputPages: totalInputPages || 0,
    totalOutputPages: totalOutputPages || 0,
    excludedPagesCount: excludedPagesCount || 0,
    originalSizeMB: totalOriginalSizeMB || 0,
    optimizedSizeMB: finalMetrics?.totalOptimizedSizeMB || 0,
    inkSavedPct: finalMetrics?.inkSavedPct || 0,
    processingTimeMs: (analysisTimeMs || 0) + (optimizationTimeMs || 0) + (layoutTimeMs || 0) || finalMetrics?.processingTimeMs || 0,
    analysisTimeMs,
    optimizationTimeMs,
    layoutTimeMs,
  });

  // Compile Processing Settings
  const getProcessingSettings = (): ProcessingSettings => ({
    gridFormat: layoutConfig.gridFormat,
    paperSize: layoutConfig.paperSize,
    orientation: layoutConfig.orientation,
    showBorders: layoutConfig.showSlideBorders,
    showPageNumbers: layoutConfig.showPageNumbers,
  });

  // Handle Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setErrorMessage(null);

    const userInput: FeedbackUserInput = {
      rating,
      category,
      feedbackText,
      attachPdf: attachPdf && !!finalPrintPdfBlob,
      includeDiagnostics,
    };

    try {
      const payload = await buildFeedbackPayload(
        userInput,
        currentPhase,
        selectedEngineVersion,
        getPdfStats(),
        getProcessingSettings(),
        finalPrintPdfBlob
      );

      const targetUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL || endpointUrl;
      const result = await sendFeedbackToGas(targetUrl, payload);

      if (result.success) {
        setIsSubmitted(true);
      } else {
        setErrorMessage(result.error || 'Failed to send feedback.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsSending(false);
    }
  };

  // Generate Live Previews for Developer Modal
  const handleOpenPreviewModal = async () => {
    const userInput: FeedbackUserInput = {
      rating,
      category,
      feedbackText,
      attachPdf: attachPdf && !!finalPrintPdfBlob,
      includeDiagnostics,
    };

    const payload = await buildFeedbackPayload(
      userInput,
      currentPhase,
      selectedEngineVersion,
      getPdfStats(),
      getProcessingSettings(),
      finalPrintPdfBlob
    );

    // Omit heavy base64 string from raw JSON preview display for speed
    const previewObject = JSON.parse(JSON.stringify(payload));
    if (previewObject.operations && Array.isArray(previewObject.operations)) {
      previewObject.operations.forEach((op: { endpoint: string; payload?: Record<string, unknown> }) => {
        if (op.payload && op.payload.base64File && typeof op.payload.base64File === 'object') {
          const fileObj = op.payload.base64File as { sizeBytes?: number; base64Data?: string };
          if (fileObj.base64Data) {
            fileObj.base64Data = `[BASE64_ENCODED_PDF_DATA_TRUNCATED_FOR_PREVIEW ~${((fileObj.sizeBytes || 0) / 1024).toFixed(0)} KB]`;
          }
        }
      });
    }

    setPayloadPreview(JSON.stringify(previewObject, null, 2));
    const sendMessageOp = payload.operations.find((op) => op.endpoint === 'sendMessage');
    setTelegramPreview(sendMessageOp ? String(sendMessageOp.payload.text || '') : 'No sendMessage text operation found');
    setShowDeveloperModal(true);
  };

  const handleCopyGasCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedGas(true);
    setTimeout(() => setCopiedGas(false), 2500);
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl w-full text-left">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
          <h3 className="text-sm font-bold text-white">Rate Your Experience & Feedback</h3>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Privacy-First</span>
        </div>
      </div>

      {!isSubmitted ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Star Rating Bar */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Overall Rating</label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="p-1 text-amber-400 transition-transform hover:scale-110 cursor-pointer"
                  >
                    <Star
                      className={`h-7 w-7 transition-colors ${
                        star <= (hoverRating || rating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-700'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <span className="text-xs font-bold text-amber-400 bg-amber-950/50 border border-amber-500/30 px-2.5 py-1 rounded-md">
                {ratingLabels[hoverRating || rating]}
              </span>
            </div>
          </div>

          {/* Feedback Category Pills */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                    category === cat.id
                      ? 'bg-indigo-600/30 border-indigo-500 text-white font-bold shadow-sm'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Comment Textarea */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Your Feedback / Issue Description</label>
            <textarea
              rows={3}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Describe your experience, print quality, or suggest a new feature..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Privacy & Diagnostics Controls */}
          <div className="flex flex-col gap-2 rounded-xl bg-slate-950/70 border border-slate-800/80 p-3">
            {/* Attach PDF Checkbox */}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={attachPdf}
                onChange={(e) => setAttachPdf(e.target.checked)}
                disabled={!finalPrintPdfBlob}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
              />
              <div className="flex flex-col text-xs">
                <div className="flex items-center gap-1.5 font-medium text-slate-200">
                  <Paperclip className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Attach Processed PDF (Optional)</span>
                  {!finalPrintPdfBlob && (
                    <span className="text-[10px] text-amber-400/80">(Available after generating PDF)</span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400">
                  Includes your generated output PDF to help debug layout or rendering glitches.
                </span>
              </div>
            </label>

            {/* Diagnostic Logs Checkbox */}
            <label className="flex items-start gap-2.5 cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={includeDiagnostics}
                onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="flex flex-col text-xs">
                <div className="flex items-center gap-1.5 font-medium text-slate-200">
                  <Info className="h-3.5 w-3.5 text-blue-400" />
                  <span>Include Diagnostic Information</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Sends non-sensitive OS, browser version, page counts, and layout settings for troubleshooting.
                </span>
              </div>
            </label>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-red-950/80 border border-red-800/80 p-3 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Submit & Preview Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={isSending}
              className="flex h-11 w-full flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-xs font-bold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Sending Feedback...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 text-white" />
                  <span>Submit Feedback</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleOpenPreviewModal}
              className="flex h-11 w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-4 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
            >
              <Code className="h-4 w-4 text-slate-400" />
              <span>Payload & Script Info</span>
            </button>
          </div>
        </form>
      ) : (
        /* Success Card */
        <div className="flex flex-col items-center gap-3 rounded-xl bg-emerald-950/60 border border-emerald-500/30 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <Check className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-emerald-200">Thank you for your feedback! ❤️</h4>
          <p className="text-xs text-emerald-300/80 max-w-md">
            Your rating and diagnostics have been sent to our Telegram channel. Your feedback directly helps us improve PW Notes Print Optimizer.
          </p>
          <button
            type="button"
            onClick={() => {
              setIsSubmitted(false);
              setFeedbackText('');
            }}
            className="mt-2 text-xs font-semibold text-slate-400 hover:text-white underline cursor-pointer"
          >
            Send another response
          </button>
        </div>
      )}

      {/* Developer Modal / Payload Preview & GAS Code */}
      {showDeveloperModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="flex flex-col w-full max-w-3xl max-h-[90vh] rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden text-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 p-4">
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Feedback Architecture & Apps Script Setup</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeveloperModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/60 px-4">
              <button
                type="button"
                onClick={() => setActiveTab('payload')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'payload'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                1. Payload JSON Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('telegram')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'telegram'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                2. Telegram Message Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('gas')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'gas'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                3. Google Apps Script Code
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
              {activeTab === 'payload' && (
                <div className="flex flex-col gap-2">
                  <p className="font-sans text-xs text-slate-400 mb-2">
                    This structured, versioned JSON payload is generated client-side by the web app and sent to Google Apps Script.
                  </p>
                  <pre className="rounded-xl bg-slate-950 p-4 border border-slate-800 text-slate-300 overflow-x-auto whitespace-pre-wrap">
                    {payloadPreview}
                  </pre>
                </div>
              )}

              {activeTab === 'telegram' && (
                <div className="flex flex-col gap-2">
                  <p className="font-sans text-xs text-slate-400 mb-2">
                    This Telegram Markdown message is formatted entirely by the web application logic:
                  </p>
                  <pre className="rounded-xl bg-slate-950 p-4 border border-slate-800 text-emerald-300 overflow-x-auto whitespace-pre-wrap font-mono">
                    {telegramPreview}
                  </pre>
                </div>
              )}

              {activeTab === 'gas' && (
                <div className="flex flex-col gap-3 font-sans">
                  <div className="flex items-center justify-between rounded-xl bg-indigo-950/50 border border-indigo-500/30 p-3">
                    <span className="text-xs text-indigo-200">
                      Copy this lightweight, zero-dependency Apps Script code into your Google Apps Script editor.
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyGasCode}
                      className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 cursor-pointer shrink-0"
                    >
                      {copiedGas ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedGas ? 'Copied!' : 'Copy GAS Code'}</span>
                    </button>
                  </div>

                  <pre className="rounded-xl bg-slate-950 p-4 border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap max-h-96">
                    {GOOGLE_APPS_SCRIPT_CODE}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-800 p-3 bg-slate-950/80 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDeveloperModal(false)}
                className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
