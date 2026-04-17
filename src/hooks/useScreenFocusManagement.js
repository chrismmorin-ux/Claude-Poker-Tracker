/**
 * useScreenFocusManagement.js — Fullscreen-route focus lifecycle (PEO-1)
 *
 * Shared focus management for PlayerEditorView, PlayerPickerView (PEO-2/3)
 * and any future fullscreen routes mounted via SCREEN switch.
 *
 * Responsibilities:
 *   - On mount: move focus to the provided element (or first focusable child).
 *   - On unmount: restore focus to the element that held it at mount time.
 *
 * Why a shared hook: the existing PokerTracker.jsx screen switch rotates
 * view components without natural DOM focus continuity. Without this, mobile
 * users on Android browsers see the soft-keyboard dismiss + re-raise noisily
 * on every nav, and screen-reader users lose position entirely.
 *
 * Usage:
 *   const rootRef = useRef(null);
 *   const inputRef = useRef(null);
 *   useScreenFocusManagement(rootRef, inputRef);
 *   return <div ref={rootRef}><input ref={inputRef} /></div>;
 */

import { useEffect, useRef } from 'react';

const isFocusable = (el) => {
  if (!el || typeof el.focus !== 'function') return false;
  if (el.disabled) return false;
  if (el.getAttribute?.('aria-hidden') === 'true') return false;
  if (el.tabIndex < 0) return false;
  return true;
};

const findFirstFocusable = (root) => {
  if (!root) return null;
  // Match common interactive elements; tabindex=0 explicitly makes something focusable.
  const candidates = root.querySelectorAll?.(
    'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
  );
  if (!candidates) return null;
  for (const el of candidates) {
    if (isFocusable(el)) return el;
  }
  return null;
};

/**
 * @param {React.RefObject<HTMLElement>} rootRef  root element (for fallback focus search)
 * @param {React.RefObject<HTMLElement>|null} initialFocusRef  element to focus on mount
 */
export const useScreenFocusManagement = (rootRef, initialFocusRef = null) => {
  const previousFocusRef = useRef(null);

  useEffect(() => {
    // Capture current focus so we can restore on unmount.
    previousFocusRef.current = (typeof document !== 'undefined') ? document.activeElement : null;

    // Move focus. Prefer explicit target; fallback to first focusable inside root.
    const target = (initialFocusRef?.current && isFocusable(initialFocusRef.current))
      ? initialFocusRef.current
      : findFirstFocusable(rootRef?.current);
    if (target) {
      try { target.focus({ preventScroll: true }); } catch { target.focus(); }
    }

    return () => {
      const prev = previousFocusRef.current;
      previousFocusRef.current = null;
      if (prev && isFocusable(prev) && typeof prev.focus === 'function') {
        try { prev.focus({ preventScroll: true }); } catch { prev.focus(); }
      }
    };
    // Intentionally only on mount/unmount. Ref identity is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

// Exported helpers for tests.
export { findFirstFocusable, isFocusable };
