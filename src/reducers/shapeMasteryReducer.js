/**
 * shapeMasteryReducer.js — Shape Language mastery state management.
 *
 * SLS Stream D (2026-05-14, SPR-081 / WS-040). Persistence handled by
 * `useShapeMasteryPersistence` which dispatches HYDRATED on mount and
 * debounce-writes state changes back to IDB.
 *
 * Mirrors `anchorLibraryReducer.js` pattern (frozen ACTIONS + createValidatedReducer
 * wrapper + spread immutability + STATE_SCHEMA + INITIAL_STATE export).
 *
 * Read-only scope (this sprint) — 3 active writers:
 *   1. SHAPE_MASTERY_HYDRATED   (boot from IDB; bulk load with descriptor defaults)
 *   2. ENROLL_SHAPE_MASTERY     (Q2-A master toggle on)
 *   3. DISENROLL_SHAPE_MASTERY  (Q2-A master toggle off; data preserved per I-SM-6 docs)
 *
 * 8 deferred writers (enumerated in SHAPE_MASTERY_ACTIONS) stay as no-op
 * cases with `// TODO(WS-NEXT)` markers — pin a stable action surface so
 * the fast-follow WS only adds case bodies, not the constants.
 *
 * Binding invariants (read-side this sprint):
 *   - I-SM-1: declared and posterior never merge into a fused score.
 *   - I-SM-2: no decay-write action exists (decay is read-time only —
 *             see src/utils/skillAssessment/shapeLanguage/temporalDecay.js).
 *   - I-SM-3: writer no-op short-circuit when currentIntent === 'reference'
 *             (stub — currentIntent reading deferred until study-home reducer ships).
 *   - I-SM-7: posterior bounds α≥1, β≥1 enforced (no writer drops below).
 *   - I-SM-8: per-record schemaVersion stays attached.
 *   - I-SM-9: forbidden engagement-pressure fields never enter the shape.
 */

import {
  SHAPE_MASTERY_ACTIONS,
  SHAPE_MASTERY_STATE_SCHEMA,
  initialShapeMasteryState,
  buildDefaultDescriptorsDict,
  SHAPE_MASTERY_SCHEMA_VERSION,
} from '../constants/shapeMasteryConstants';
import { createValidatedReducer } from '../utils/reducerUtils';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Tolerant merge: when IDB returns a partial record (older schemaVersion,
 * missing descriptor entries), backfill from charter defaults. Idempotent.
 *
 * Per I-SM-8: absent or mismatched schemaVersion is a recoverable migration
 * path, not a hard error.
 */
const mergeDescriptorsWithDefaults = (loadedDescriptors) => {
  const defaults = buildDefaultDescriptorsDict();
  if (!loadedDescriptors || typeof loadedDescriptors !== 'object') {
    return defaults;
  }
  const merged = { ...defaults };
  for (const id of Object.keys(loadedDescriptors)) {
    // Only accept keys that exist in the catalog (drop unknown ids forward).
    if (id in defaults) {
      merged[id] = {
        ...defaults[id],
        ...loadedDescriptors[id],
      };
    }
  }
  return merged;
};

// =============================================================================
// RAW REDUCER
// =============================================================================

const rawShapeMasteryReducer = (state, action) => {
  switch (action.type) {
    // -------------------------------------------------------------------------
    // SHAPE_MASTERY_HYDRATED
    // Boot from IDB. Caller (useShapeMasteryPersistence) reads the singleton
    // shapeMastery record (one per user) and dispatches with its payload.
    // Missing/null payload = first-launch state (defaults applied below).
    // -------------------------------------------------------------------------
    case SHAPE_MASTERY_ACTIONS.SHAPE_MASTERY_HYDRATED: {
      const payload = action.payload || {};
      const record = payload.record || null;
      if (!record) {
        // No IDB record yet → first-launch state with charter defaults.
        return {
          ...initialShapeMasteryState,
          descriptors: buildDefaultDescriptorsDict(),
        };
      }
      return {
        enrolled: Boolean(record.enrolled),
        enrolledAt: typeof record.enrolledAt === 'number' ? record.enrolledAt : null,
        descriptors: mergeDescriptorsWithDefaults(record.descriptors),
        schemaVersion: SHAPE_MASTERY_SCHEMA_VERSION,
      };
    }

    // -------------------------------------------------------------------------
    // ENROLL_SHAPE_MASTERY
    // Q2-A verdict: master toggle on. Sets `enrolled=true` + `enrolledAt=now()`.
    // If descriptors slice is empty (first-time enroll), seed with charter
    // defaults so downstream consumers always see the 10 catalog entries.
    // -------------------------------------------------------------------------
    case SHAPE_MASTERY_ACTIONS.ENROLL_SHAPE_MASTERY: {
      const now = typeof action.payload?.now === 'number'
        ? action.payload.now
        : Date.now();
      const descriptors =
        state.descriptors && Object.keys(state.descriptors).length > 0
          ? state.descriptors
          : buildDefaultDescriptorsDict();
      return {
        ...state,
        enrolled: true,
        enrolledAt: now,
        descriptors,
      };
    }

    // -------------------------------------------------------------------------
    // DISENROLL_SHAPE_MASTERY
    // Q6 + red line #4: disenroll preserves descriptors data per I-SM-6. Only
    // `enrolled` + `enrolledAt` flip. Re-enrolling later restores access
    // without re-seeding (the Variation A default).
    // -------------------------------------------------------------------------
    case SHAPE_MASTERY_ACTIONS.DISENROLL_SHAPE_MASTERY: {
      return {
        ...state,
        enrolled: false,
        enrolledAt: null,
      };
    }

    // -------------------------------------------------------------------------
    // DEFERRED WRITERS (fast-follow WS) — no-op stubs.
    //
    // Each case returns state unchanged. The TODO marker is the contract:
    // adding a real case body must be paired with:
    //   - flipping the corresponding I-SM invariant from DOCUMENTED to ENFORCED
    //     in system/invariants.md;
    //   - adding test fixtures per shape-mastery.md Writers table.
    // -------------------------------------------------------------------------
    case SHAPE_MASTERY_ACTIONS.SEED_DESCRIPTOR_DECLARATION:
    case SHAPE_MASTERY_ACTIONS.RECORD_DRILL_OUTCOME:
    case SHAPE_MASTERY_ACTIONS.MUTE_DESCRIPTOR:
    case SHAPE_MASTERY_ACTIONS.RECORD_SKIP_DISAMBIGUATION:
    case SHAPE_MASTERY_ACTIONS.UNMUTE_DESCRIPTOR:
    case SHAPE_MASTERY_ACTIONS.RECALIBRATE_DESCRIPTOR:
    case SHAPE_MASTERY_ACTIONS.RESET_SHAPE_MASTERY:
    case SHAPE_MASTERY_ACTIONS.TOGGLE_SESSION_INCOGNITO: {
      // TODO(WS-NEXT): wire fast-follow per shape-mastery.md Writers table.
      return state;
    }

    default:
      return state;
  }
};

// =============================================================================
// VALIDATED REDUCER (export this)
// =============================================================================

export const shapeMasteryReducer = createValidatedReducer(
  rawShapeMasteryReducer,
  SHAPE_MASTERY_STATE_SCHEMA,
  'shapeMasteryReducer',
);

// Re-export for AppRoot useReducer call
export { initialShapeMasteryState };
