'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, Info, X } from 'lucide-react';

interface InfoTooltipProps {
  content: string;
  title?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  icon?: 'help' | 'info';
  className?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  content,
  title,
  position = 'top',
  icon = 'help',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640;
    }
    return false;
  });
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState<boolean>(() => typeof window !== 'undefined');

  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Responsive resize check
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Compute position for desktop/tablet floating tooltip
  const updatePosition = useCallback(() => {
    if (!buttonRef.current || isMobile) return;

    const btnRect = buttonRef.current.getBoundingClientRect();
    const tooltipWidth = Math.min(280, window.innerWidth - 32); // Max 280px or screen-32px
    const tooltipHeight = 110; // Estimated height
    const margin = 16; // Safe edge margin

    let targetSide = position;

    // Viewport boundary check & auto-flip
    if (targetSide === 'top' && btnRect.top - tooltipHeight - margin < 0) {
      targetSide = 'bottom';
    } else if (targetSide === 'bottom' && btnRect.bottom + tooltipHeight + margin > window.innerHeight) {
      targetSide = 'top';
    } else if (targetSide === 'right' && btnRect.right + tooltipWidth + margin > window.innerWidth) {
      targetSide = 'left';
    } else if (targetSide === 'left' && btnRect.left - tooltipWidth - margin < 0) {
      targetSide = 'right';
    }

    let top = 0;
    let left = 0;

    switch (targetSide) {
      case 'top':
        top = btnRect.top - tooltipHeight - 8;
        left = btnRect.left + btnRect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = btnRect.bottom + 8;
        left = btnRect.left + btnRect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = btnRect.top + btnRect.height / 2 - tooltipHeight / 2;
        left = btnRect.left - tooltipWidth - 8;
        break;
      case 'right':
        top = btnRect.top + btnRect.height / 2 - tooltipHeight / 2;
        left = btnRect.right + 8;
        break;
    }

    // Clamp coordinates within screen boundaries with margin
    const clampedLeft = Math.max(margin, Math.min(left, window.innerWidth - tooltipWidth - margin));
    const clampedTop = Math.max(margin, Math.min(top, window.innerHeight - tooltipHeight - margin));

    setCoords({ top: clampedTop, left: clampedLeft });
  }, [position, isMobile]);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    // Listen to scroll (in capture phase for nested scrollables), resize, orientationchange
    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('orientationchange', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('orientationchange', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const IconComponent = icon === 'help' ? HelpCircle : Info;

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  return (
    <span className={`inline-flex items-center ${className}`}>
      <span
        ref={buttonRef as any}
        role="button"
        tabIndex={0}
        onClick={toggleOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }
        }}
        onMouseEnter={() => !isMobile && setIsOpen(true)}
        onMouseLeave={() => !isMobile && setIsOpen(false)}
        className="p-1 text-slate-400 hover:text-indigo-400 focus:text-indigo-400 focus:outline-none transition-colors cursor-pointer rounded-full hover:bg-slate-800/60 active:scale-95"
        aria-label={title || 'More information'}
      >
        <IconComponent className="h-3.5 w-3.5" />
      </span>

      {/* Render via Portal to body to avoid overflow clipping */}
      {mounted && isOpen && createPortal(
        isMobile ? (
          /* MOBILE BOTTOM SHEET POPUP WITH BACKDROP */
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur-sm p-0 animate-in fade-in duration-150"
            onClick={() => setIsOpen(false)}
          >
            <div
              className="w-full max-w-lg rounded-t-3xl border-t border-slate-700 bg-slate-900 p-5 pb-safe shadow-2xl text-slate-100 animate-in slide-in-from-bottom duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle pill */}
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-700" />

              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    <Info className="h-4 w-4" />
                  </div>
                  {title && <h4 className="text-sm font-bold text-white">{title}</h4>}
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-xs leading-relaxed text-slate-300 font-medium my-2">
                {content}
              </p>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="mt-4 flex h-10 w-full items-center justify-center rounded-xl bg-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-700 active:scale-98 transition-all"
              >
                Got It
              </button>
            </div>
          </div>
        ) : (
          /* DESKTOP / TABLET FLOATING TOOLTIP */
          <div
            ref={tooltipRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              maxWidth: '280px',
            }}
            className="z-50 rounded-xl border border-slate-700 bg-slate-900/95 p-3 text-xs text-slate-200 shadow-2xl backdrop-blur-md pointer-events-none animate-in fade-in zoom-in-95 duration-150"
            role="tooltip"
          >
            {title && (
              <div className="font-bold text-white mb-1 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span>{title}</span>
              </div>
            )}
            <p className="text-[11px] leading-relaxed text-slate-300 font-normal">{content}</p>
          </div>
        ),
        document.body
      )}
    </span>
  );
};
