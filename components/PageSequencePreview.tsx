'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FileText } from 'lucide-react';

interface PageSequencePreviewProps {
  pageUrls: string[];
}

const SequenceItemCard: React.FC<{
  url: string;
  pageIndex: number;
}> = ({ url, pageIndex }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Virtualization & RAM Release: Unmount image node when outside viewport
        setIsVisible(entry.isIntersecting);
      },
      {
        rootMargin: '100px 0px 100px 0px', // Pre-load 100px before scrolling into view
        threshold: 0,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="group relative flex items-center gap-3 rounded-xl border border-surface-2 bg-bg p-2.5 shadow-md transition-all sm:flex-col sm:p-1.5 sm:gap-1.5 w-full min-w-0 max-w-full overflow-hidden"
    >
      {/* Aspect Ratio Container for Thumbnail */}
      <div className="relative aspect-video w-28 sm:w-full shrink-0 overflow-hidden rounded-lg bg-surface border border-surface-2 flex items-center justify-center">
        {isVisible ? (
          <>
            {/* Skeleton placeholder while image loads */}
            {!isLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface animate-pulse text-elevated">
                <FileText className="h-5 w-5 mb-1 opacity-40" />
                <span className="text-[10px] font-mono text-ink-muted">p.{pageIndex + 1}</span>
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Page ${pageIndex + 1}`}
              onLoad={() => setIsLoaded(true)}
              className={`max-h-full max-w-full object-contain transition-opacity duration-200 ${
                isLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </>
        ) : (
          /* Unmounted / Released RAM State - Skeleton Placeholder */
          <div className="flex flex-col items-center justify-center h-full w-full bg-surface/60 p-2">
            <div className="h-2 w-12 rounded bg-surface-2/80 animate-pulse mb-1" />
            <span className="text-[10px] font-bold font-mono text-ink-muted">p.{pageIndex + 1}</span>
          </div>
        )}

        {/* Page Badge */}
        <span className="absolute bottom-1 right-1 rounded-xs bg-surface/90 px-1 py-0.5 text-[9px] font-bold font-mono text-primary-soft border border-surface-2">
          p.{pageIndex + 1}
        </span>
      </div>

      {/* Mobile-only info column alongside single-column thumbnail */}
      <div className="flex flex-1 flex-col justify-center min-w-0 sm:hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-ink">Sequence Page {pageIndex + 1}</span>
          <span className="text-[10px] text-primary-soft font-mono">16:9 Slide</span>
        </div>
        <p className="text-[11px] text-ink-muted mt-0.5 truncate">
          Optimized merged slide buffer
        </p>
      </div>
    </div>
  );
};

export const PageSequencePreview: React.FC<PageSequencePreviewProps> = ({ pageUrls }) => {
  if (!pageUrls || pageUrls.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-2 pt-3 border-t border-surface-2 w-full max-w-full min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <h4 className="text-xs font-bold text-ink-muted truncate">
          Page Sequence Preview ({pageUrls.length} Pages)
        </h4>
        <span className="text-xs text-ink-muted sm:hidden font-mono shrink-0">
          1 Column · RAM Virtualized
        </span>
      </div>

      {/* 
        Conditional Responsive Grid:
        - Mobile (<640px): 1-column layout for high legibility and large tap area
        - Tablet (>=640px): 3-column grid
        - Medium (>=768px): 4-column grid
        - Desktop (>=1024px): 6-column grid
      */}
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-72 sm:max-h-56 overflow-y-auto overflow-x-hidden p-1 w-full max-w-full">
        {pageUrls.map((url, pIdx) => (
          <SequenceItemCard key={pIdx} url={url} pageIndex={pIdx} />
        ))}
      </div>
    </div>
  );
};
