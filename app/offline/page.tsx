'use client';

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center">
      <div className="flex flex-col items-center gap-4 max-w-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 border border-elevated">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 0 1 10 10c0 1.6-.4 3.1-1 4.5L9 5.1A10 10 0 0 1 12 2z"/>
            <path d="M2 12a10 10 0 0 0 16.9 7.4L6.1 5.1A10 10 0 0 0 2 12z"/>
            <line x1="2" y1="2" x2="22" y2="22"/>
          </svg>
        </div>
        <h1 className="text-xl font-bold text-ink">You Are Offline</h1>
        <p className="text-sm text-ink-muted leading-relaxed">
          PW Notes Print Optimizer requires an internet connection to process PDFs.
          Previously installed pages and assets remain available for offline use.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 flex h-11 items-center gap-2 rounded-xl bg-primary-strong px-5 text-sm font-bold text-white shadow-lg hover:bg-primary transition-all cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
          Try Again
        </button>
      </div>
    </div>
  );
}