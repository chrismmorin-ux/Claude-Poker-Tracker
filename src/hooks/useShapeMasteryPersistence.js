/**
 * useShapeMasteryPersistence.js — IDB persistence for Shape Language mastery state.
 *
 * SLS Stream D (2026-05-14, SPR-081 / WS-040). Mirrors
 * `useAnchorLibraryPersistence.js` pattern — receives `state` + `dispatch` as
 * params (composed from inside ShapeMasteryProvider).
 *
 * Hydration strategy (read-only sprint):
 *   - Single `getShapeMastery(userId)` call on mount.
 *   - Single `SHAPE_MASTERY_HYDRATED` dispatch with the loaded record (or null
 *     for first-launch — reducer seeds charter defaults in that case).
 *   - Lesson completions are NOT loaded into reducer state this sprint (the
 *     reducer doesn't hold completion history; consumers query the store
 *     directly via `listLessonCompletions`).
 *
 * Write strategy:
 *   - 400ms debounce per state change (mirrors anchor-library + entitlement
 *     conventions).
 *   - On every debounce fire, write the full shapeMastery singleton via
 *     `putShapeMastery`. Singleton-write is cheap; per-field diff is
 *     unnecessary at expected scale (10 descriptors).
 *   - Lesson-completion writes happen at the `RECORD_DRILL_OUTCOME` writer
 *     scope (deferred to fast-follow WS) — this hook doesn't proxy those.
 *
 * First-launch contract:
 *   - If IDB returns null, dispatch HYDRATED with `{record: null}` so the
 *     reducer seeds defaults. Do NOT write back immediately — wait for the
 *     first user action (ENROLL_SHAPE_MASTERY) to land a real record. This
 *     keeps the store empty for users who never enable the feature.
 */

import { useEffect, useRef, useState } from 'react';
import { getShapeMastery, putShapeMastery } from '../utils/persistence/shapeMasteryStorage';
import { SHAPE_MASTERY_ACTIONS } from '../constants/shapeMasteryConstants';
import { GUEST_USER_ID } from '../constants/authConstants';

const WRITE_DEBOUNCE_MS = 400;

/**
 * useShapeMasteryPersistence
 *
 * @param {Object} state — State from shapeMasteryReducer.
 * @param {Function} dispatch — Dispatcher for shape mastery actions.
 * @param {Object} [options]
 * @param {string} [options.userId] — Override userId (defaults to GUEST_USER_ID).
 * @returns {{ isReady: boolean }}
 */
export const useShapeMasteryPersistence = (state, dispatch, options = {}) => {
  const userId = options.userId || GUEST_USER_ID;
  const [isReady, setIsReady] = useState(false);
  const writeTimerRef = useRef(null);
  const hasHydratedRef = useRef(false);
  const prevStateRef = useRef(null);

  // ==========================================================================
  // HYDRATION (on mount)
  // ==========================================================================

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const record = await getShapeMastery(userId);
        if (cancelled) return;
        dispatch({
          type: SHAPE_MASTERY_ACTIONS.SHAPE_MASTERY_HYDRATED,
          payload: { record },
        });
        hasHydratedRef.current = true;
        setIsReady(true);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[useShapeMasteryPersistence] hydration failed:', error);
        // Continue with default empty state. App remains usable.
        hasHydratedRef.current = true;
        setIsReady(true);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [dispatch, userId]);

  // ==========================================================================
  // DEBOUNCED WRITE on state change
  // ==========================================================================

  useEffect(() => {
    // Skip writes until hydration completes (avoids overwriting IDB with
    // empty defaults before the actual record loads).
    if (!hasHydratedRef.current) {
      prevStateRef.current = state;
      return;
    }

    // First-launch guard: never write a "default + not-enrolled" record on
    // mount. Wait for the first real state change (enrolled flip or descriptor
    // mutation in fast-follow). prevStateRef === null means this is the first
    // effect run after hydration.
    if (prevStateRef.current === null) {
      prevStateRef.current = state;
      return;
    }

    // Skip if reference equality holds — no actual change.
    if (prevStateRef.current === state) {
      return;
    }

    if (writeTimerRef.current) {
      clearTimeout(writeTimerRef.current);
    }

    prevStateRef.current = state;

    writeTimerRef.current = setTimeout(async () => {
      try {
        // Singleton write — full record. userId attached via keyPath.
        const record = {
          userId,
          enrolled: state.enrolled,
          enrolledAt: state.enrolledAt,
          descriptors: state.descriptors,
          schemaVersion: state.schemaVersion,
        };
        await putShapeMastery(record);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[useShapeMasteryPersistence] persistence write failed:', error);
      }
    }, WRITE_DEBOUNCE_MS);

    return () => {
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current);
      }
    };
  }, [state, userId]);

  return { isReady };
};
