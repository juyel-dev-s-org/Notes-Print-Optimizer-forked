'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bug,
  Check,
  Code,
  Copy,
  Info,
  Loader2,
  MessageCircle,
  Paperclip,
  Printer,
  Rocket,
  Send,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';

import { LayoutConfig, OptimizationMetrics } from '@/lib/optimizer/types';
import { FeedbackCategory, FeedbackUserInput, PdfStats, ProcessingSettings } from '@/lib/feedback/types';
import { buildFeedbackPayload } from '@/lib/feedback/payloadBuilder';
import { sendFeedbackToGas } from '@/lib/feedback/gasClient';
import { GOOGLE_APPS_SCRIPT_CODE } from '@/lib/feedback/gasScriptTemplate';
import { useDialogFocus } from '@/lib/ui/useDialogFocus';

interface FeedbackSectionProps {
  currentPhase: number;
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
  endpointUrl,
}) => {
  // Form State
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [category, setCategory] = useState<FeedbackCategory>('General');
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [attachPdf, setAttachPdf] = useState<boolean>(false);
  const [includeDiagnostics, setIncludeDiagnostics] = useState<boolean>(false);

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
  const copiedGasTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const devModalRef = useRef<HTMLDivElement>(null);
  const devModalCloseRef = useRef<HTMLButtonElement>(null);
  const devModalTriggerRef = useRef<HTMLButtonElement>(null);

  useDialogFocus({
    open: showDeveloperModal,
    containerRef: devModalRef,
    initialFocusRef: devModalCloseRef,
    restoreFocusRef: devModalTriggerRef,
  });

  // Focus the close button when the dev modal opens; close on Escape.
  useEffect(() => {
    if (!showDeveloperModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDeveloperModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showDeveloperModal]);

  const categories: { id: FeedbackCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'General', label: 'General', icon: <MessageCircle className="h-4 w-4" /> },
    { id: 'Bug', label: 'Bug Report', icon: <Bug className="h-4 w-4" /> },
    { id: 'Print Quality', label: 'Print Quality', icon: <Printer className="h-4 w-4" /> },
    { id: 'Feature Request', label: 'Feature Request', icon: <Rocket className="h-4 w-4" /> },
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
        "v2",
        getPdfStats(),
        getProcessingSettings(),
        finalPrintPdfBlob
      );

      const targetUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL || endpointUrl;
      if (!targetUrl) {
        setErrorMessage('Feedback is not configured on this deployment.');
        return;
      }
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
      "v2",
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
    if (copiedGasTimerRef.current) clearTimeout(copiedGasTimerRef.current);
    copiedGasTimerRef.current = setTimeout(() => setCopiedGas(false), 2500);
  };

  // Clear the "Copied!" reset timer if the section unmounts.
  useEffect(() => () => {
    if (copiedGasTimerRef.current) clearTimeout(copiedGasTimerRef.current);
  }, []);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-surface-2 bg-surface/90 p-5 shadow-2xl w-full text-left">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-2 pb-3">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-warning fill-warning" />
          <h3 className="text-sm font-bold text-ink">Rate Your Experience & Feedback</h3>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-success bg-success-faint/60 border border-success-strong/30 px-2.5 py-1 rounded-full">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Privacy-First</span>
        </div>
      </div>

      {!isSubmitted ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Star Rating Bar */}
<div className="flex flex-col gap-1.5">
            <span id="rating-label" className="text-xs font-semibold text-ink-muted">Overall Rating</span>
            <div role="radiogroup" aria-labelledby="rating-label" className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={rating === star}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    aria-label={`Rate ${star} out of 5 stars`}
                    className="p-1.5 -m-1.5 text-warning transition-transform hover:scale-110 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/70 rounded-md"
                  >
                    <Star
                      className={`h-7 w-7 transition-colors ${
                        star <= (hoverRating || rating)
                          ? 'fill-warning text-warning'
                          : 'text-elevated'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <span className="text-xs font-bold text-warning bg-warning-faint/50 border border-warning-strong/30 px-2.5 py-1 rounded-md">
                {ratingLabels[hoverRating || rating]}
              </span>
            </div>
          </div>

          {/* Feedback Category Pills */}
<div className="flex flex-col gap-1.5">
            <span id="category-label" className="text-xs font-semibold text-ink-muted">Category</span>
            <div role="radiogroup" aria-labelledby="category-label" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="radio"
                  aria-checked={category === cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all ${
                    category === cat.id
                      ? 'bg-primary-strong/30 border-primary text-ink font-bold shadow-sm'
                      : 'bg-bg/80 border-surface-2 text-ink-muted hover:text-ink hover:border-elevated'
                  }`}
                >
                  <span className={category === cat.id ? 'text-primary-soft' : 'text-ink-muted'}>
                    {cat.icon}
                  </span>
                  <span>{cat.label}</span>
                </button>
))}
            </div>
          </div>

          {/* Comment Textarea */}
<div className="flex flex-col gap-1.5">
            <label htmlFor="feedback-text" className="text-xs font-semibold text-ink-muted">Your Feedback / Issue Description</label>
            <textarea
              id="feedback-text"
              rows={3}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Describe your experience, print quality, or suggest a new feature..."
              className="w-full rounded-xl border border-surface-2 bg-bg p-3 text-xs text-ink placeholder-ink-faint focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/60 transition-colors"
            />
          </div>

          {/* Privacy & Diagnostics Controls */}
          <div className="flex flex-col gap-2 rounded-xl bg-bg/70 border border-surface-2/80 p-3">
            {/* Attach PDF Checkbox */}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={attachPdf}
                onChange={(e) => setAttachPdf(e.target.checked)}
                disabled={!finalPrintPdfBlob}
                className="mt-0.5 h-4 w-4 rounded border-elevated bg-surface text-primary-strong focus:ring-primary disabled:opacity-50"
              />
              <div className="flex flex-col text-xs">
                <div className="flex items-center gap-1.5 font-medium text-ink">
                  <Paperclip className="h-3.5 w-3.5 text-primary-soft" />
                  <span>Attach Processed PDF (Optional)</span>
                  {!finalPrintPdfBlob && (
                    <span className="text-2xs text-warning/80">(Available after generating PDF)</span>
                  )}
                </div>
                <span className="text-[11px] text-ink-muted">
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
                className="mt-0.5 h-4 w-4 rounded border-elevated bg-surface text-primary-strong focus:ring-primary"
              />
              <div className="flex flex-col text-xs">
                <div className="flex items-center gap-1.5 font-medium text-ink">
                  <Info className="h-3.5 w-3.5 text-primary-soft" />
                  <span>Include Diagnostic Information</span>
                </div>
                <span className="text-[11px] text-ink-muted">
                  Sends non-sensitive OS, browser version, page counts, and layout settings for troubleshooting.
                </span>
              </div>
            </label>
          </div>

          {/* Error Alert */}
{errorMessage && (
            <div role="alert" className="flex items-center gap-2 rounded-xl bg-danger-faint/80 border border-danger-strong/80 p-3 text-xs text-danger-soft">
              <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Submit & Preview Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={isSending}
              className="flex h-11 w-full flex-1 items-center justify-center gap-2 rounded-xl bg-primary-strong px-5 text-xs font-bold text-white shadow-lg hover:bg-primary disabled:opacity-50 transition-all cursor-pointer"
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
          </div>

          <p className="text-center text-2xs text-ink-muted">
            Developer?{' '}
<button
              ref={devModalTriggerRef}
              type="button"
              onClick={handleOpenPreviewModal}
              className="font-semibold text-ink-muted underline decoration-elevated underline-offset-2 hover:text-primary-soft transition-colors cursor-pointer"
            >
              Inspect the payload &amp; script
            </button>{' '}
            to see exactly what gets sent.
          </p>
        </form>
      ) : (
        /* Success Card */
        <div className="flex flex-col items-center gap-3 rounded-xl bg-success-faint/60 border border-success-strong/30 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-strong/20 text-success border border-success-strong/40">
            <Check className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-success-soft">Thank you for your feedback!</h4>
          <p className="text-xs text-success-soft/80 max-w-md">
            Your rating and diagnostics have been sent to our Telegram channel. Your feedback directly helps us improve PW Notes Print Optimizer.
          </p>
          <button
            type="button"
            onClick={() => {
              setIsSubmitted(false);
              setFeedbackText('');
            }}
            className="mt-2 text-xs font-semibold text-ink-muted hover:text-ink underline cursor-pointer"
          >
            Send another response
          </button>
        </div>
      )}

      {/* Developer Modal / Payload Preview & GAS Code */}
      {showDeveloperModal && (
        <div
          ref={devModalRef}
          role="dialog"
          aria-modal="true"
          aria-label="Feedback payload and Apps Script preview"
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4"
        >
          <div className="flex flex-col w-full max-w-3xl max-h-[90vh] rounded-2xl border border-surface-2 bg-surface shadow-2xl overflow-hidden text-ink">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-surface-2 p-4">
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-primary-soft" />
                <h3 className="text-sm font-bold text-ink">Feedback Architecture & Apps Script Setup</h3>
              </div>
              <button
                ref={devModalCloseRef}
                type="button"
                onClick={() => setShowDeveloperModal(false)}
                aria-label="Close dialog"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-surface-2 bg-bg/60 px-4">
              <button
                type="button"
                onClick={() => setActiveTab('payload')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'payload'
                    ? 'border-primary text-primary-soft'
                    : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                1. Payload JSON Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('telegram')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'telegram'
                    ? 'border-primary text-primary-soft'
                    : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                2. Telegram Message Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('gas')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'gas'
                    ? 'border-primary text-primary-soft'
                    : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                3. Google Apps Script Code
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
              {activeTab === 'payload' && (
                <div className="flex flex-col gap-2">
                  <p className="font-sans text-xs text-ink-muted mb-2">
                    This structured, versioned JSON payload is generated client-side by the web app and sent to Google Apps Script.
                  </p>
                  <pre className="rounded-xl bg-bg p-4 border border-surface-2 text-ink-muted overflow-x-auto whitespace-pre-wrap">
                    {payloadPreview}
                  </pre>
                </div>
              )}

              {activeTab === 'telegram' && (
                <div className="flex flex-col gap-2">
                  <p className="font-sans text-xs text-ink-muted mb-2">
                    This Telegram Markdown message is formatted entirely by the web application logic:
                  </p>
                  <pre className="rounded-xl bg-bg p-4 border border-surface-2 text-success-soft overflow-x-auto whitespace-pre-wrap font-mono">
                    {telegramPreview}
                  </pre>
                </div>
              )}

              {activeTab === 'gas' && (
                <div className="flex flex-col gap-3 font-sans">
                  <div className="flex items-center justify-between rounded-xl bg-primary-faint/50 border border-primary/30 p-3">
                    <span className="text-xs text-primary-soft">
                      Copy this lightweight, zero-dependency Apps Script code into your Google Apps Script editor.
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyGasCode}
                      className="flex items-center gap-1.5 rounded-lg bg-primary-strong px-3 py-1.5 text-xs font-bold text-white hover:bg-primary cursor-pointer shrink-0"
                    >
                      {copiedGas ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedGas ? 'Copied!' : 'Copy GAS Code'}</span>
                    </button>
                  </div>

                  <pre className="rounded-xl bg-bg p-4 border border-surface-2 text-ink-muted font-mono text-[11px] overflow-x-auto whitespace-pre-wrap max-h-96">
                    {GOOGLE_APPS_SCRIPT_CODE}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-surface-2 p-3 bg-bg/80 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDeveloperModal(false)}
                className="rounded-xl bg-surface-2 px-4 py-2 text-xs font-semibold text-ink hover:bg-elevated cursor-pointer"
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