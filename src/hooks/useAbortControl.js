/**
 * useAbortControl.js — Shared abort-counter pattern for async hooks
 *
 * Prevents stale async results from overwriting current state.
 * Each call to register() increments the counter and returns a callId.
 * isCurrent(callId) returns true only if no newer call has started.
 */

import { useRef, useCallback } from 'react';

export const useAbortControl = () => {
  const abortRef = useRef(0);

  /** Start a new async operation. Returns a callId to check later. */
  const register = useCallback(() => ++abortRef.current, []);

  /** Check if callId is still the latest operation. */
  const isCurrent = useCallback((callId) => callId === abortRef.current, []);

  /** Invalidate all pending operations (e.g., on unmount or clear). */
  const abort = useCallback(() => { abortRef.current++; }, []);

  return { register, isCurrent, abort };
};
