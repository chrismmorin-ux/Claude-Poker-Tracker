/**
 * useAnchorObservationCapture.js — Orchestrator hook for the capture flow
 *
 * Composes the AnchorLibrary context + the per-hand draft sidecar into one
 * surface that the AnchorObservationModal (S16) consumes. Owns the modal
 * open/close state, runs Save through the W-AO-1 pure writer
 * (`captureObservation`), dispatches OBSERVATION_CAPTURED + DRAFT_CLEARED on
 * success, and dispatches DRAFT_CLEARED on Discard.
 *
 * EAL Phase 6 Stream D B3 — Session 15 (2026-04-27).
 *
 * Behavioral contract (per `docs/design/surfaces/hand-replay-observation-capture.md`):
 *   - **openCapture** sets isOpen=true. Existing draft (if any) is already
 *     readable via `draft` from the composed `useAnchorObservationDraft`;
 *     the modal's resume-banner consumes it directly.
 *   - **closeCapture** sets isOpen=false WITHOUT clearing the draft —
 *     "Keep draft for later" is the implicit default for plain close. The
 *     modal's Cancel-with-dirty-draft confirm sheet calls `discard()` for
 *     the explicit-discard path.
 *   - **save(input)** runs `captureObservation` pure-util; on ok, dispatches
 *     OBSERVATION_CAPTURED then DRAFT_CLEARED (two separate actions —
 *     persistence hook will batch the IDB writes within its 400ms cycle).
 *     Returns the writer's `{ ok, record }` or `{ ok: false, errors }` so
 *     the modal can route to toast / inline-error UI.
 *   - **discard()** dispatches DRAFT_CLEARED + closes modal. No
 *     OBSERVATION_CAPTURED is fired.
 *
 * Design choices:
 *   - **Two-action save** (not a single fused action) — mirrors S12 capture-modal
 *     two-transaction discipline. If the OBSERVATION_CAPTURED dispatch reduces
 *     fine but the DRAFT_CLEARED somehow fails (it can't, but defensively),
 *     the worst case is a stale draft alongside a saved observation, which the
 *     next openCapture's resume-banner handles gracefully (showing "Resume
 *     draft from earlier?" — owner can discard to clean up).
 *   - **Save does not auto-close the modal.** Caller (modal) decides when to
 *     close based on writer outcome — toast confirmation pattern needs the
 *     modal to remain mounted briefly, OR the modal closes and the toast
 *     fires from a parent. Caller-controlled.
 *   - **Errors are returned, not thrown.** Validation errors from the W-AO-1
 *     writer are aggregated as a string array; modal renders them inline.
 */

import { useCallback, useState } from 'react';
import { useAnchorLibrary } from '../contexts/AnchorLibraryContext';
import { useAnchorObservationDraft } from './useAnchorObservationDraft';
import { captureObservation } from '../utils/anchorLibrary/captureObservation';
import { ANCHOR_LIBRARY_ACTIONS } from '../constants/anchorLibraryConstants';

/**
 * @typedef {Object} UseAnchorObservationCaptureOptions
 * @property {string} handId                 — required; hand being tagged
 * @property {number} [observationIndex=0]   — for deterministic id obs:<handId>:<idx>
 * @property {() => string} [nowFn]          — injected timestamp source (test-friendly)
 */

/**
 * @typedef {Object} UseAnchorObservationCaptureReturn
 * @property {boolean} isOpen                — true while modal is mounted
 * @property {() => void} openCapture        — set isOpen=true
 * @property {() => void} closeCapture       — set isOpen=false (preserves draft)
 * @property {Object|null} draft             — current persisted draft (re-exported)
 * @property {boolean} hasDraft              — true if a draft exists for this hand
 * @property {(partial: object) => void} updateDraft  — debounced DRAFT_UPDATED (re-exported)
 * @property {(input: object) => {ok: true, record: object} | {ok: false, errors: string[]}} save
 *           — runs captureObservation pure-util; on ok, dispatches
 *             OBSERVATION_CAPTURED + DRAFT_CLEARED. Returns the writer outcome.
 * @property {() => void} discard            — dispatches DRAFT_CLEARED + closes modal
 * @property {boolean} isEnrolled            — true when global enrollment === 'enrolled'
 */

/**
 * useAnchorObservationCapture
 *
 * @param {UseAnchorObservationCaptureOptions} options
 * @returns {UseAnchorObservationCaptureReturn}
 */
export const useAnchorObservationCapture = (options) => {
  const { handId, observationIndex = 0, nowFn } = options || {};
  const { dispatchAnchorLibrary, enrollment, isEnrolled } = useAnchorLibrary();
  const draftHook = useAnchorObservationDraft(handId);

  const [isOpen, setIsOpen] = useState(false);

  const openCapture = useCallback(() => setIsOpen(true), []);
  const closeCapture = useCallback(() => setIsOpen(false), []);

  /**
   * Run the W-AO-1 pure writer. On success, dispatch OBSERVATION_CAPTURED
   * then DRAFT_CLEARED so the persistence layer round-trips the canonical
   * record + cleans up the draft.
   *
   * @param {object} input — modal field values: { ownerTags, note?, streetKey?, actionIndex?, contributesToCalibration? }
   * @returns {{ok: true, record: object} | {ok: false, errors: string[]}}
   */
  const save = useCallback(
    (input) => {
      if (!handId) {
        return { ok: false, errors: ['handId is required'] };
      }
      const enrollmentState = enrollment?.observation_enrollment_state || 'not-enrolled';
      const result = captureObservation(
        { ...(input || {}), handId, observationIndex },
        { observation_enrollment_state: enrollmentState, nowFn },
      );
      if (!result.ok) return result;

      dispatchAnchorLibrary({
        type: ANCHOR_LIBRARY_ACTIONS.OBSERVATION_CAPTURED,
        payload: { observation: result.record },
      });
      dispatchAnchorLibrary({
        type: ANCHOR_LIBRARY_ACTIONS.DRAFT_CLEARED,
        payload: { handId },
      });

      return result;
    },
    [handId, observationIndex, nowFn, enrollment, dispatchAnchorLibrary],
  );

  /**
   * Explicit-discard path. Dispatches DRAFT_CLEARED + closes modal. The
   * modal's "Cancel + Discard draft" confirm sheet calls this; plain
   * closeCapture() does NOT (preserves draft for later).
   */
  const discard = useCallback(() => {
    draftHook.clearDraft();
    setIsOpen(false);
  }, [draftHook]);

  return {
    isOpen,
    openCapture,
    closeCapture,
    draft: draftHook.draft,
    hasDraft: draftHook.hasDraft,
    updateDraft: draftHook.updateDraft,
    save,
    discard,
    isEnrolled: typeof isEnrolled === 'function' ? isEnrolled() : Boolean(isEnrolled),
  };
};
