'use client';

import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, Info, X } from 'lucide-react';
import { useDialogFocus } from '@/lib/ui/useDialogFocus';

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
  const [isMobile, setIsMobile] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const buttonRef = useRef<HTMLSpanElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetCloseRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();

  // Mobile sheet behaves as a dialog: focus moves in, Tab is trapped, the
  // body scroll locks, and focus returns to the trigger on close.
  useDialogFocus({
    open: isMobile && isOpen,
    containerRef: sheetRef,
    initialFocusRef: sheetCloseRef,
    restoreFocusRef: buttonRef,
  });

  // Responsive resize check (initial state resolved on mount, not during render)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
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
        ref={buttonRef}
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
        onFocus={() => !isMobile && setIsOpen(true)}
        onBlur={() => !isMobile && setIsOpen(false)}
        className="flex h-8 w-8 items-center justify-center -m-1 rounded-full text-ink-muted hover:text-primary-soft focus:text-primary-soft focus-visible:ring-2 focus-visible:ring-primary-soft/70 transition-colors cursor-pointer hover:bg-surface-2/60 active:scale-95"
        aria-label={title || 'More information'}
        aria-haspopup="dialog"
        aria-describedby={!isMobile && isOpen ? tooltipId : undefined}
      >
        <IconComponent className="h-4 w-4" />
      </span>

      {/* Render via Portal to body to avoid overflow clipping */}
      {isOpen && createPortal(
        isMobile ? (
          /* MOBILE BOTTOM SHEET POPUP WITH BACKDROP */
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={title || 'More information'}
            className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 backdrop-blur-sm p-0 animate-in fade-in duration-150"
            onClick={() => setIsOpen(false)}
          >
            <div
              className="w-full max-w-lg rounded-t-3xl border-t border-elevated bg-surface p-5 pb-safe shadow-2xl text-ink animate-in slide-in-from-bottom duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle pill */}
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-elevated" />

              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 text-primary-soft border border-primary/30">
                    <Info className="h-4 w-4" />
                  </div>
                  {title && <h4 className="text-sm font-bold text-ink">{title}</h4>}
                </div>
                <button
                  ref={sheetCloseRef}
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close information"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs leading-relaxed text-ink-muted font-medium my-2">
                {content}
              </p>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="mt-4 flex h-10 w-full items-center justify-center rounded-xl bg-surface-2 text-xs font-bold text-ink hover:bg-elevated active:scale-98 transition-all"
              >
                Got It
              </button>
            </div>
          </div>
        ) : (
          /* DESKTOP / TABLET FLOATING TOOLTIP */
          <div
            id={tooltipId}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              maxWidth: '280px',
            }}
            className="z-50 rounded-xl border border-elevated bg-surface/95 p-3 text-xs text-ink shadow-2xl backdrop-blur-md pointer-events-none animate-in fade-in zoom-in-95 duration-150"
            role="tooltip"
          >
            {title && (
              <div className="font-bold text-ink mb-1 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-primary-soft shrink-0" />
                <span>{title}</span>
              </div>
            )}
            <p className="text-[11px] leading-relaxed text-ink-muted font-normal">{content}</p>
          </div>
        ),
        document.body
      )}
    </span>
  );
};