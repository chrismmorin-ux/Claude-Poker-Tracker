/**
 * useAnchorCardLongPress.js — long-press detector + first-run-tooltip state.
 *
 * Per `docs/design/surfaces/anchor-library.md` §"Key interactions" #3 + #4:
 *   - Long-press anywhere on an `AnchorCard` for 400ms → expand transparency panel
 *   - First-run tooltip gates on `eal:longPressTooltip:dismissed` localStorage key
 *
 * Two exports:
 *   - `useAnchorCardLongPress({ onLongPress })` — returns press handlers ready to spread
 *     onto an element. Cancels on early release, pointer-leave, pointer-cancel, and
 *     motion exceeding `MOTION_CANCEL_PX` (10px) so list-scroll doesn't accidentally
 *     trigger a panel.
 *   - `useLongPressTooltipState()` — returns `{ showTooltip, dismissTooltip }` for the
 *     `AnchorLongPressTooltip` component to render conditionally + dismiss permanently.
 *
 * Design choices established this session:
 *   (a) 400ms threshold matches iOS/Android default; faster feels accidental, slower laggy.
 *   (b) 10px motion-cancel threshold tolerates micro-jitter while cancelling clear scrolls.
 *   (c) Tooltip auto-dismisses on first successful long-press fire — "discoverable then quiet."
 *   (d) Tooltip dismissal is permanent (localStorage); not reset across sessions or app restarts.
 *   (e) Single shared tooltip key for the surface, not per-card.
 *
 * EAL Phase 6 — Session 20 (S20).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export const LONG_PRESS_THRESHOLD_MS = 400;
export const MOTION_CANCEL_PX = 10;
export const TOOLTIP_DISMISSED_KEY = 'eal:longPressTooltip:dismissed';

/**
 * Long-press detector hook.
 *
 * @param {Object} opts
 * @param {(event: PointerEvent) => void} opts.onLongPress — invoked when timer fires.
 * @param {() => void} [opts.onFire] — optional side-effect at fire time (e.g., dismiss tooltip).
 * @param {number} [opts.threshold] — override default LONG_PRESS_THRESHOLD_MS for testing.
 * @returns {{ pressHandlers: Object, isPressing: boolean }}
 */
export const useAnchorCardLongPress = ({ onLongPress, onFire, threshold } = {}) => {
  const timerRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const firedRef = useRef(false);
  const [isPressing, setIsPressing] = useState(false);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const cancelTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPressing(false);
  }, []);

  const onPointerDown = useCallback((event) => {
    if (typeof onLongPress !== 'function') return;
    // Ignore secondary buttons (right-click, middle-click). Touch events report 0.
    if (event.button !== undefined && event.button !== 0) return;

    firedRef.current = false;
    startPosRef.current = {
      x: typeof event.clientX === 'number' ? event.clientX : 0,
      y: typeof event.clientY === 'number' ? event.clientY : 0,
    };
    setIsPressing(true);

    const t = typeof threshold === 'number' && threshold > 0 ? threshold : LONG_PRESS_THRESHOLD_MS;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      timerRef.current = null;
      setIsPressing(false);
      onLongPress(event);
      if (typeof onFire === 'function') onFire();
    }, t);
  }, [onLongPress, onFire, threshold]);

  const onPointerUp = useCallback(() => {
    cancelTimer();
  }, [cancelTimer]);

  const onPointerLeave = useCallback(() => {
    cancelTimer();
  }, [cancelTimer]);

  const onPointerCancel = useCallback(() => {
    cancelTimer();
  }, [cancelTimer]);

  const onPointerMove = useCallback((event) => {
    if (!timerRef.current) return;
    const dx = (typeof event.clientX === 'number' ? event.clientX : 0) - startPosRef.current.x;
    const dy = (typeof event.clientY === 'number' ? event.clientY : 0) - startPosRef.current.y;
    if (Math.hypot(dx, dy) > MOTION_CANCEL_PX) {
      cancelTimer();
    }
  }, [cancelTimer]);

  return {
    pressHandlers: {
      onPointerDown,
      onPointerUp,
      onPointerLeave,
      onPointerCancel,
      onPointerMove,
    },
    isPressing,
  };
};

// ───────────────────────────────────────────────────────────────────────────
// First-run tooltip state
// ───────────────────────────────────────────────────────────────────────────

const readDismissed = () => {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(TOOLTIP_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
};

const writeDismissed = () => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(TOOLTIP_DISMISSED_KEY, 'true');
  } catch {
    // Quota exceeded / disabled — silently ignore. Tooltip simply re-shows next session.
  }
};

/**
 * Tooltip render-gate hook. Reads `eal:longPressTooltip:dismissed` on mount and
 * returns a setter that flips the state + persists to localStorage.
 *
 * Returns:
 *   - `showTooltip: boolean` — true on first render until dismiss
 *   - `dismissTooltip: () => void` — flips local state + writes localStorage
 *   - `hasDismissed: boolean` — informational mirror of the same flag
 */
export const useLongPressTooltipState = () => {
  const [hasDismissed, setHasDismissed] = useState(readDismissed);

  const dismissTooltip = useCallback(() => {
    writeDismissed();
    setHasDismissed(true);
  }, []);

  return {
    showTooltip: !hasDismissed,
    dismissTooltip,
    hasDismissed,
  };
};

export default useAnchorCardLongPress;
