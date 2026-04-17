/**
 * usePlayerDraft.js — Draft autosave / resume / discard (PEO-1)
 *
 * Thin wrapper around draftsStorage with debounced autosave semantics.
 *
 * Public API:
 *   {
 *     draft,                // latest loaded draft record or null
 *     isLoading,            // true during initial load
 *     saveDraft(fields, seatContext?),    // debounced 500 ms autosave
 *     flushDraft(fields, seatContext?),   // immediate write (blur, nav-away)
 *     resumeDraft(),        // returns the stored draft payload (or null)
 *     discardDraft(),       // deletes the draft
 *   }
 *
 * Invariant I-PEO-1: only one draft per userId at a time. The storage layer
 * enforces the single-key invariant; this hook never creates a duplicate.
 *
 * Autosave cadence: 500 ms debounce on saveDraft. flushDraft is unconditional
 * and bypasses the timer — use for blur, navigation-away, and any explicit
 * "finalize pending edits" moment.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getDraft,
  putDraft,
  deleteDraft,
  GUEST_USER_ID,
} from '../utils/persistence';

const DEFAULT_DEBOUNCE_MS = 500;

export const usePlayerDraft = (userId = GUEST_USER_ID, options = {}) => {
  const { debounceMs = DEFAULT_DEBOUNCE_MS } = options;

  const [draft, setDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const timerRef = useRef(null);
  const pendingRef = useRef(null); // { fields, seatContext }
  const mountedRef = useRef(true);

  // ---- initial load ------------------------------------------------------
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    setIsLoading(true);
    getDraft(userId).then((record) => {
      if (cancelled || !mountedRef.current) return;
      setDraft(record || null);
      setIsLoading(false);
    }).catch(() => {
      if (cancelled || !mountedRef.current) return;
      setDraft(null);
      setIsLoading(false);
    });
    return () => { cancelled = true; mountedRef.current = false; };
  }, [userId]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ---- actual persistence call ------------------------------------------
  const persist = useCallback(async (fields, seatContext) => {
    try {
      await putDraft(userId, fields, seatContext);
      if (!mountedRef.current) return;
      const record = {
        userId,
        draft: fields || null,
        seatContext: seatContext || null,
        updatedAt: Date.now(),
      };
      setDraft(record);
    } catch {
      // Autosave failures are silent-by-design per plan §D5; the next
      // saveDraft / flushDraft retries.
    }
  }, [userId]);

  // ---- debounced autosave -----------------------------------------------
  const saveDraft = useCallback((fields, seatContext = null) => {
    pendingRef.current = { fields, seatContext };
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) persist(pending.fields, pending.seatContext);
    }, debounceMs);
  }, [clearTimer, debounceMs, persist]);

  // ---- immediate flush ---------------------------------------------------
  const flushDraft = useCallback(async (fields, seatContext = null) => {
    clearTimer();
    // If an argument pair is supplied, use it; otherwise flush whatever is
    // pending from the last saveDraft call.
    const toPersist = (fields === undefined)
      ? pendingRef.current
      : { fields, seatContext };
    pendingRef.current = null;
    if (!toPersist) return;
    await persist(toPersist.fields, toPersist.seatContext);
  }, [clearTimer, persist]);

  // ---- resume ------------------------------------------------------------
  const resumeDraft = useCallback(async () => {
    const record = await getDraft(userId);
    if (mountedRef.current) setDraft(record || null);
    return record?.draft || null;
  }, [userId]);

  // ---- discard -----------------------------------------------------------
  const discardDraft = useCallback(async () => {
    clearTimer();
    pendingRef.current = null;
    await deleteDraft(userId);
    if (mountedRef.current) setDraft(null);
  }, [clearTimer, userId]);

  // ---- cleanup: flush on unmount ----------------------------------------
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      // Best-effort: if a debounce is pending, persist it before the component
      // is torn down. Do not await — unmount must not block.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending) {
          putDraft(userId, pending.fields, pending.seatContext).catch(() => {});
        }
      }
    };
  }, [userId]);

  return {
    draft,
    isLoading,
    saveDraft,
    flushDraft,
    resumeDraft,
    discardDraft,
  };
};
