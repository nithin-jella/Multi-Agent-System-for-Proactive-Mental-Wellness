import { useEffect, useRef, RefObject } from 'react';

/**
 * useModalA11y
 * Provides: focus trapping, Escape to close, initial focus, and focus restoration.
 * Pass open flag, a ref to the dialog container, and a close callback.
 */
export function useModalA11y(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const hasInitializedFocus = useRef(false);

  useEffect(() => {
    if (open && !hasInitializedFocus.current) {
      hasInitializedFocus.current = true;
      lastFocusedRef.current = document.activeElement as HTMLElement;
      const container = ref.current;
      if (container) {
        const focusable = container.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        (focusable || container).focus();
      }
    }
    if (!open) {
      hasInitializedFocus.current = false;
    }
  }, [open, ref]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab') {
        const container = ref.current;
        if (!container) return;
        const focusables = Array.from(container.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled'));
        if (focusables.length === 0) {
          e.preventDefault();
          container.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('keydown', handleKey, true);
      if (lastFocusedRef.current && typeof lastFocusedRef.current.focus === 'function') {
        lastFocusedRef.current.focus();
      }
    };
  }, [open, onClose, ref]);
}
