'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { ProcessingModal } from '@/components/ProcessingModal';
import { PlatformUIOrchestrator } from '@/components/views/PlatformUIOrchestrator';
import { usePageHandlers } from '@/lib/workflow/usePageHandlers';
import { useMonitor } from '@/lib/monitoring/useMonitor';
import { ToastProvider } from '@/components/shared/Toast';
import { SeoVisibilityContext } from '@/components/seo/SeoVisibilityContext';
import { modeForSlug, toolHref } from '@/lib/tools/registry';
import type { ToolMode } from '@/lib/enhance/types';
import type { WorkflowState, WorkflowActions, WorkflowHandlers } from '@/components/views/types';
import type { HandoffPageInput } from '@/lib/services/EnhanceHandoffService';
import { RefreshCw, X } from 'lucide-react';

/**
 * Persistent client shell — mounted ONCE by app/(app)/layout.tsx and kept
 * alive across every soft route change inside the group. Owns:
 *
 *  - session/workflow state (usePageHandlers) that must survive navigation
 *  - the Enhance→N-Up handoff flag (in-memory by design)
 *  - SW registration + update banner
 *  - header/footer chrome
 *
 * The ACTIVE TOOL is derived from the URL via usePathname(): the URL is the
 * single source of truth. Deep links, refresh, back and forward all resolve
 * to the same tool without any imperative history plumbing.
 *
 * Server pages inject crawlable content as `children`; it renders below the
 * interactive tool stage so UX is unchanged while SEO HTML ships statically.
 */
export function PersistentShell({ children }: { children: React.ReactNode }) {
  useMonitor();
  const router = useRouter();
  const pathname = usePathname();
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);
  /** True while the user is inside the N-Up stage reached from the enhance tool. */
  const [arrivedViaEnhance, setArrivedViaEnhance] = useState(false);

  // URL → tool mode. `/tools/<slug>/…` maps through the registry contract;
  // anything else (home) is the landing.
  const toolMode: ToolMode | null = useMemo(() => {
    if (!pathname) return null;
    const match = pathname.match(/^\/tools\/([^/]+)/);
    return match ? modeForSlug(match[1]) : null;
  }, [pathname]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const swPath = `${basePath}/sw.js`;
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register(swPath, { scope: `${basePath}/`, updateViaCache: 'none' })
          .then((reg) => {
            reg.addEventListener('updatefound', () => {
              const nw = reg.installing;
              if (nw) {
                nw.addEventListener('statechange', () => {
                  if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                    setSwUpdateAvailable(true);
                  }
                });
              }
            });
          })
          .catch((err) => console.warn('[SW] Registration failed:', err));
      });
    }
  }, []);

  /** URL navigation IS tool selection — native router, history-aware. */
  const navigateToTool = useCallback(
    (mode: ToolMode | null) => {
      router.push(mode ? toolHref(mode) : '/');
    },
    [router],
  );

  const {
    state, actions,
    handleResetWorkflow, handleFilesUpload,
    handleMoveItem, handleRemoveItem, handleDownloadMerged,
    handleSmartArrange, handleReorderItem,
    handleProceedToPhase2, handleToggleExcludePage, handleDownloadOptimized1Up,
    handleToggleKeepOriginalPage, handleSetManualRegions, handleClearManualRegions,
    handleProceedToPhase3, handleReprocess, handlePreviewReprocess,
    handleResetSettings,
    handleSelectLayoutFormat, handleToggleOrientation, handleToggleBorders,
    handleTogglePageNumbers, handleUpdateOuterMargins, handleUpdateInnerMargin,
    handleApplyLayout, handleDownloadFinalPrintPdf, handleProceedToPhase4,
    handleSendFeedback, compilePhase3PrintLayout,
    handleCancelProcessing,
    handleEnhanceLayoutHandoff,
    progressiveThumbnails,
  } = usePageHandlers();

  /** Enhance -> N-Up: land inside the dark-print tool via its route, without
   * its pipeline chrome (stepper/back-to-optimize) — see arrivedViaEnhance. */
  const runEnhanceLayoutHandoff = useCallback(async (pages: HandoffPageInput[]) => {
    await handleEnhanceLayoutHandoff(pages);
    setArrivedViaEnhance(true);
    router.push(toolHref('dark-print'));
  }, [handleEnhanceLayoutHandoff, router]);

  /** From the handoff stage, reset exits to the tools box, not tool-1 upload. */
  const handleSessionReset = useCallback(() => {
    if (arrivedViaEnhance) {
      setArrivedViaEnhance(false);
      router.push('/');
    }
    handleResetWorkflow();
  }, [arrivedViaEnhance, handleResetWorkflow, router]);

  /** Return to the enhance workbench (its results stay alive in the tool machine). */
  const handleBackToEnhance = useCallback(() => {
    setArrivedViaEnhance(false);
    router.push(toolHref('enhance'));
    handleResetWorkflow();
  }, [handleResetWorkflow, router]);

  // SEO blocks (About / FAQ / Related) — premium: visible only on upload
  // + done. Dark-print is derived synchronously (phase 1 + 4); every other
  // tool drives visibility via SeoVisibilityContext from inside its own step.
  const [seoVisibleOther, setSeoVisibleOther] = useState(true);
  const seoVisible =
    toolMode === 'dark-print' ? state.currentPhase === 1 || state.currentPhase === 4 : seoVisibleOther;

  useEffect(() => {
    if (toolMode !== 'dark-print' && toolMode !== null) setSeoVisibleOther(true);
  }, [toolMode]);

  const workflowState: WorkflowState = useMemo(() => ({
    currentPhase: state.currentPhase,
    isProcessing: state.isProcessing,
    progress: state.progress,
    errorMessage: state.errorMessage,
    uploadedItems: state.uploadedItems,
    mergedPdfBlob: state.mergedPdfBlob,
    mergedPdfBytes: state.mergedPdfBytes,
    mergedPageDataUrls: state.mergedPageDataUrls,
    processedPages: state.processedPages,
    selectedPageIndex: state.selectedPageIndex,
    excludedPages: state.excludedPages,
    keepOriginalPages: state.keepOriginalPages,
    manualWhiteBoxRegions: state.manualWhiteBoxRegions,
    docProfile: state.docProfile,
    masterParams: state.masterParams,
    processingToggles: state.processingToggles,
    isPreviewProcessing: state.isPreviewProcessing,
    layoutConfig: state.layoutConfig,
    layoutDirty: state.layoutDirty,
    finalSheetPreviews: state.finalSheetPreviews,
    finalMetrics: state.finalMetrics,
    finalPrintPdfBlob: state.finalPrintPdfBlob,
    analysisTimeMs: state.analysisTimeMs,
    optimizationTimeMs: state.optimizationTimeMs,
    layoutTimeMs: state.layoutTimeMs,
    rating: state.rating,
    feedbackText: state.feedbackText,
    feedbackSubmitted: state.feedbackSubmitted,
    progressiveThumbnails,
  }), [state, progressiveThumbnails]);

  const workflowActions: WorkflowActions = useMemo(() => ({
    setPhase: actions.setPhase,
    setError: actions.setError,
    setSelectedPageIndex: actions.setSelectedPageIndex,
    setMasterParams: actions.setMasterParams,
    setProcessingToggles: actions.setProcessingToggles,
    setExcludedPages: actions.setExcludedPages,
    setRating: actions.setRating,
    setFeedbackText: actions.setFeedbackText,
  }), [actions]);

  const workflowHandlers: WorkflowHandlers = useMemo(() => ({
    handleFilesUpload,
    handleMoveItem,
    handleRemoveItem,
    handleReorderItem,
    handleSmartArrange,
    handleDownloadMerged,
    handleProceedToPhase2,
    handleToggleExcludePage,
    handleToggleKeepOriginalPage,
    handleSetManualRegions,
    handleClearManualRegions,
    handleDownloadOptimized1Up,
    handleProceedToPhase3,
    handleReprocess,
    handlePreviewReprocess,
    handleResetSettings,
    handleApplyLayout,
    handleSelectLayoutFormat,
    handleToggleOrientation,
    handleToggleBorders,
    handleTogglePageNumbers,
    handleUpdateOuterMargins,
    handleUpdateInnerMargin,
    handleDownloadFinalPrintPdf,
    handleProceedToPhase4,
    handleSendFeedback,
    compilePhase3PrintLayout,
    handleCancelProcessing,
    handleResetWorkflow: handleSessionReset,
  }), [
    handleFilesUpload, handleMoveItem, handleRemoveItem,
    handleReorderItem, handleSmartArrange, handleDownloadMerged, handleProceedToPhase2,
    handleToggleExcludePage, handleDownloadOptimized1Up, handleProceedToPhase3,
    handleReprocess, handlePreviewReprocess, handleResetSettings, handleApplyLayout,
    handleSelectLayoutFormat, handleToggleOrientation, handleToggleBorders,
    handleTogglePageNumbers, handleUpdateOuterMargins, handleUpdateInnerMargin,
    handleDownloadFinalPrintPdf, handleProceedToPhase4, handleSendFeedback,
    handleCancelProcessing, compilePhase3PrintLayout,
    handleSessionReset,
  ]);

  return (
    <ToastProvider>
      <SeoVisibilityContext.Provider value={{ visible: seoVisible, setVisible: setSeoVisibleOther }}>
        <div className="min-h-screen bg-bg app-shell-bg text-ink font-sans flex flex-col pb-safe">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Header
        currentPhase={state.currentPhase}
        onReset={handleSessionReset}
        onNavigatePhase={(phase) => actions.setPhase(phase)}
        isProcessing={state.isProcessing}
        showStepper={toolMode === 'dark-print' && !arrivedViaEnhance}
      />
      <ProcessingModal progress={state.progress} onCancel={handleCancelProcessing} progressiveThumbnails={progressiveThumbnails} />
      {swUpdateAvailable && (
        <div role="status" className="bg-primary-faint/90 border-b border-primary-deep text-primary-soft text-xs py-2 px-4 flex items-center justify-between font-medium shadow-md">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-primary-soft animate-spin" />
            <span>A new version of Print Optimizer is available.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="bg-primary-strong hover:bg-primary text-white px-2.5 py-1 rounded text-xs font-semibold transition"
            >
              Update Now
            </button>
            <button
              onClick={() => setSwUpdateAvailable(false)}
              className="p-2 hover:text-ink text-primary-soft transition"
              aria-label="Dismiss update alert"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      {state.errorMessage && (
        <div role="alert" className="bg-danger-faint/90 border-b border-danger-deep text-danger-soft text-xs py-2.5 px-4 flex items-center justify-between font-medium shadow-md">
          <div className="flex-1 text-center">{state.errorMessage}</div>
          <button
            onClick={() => actions.setError(null)}
            className="p-2 hover:text-ink text-danger-soft transition"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
      {/* pb-28 only while a tool is active — it reserves room for the fixed action bar.
          Landing has no bar, so the dead 112px gap before the footer is removed. */}
      <main id="main-content" className={`mx-auto w-full max-w-5xl lg:max-w-6xl flex-1 px-3 py-4 sm:px-6 sm:py-6 ${toolMode !== null ? 'pb-28 md:pb-8' : 'pb-10 md:pb-8'}`}>
        {toolMode !== null && (
          <>
            <PlatformUIOrchestrator
              state={workflowState}
              actions={workflowActions}
              handlers={workflowHandlers}
              toolMode={toolMode}
              onToolModeChange={navigateToTool}
              onEnhanceHandoff={runEnhanceLayoutHandoff}
              enhanceHandoffActive={arrivedViaEnhance}
              onBackToEnhance={handleBackToEnhance}
            />
            <div className="mt-6 md:mt-8" />
          </>
        )}
        {children}
      </main>
      {/* Premium Floating Glass Footer — Emerald Student Identity */}
      <footer className="mt-8 px-3 pb-4 sm:px-4">
        <div className="mx-auto max-w-6xl">
          {/* Bow top — inverted curved corners */}
          <div className="relative overflow-hidden rounded-[1.75rem] border border-emerald-500/10 bg-slate-900/70 backdrop-blur-xl shadow-2xl shadow-emerald-900/10">
            {/* Top bow gradient line */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
            {/* Liquid glass glow */}
            <div aria-hidden="true" className="pointer-events-none absolute -top-20 left-1/2 h-40 w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 blur-3xl" />

            <div className="relative px-5 py-6 sm:px-6 sm:py-7 lg:px-8">
              {/* Top: Logo + Tagline */}
              <div className="flex flex-col items-center gap-3 border-b border-white/[0.06] pb-6 text-center sm:flex-row sm:justify-between sm:text-left">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/20">
                    <span className="text-sm font-black">P</span>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold tracking-tight text-white">Print Optimizer</div>
                    <div className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-[11px] font-semibold text-transparent">Made for Students, by Students</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-600/20 bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> 100% Offline • No Upload
                  </span>
                  {/* Language chooser — future i18n */}
                  <div className="flex items-center rounded-full border border-white/10 bg-white/[0.04] p-1 text-[11px] font-semibold">
                    <span className="rounded-full bg-white px-2.5 py-1 text-slate-900">BN</span>
                    <span className="px-2.5 py-1 text-slate-400">EN</span>
                  </div>
                </div>
              </div>

              {/* Middle: 4 columns */}
              <div className="grid grid-cols-2 gap-6 py-6 sm:grid-cols-4 lg:gap-8">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100">Tools</h4>
                  <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
                    <li><Link href="/tools/dark-print/" className="hover:text-emerald-300 transition-colors">Dark Notes → Print</Link></li>
                    <li><Link href="/tools/n-up/" className="hover:text-emerald-300 transition-colors">N-up PDF</Link></li>
                    <li><Link href="/tools/merge-pdf/" className="hover:text-emerald-300 transition-colors">Merge PDF</Link></li>
                    <li><Link href="/tools/image-to-pdf/" className="hover:text-emerald-300 transition-colors">Image → PDF</Link></li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100">For Students</h4>
                  <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
                    <li className="text-slate-200">NEET • JEE • Boards</li>
                    <li>PW • Allen • Unacademy</li>
                    <li>PYQ & Handwritten</li>
                    <li className="text-emerald-300 font-medium">Free • No sign-up</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100">Community</h4>
                  <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
                    <li><a href="https://github.com/juyel-dev/Notes-Print-Optimizer" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-white transition-colors">GitHub <span className="text-[10px]">↗</span></a></li>
                    <li><a href="https://t.me/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Telegram</a></li>
                    <li><a href="https://x.com/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">X (Twitter)</a></li>
                    <li><a href="https://www.reddit.com/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Reddit</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100">Legal</h4>
                  <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
                    <li><a href="#" className="hover:text-emerald-300 transition-colors">Privacy Policy</a></li>
                    <li><a href="#" className="hover:text-emerald-300 transition-colors">Juyel Source License v1.0</a></li>
                    <li><a href="mailto:myself.juyel.dev@gmail.com" className="hover:text-emerald-300 transition-colors">Contact</a></li>
                    <li className="text-slate-400">myself.juyel.dev@gmail.com</li>
                  </ul>
                </div>
              </div>

              {/* Bottom: Social + Love + Copyright */}
              <div className="flex flex-col items-center gap-4 border-t border-white/[0.06] pt-5 sm:flex-row sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: 'IG', href: 'https://instagram.com' },
                      { label: 'TG', href: 'https://t.me' },
                      { label: 'X', href: 'https://x.com' },
                      { label: 'RD', href: 'https://reddit.com' },
                      { label: 'GH', href: 'https://github.com/juyel-dev/Notes-Print-Optimizer' },
                    ].map((s) => (
                      <a
                        key={s.label}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={s.label}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-bold text-slate-300 hover:bg-emerald-500/15 hover:border-emerald-500/20 hover:text-emerald-300 transition-colors"
                      >
                        {s.label}
                      </a>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1 text-center sm:items-end sm:text-right">
                  <p className="text-xs font-medium text-slate-200">
                    Made with <span className="text-emerald-400">♥</span> for Students • 100% Offline • No Upload
                  </p>
                  <p className="text-[11px] text-slate-400">
                    © 2026 Juyel Hossain • JSL v1.0 • <span className="tabular-nums">v36</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-[10px] leading-relaxed text-slate-600">
            Built for NEET, JEE, Boards &amp; every student - PW, Allen, Unacademy notes, one tap to
            print.
          </p>
        </div>
      </footer>
        </div>
      </SeoVisibilityContext.Provider>
    </ToastProvider>
  );
}
