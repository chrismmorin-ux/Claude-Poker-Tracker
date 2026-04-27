/**
 * anchorLibraryConstants.js — Constants for the Exploit Anchor Library
 *
 * Per `docs/projects/exploit-anchor-library/schema-delta.md` §3.1.1 (tag vocabulary)
 * + `gate4-p3-decisions.md` §5 (newcomer hand-threshold) + I-EAL-8 (note 280-char cap).
 *
 * Pure data; no behavior. Consumers in `src/utils/anchorLibrary/` and surface
 * components import from here for single-source-of-truth.
 */

// ───────────────────────────────────────────────────────────────────────────
// Observation tag vocabulary (schema-delta §3.1.1)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Eight fixed-enum tag seeds for `AnchorObservation.ownerTags`. Owner picks ≥1
 * from this list at capture time; optional free-text custom tags supplement
 * (normalized to kebab-case at write).
 *
 * Frozen array — order is canonical for UI rendering.
 */
export const OBSERVATION_TAG_ENUM = Object.freeze([
  'villain-overfold',
  'villain-overbluff',
  'villain-overcall',
  'hero-overfolded',
  'unusual-sizing',
  'perception-gap',
  'style-mismatch',
  'session-context',
]);

/**
 * Set form for fast `has()` lookups.
 */
export const OBSERVATION_TAG_ENUM_SET = new Set(OBSERVATION_TAG_ENUM);

// ───────────────────────────────────────────────────────────────────────────
// Length / count caps
// ───────────────────────────────────────────────────────────────────────────

/**
 * Hard limit on `AnchorObservation.note` length per I-EAL-8 (schema-delta §4).
 * Soft-enforced at UI; hard-enforced at writer (`captureObservation.js`).
 */
export const NOTE_MAX_LENGTH = 280;

/**
 * Soft limit on custom (non-enum) tags per observation. UI prevents adding
 * more; writer does not enforce (any tag count is schema-valid).
 */
export const CUSTOM_TAG_SOFT_MAX = 5;

/**
 * Hard limit on individual tag length (kebab-case-lowercase). Custom tags
 * exceeding this are rejected at the normalizer.
 */
export const TAG_MAX_LENGTH = 60;

// ───────────────────────────────────────────────────────────────────────────
// Newcomer unlock threshold (gate4-p3-decisions.md §5)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Number of hands the owner must have seen before the Anchor Library surface
 * unlocks. Per `gate4-p3-decisions.md` §5: 25 hands chosen with 3-thread
 * rationale (SLS inheritance + anchor calibration minimum + cognitive load).
 *
 * Editable post-ship. Hard cutoff (not gradual unlock).
 */
export const ANCHOR_LIBRARY_UNLOCK_THRESHOLD = 25;

// ───────────────────────────────────────────────────────────────────────────
// Observation origin (schema-delta + WRITERS.md)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Two valid origins for `AnchorObservation.origin` per WRITERS.md §W-AO-1
 * (owner-captured) + §W-AO-2 (matcher-system-generated). AP-08 signal
 * separation is enforced at this level — these are categorically different
 * data sources and never numerically combined.
 */
export const OBSERVATION_ORIGINS = Object.freeze({
  OWNER_CAPTURED: 'owner-captured',
  MATCHER_SYSTEM: 'matcher-system',
});

// ───────────────────────────────────────────────────────────────────────────
// Schema-version constants (mirror of validateAnchor.js — kept for callers
// that need them without importing the validator)
// ───────────────────────────────────────────────────────────────────────────

/**
 * AnchorObservation schemaVersion — per schema-delta §3.1.
 */
export const ANCHOR_OBSERVATION_SCHEMA_VERSION = 'anchor-obs-v1.0';

// ───────────────────────────────────────────────────────────────────────────
// Reducer constants (Phase 6 Stream D B3 — Session 13)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Reducer action types for `anchorLibraryReducer`. Frozen to prevent runtime
 * mutation. Mirrors `ENTITLEMENT_ACTIONS` shape from MPMF S9 G5-B1.
 *
 * Eight actions covering the full anchor library lifecycle:
 *   - Hydration:        ANCHOR_LIBRARY_HYDRATED (boot from IDB; bulk load)
 *   - Observation:      OBSERVATION_CAPTURED, OBSERVATION_DELETED
 *   - Draft sidecar:    DRAFT_UPDATED, DRAFT_CLEARED
 *   - Anchor lifecycle: ANCHOR_OVERRIDDEN (W-EA-3 status/operator update)
 *   - Primitives:       PRIMITIVE_VALIDITY_UPDATED (W-PP-2 Tier-2 update)
 *   - Settings:         ENROLLMENT_TOGGLED (Q1-A global toggle)
 */
export const ANCHOR_LIBRARY_ACTIONS = Object.freeze({
  // Hydration
  ANCHOR_LIBRARY_HYDRATED: 'ANCHOR_LIBRARY_HYDRATED',

  // Observation lifecycle (W-AO-1 capture; Anchor Library surface delete)
  OBSERVATION_CAPTURED: 'OBSERVATION_CAPTURED',
  OBSERVATION_DELETED: 'OBSERVATION_DELETED',

  // Draft sidecar (capture-modal debounced edits + cleanup)
  DRAFT_UPDATED: 'DRAFT_UPDATED',
  DRAFT_CLEARED: 'DRAFT_CLEARED',

  // Anchor lifecycle (W-EA-3 study override + retirement)
  ANCHOR_OVERRIDDEN: 'ANCHOR_OVERRIDDEN',

  // Primitive validity (W-PP-2 Tier-2 update + cross-anchor invalidation)
  PRIMITIVE_VALIDITY_UPDATED: 'PRIMITIVE_VALIDITY_UPDATED',

  // Settings — Q1-A global enrollment toggle
  ENROLLMENT_TOGGLED: 'ENROLLMENT_TOGGLED',
});

/**
 * Valid `observation_enrollment_state` values per `chris-live-player.md`
 * §Observation-capture attribute + Q1-A verdict.
 */
export const ENROLLMENT_STATES = Object.freeze({
  ENROLLED: 'enrolled',
  NOT_ENROLLED: 'not-enrolled',
});

export const VALID_ENROLLMENT_STATES = Object.freeze([
  ENROLLMENT_STATES.ENROLLED,
  ENROLLMENT_STATES.NOT_ENROLLED,
]);

/**
 * Reducer initial state. Per Q1-A verdict: enrollment defaults to off
 * (red line #1 opt-in required — owner must explicitly enroll).
 *
 * State shape — dictionaries keyed by id for O(1) lookup + O(N) iteration:
 *   anchors:       { [id]: ExploitAnchor }
 *   observations:  { [id]: AnchorObservation }
 *   drafts:        { [draft:<handId>]: AnchorObservationDraft }
 *   primitives:    { [PP-NN]: PerceptionPrimitive }
 *   enrollment:    { observation_enrollment_state: 'enrolled' | 'not-enrolled' }
 *   schemaVersion: '1.0.0'
 */
export const initialAnchorLibraryState = Object.freeze({
  anchors: Object.freeze({}),
  observations: Object.freeze({}),
  drafts: Object.freeze({}),
  primitives: Object.freeze({}),
  enrollment: Object.freeze({
    observation_enrollment_state: ENROLLMENT_STATES.NOT_ENROLLED,
  }),
  schemaVersion: '1.0.0',
});

/**
 * Validation schema for `createValidatedReducer`. Top-level keys only
 * (SCHEMA_RULES doesn't support nested validation; per MPMF precedent).
 */
export const ANCHOR_LIBRARY_STATE_SCHEMA = Object.freeze({
  anchors: { type: 'object' },
  observations: { type: 'object' },
  drafts: { type: 'object' },
  primitives: { type: 'object' },
  enrollment: { type: 'object' },
  schemaVersion: { type: 'string' },
});
