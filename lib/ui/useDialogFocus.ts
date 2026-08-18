'use client';

import { useEffect, type RefObject } from 'react';

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
  );
}

interface UseDialogFocusOptions {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Shared dialog behaviour used by the drawer, modals, fullscreen viewer and
 * the info-tooltip sheet:
 *  - moves focus to the dialog on open (first focusable, or a given ref)
 *  - traps Tab / Shift+Tab inside the container
 *  - locks body scroll while open (restores the previous value)
 *  - returns focus to the opener on close
 *
 * Nested dialogs take precedence: while a child dialog owns the focus the
 * outer trap defers to it, so stacked modals do not fight each other.
 */
export function useDialogFocus({
  open,
  containerRef,
  initialFocusRef,
  restoreFocusRef,
}: UseDialogFocusOptions) {
  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    // Snapshot refs so the cleanup always restores the node that was open
    // when the effect started, even if the ref changes before unmount.
    const initial = initialFocusRef?.current ?? getFocusable(container)[0];
    const restoreTo = restoreFocusRef?.current ?? null;
    initial?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return;

      const topDialog = active.closest('[role="dialog"]');
      if (topDialog && topDialog !== container) return;

      const focusables = getFocusable(container);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !container.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      restoreTo?.focus();
    };
  }, [open, containerRef, initialFocusRef, restoreFocusRef]);
}