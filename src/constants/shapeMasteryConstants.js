/**
 * shapeMasteryConstants.js — Constants for the Shape Language mastery state.
 *
 * SLS Stream D (2026-05-14, SPR-081 / WS-040). Canonical shape per
 * `docs/design/contracts/shape-mastery.md` (ratified at SLS Gate 3 + 4).
 * Q1-Q7 verdicts at `docs/projects/poker-shape-language/gate3-decision-memo.md`.
 *
 * Pure data; no behavior. Consumers in `src/utils/skillAssessment/shapeLanguage/`,
 * `src/reducers/shapeMasteryReducer.js`, and the ShapeSkillMapPanel surface
 * import from here for single-source-of-truth.
 *
 * Read-only scope (sprint SPR-081): 3 writers shipped (HYDRATED, ENROLL,
 * DISENROLL). The remaining 7 writer action types are enumerated below as
 * TODO so the reducer surface is stable, but their reducer cases stay no-op
 * pending the fast-follow WS that wires recovery affordances + drill writes.
 *
 * Mirrors `anchorLibraryConstants.js` shape (frozen ACTIONS + state schema +
 * INITIAL_STATE export).
 */

// ───────────────────────────────────────────────────────────────────────────
// Descriptor catalog (Gate 2 / Product-UX voice — canonical 10)
// ───────────────────────────────────────────────────────────────────────────

/**
 * The 10 Shape Language descriptors in canonical catalog order. Order is
 * load-bearing for the ShapeSkillMapPanel rendering + enrollment-journey
 * sequence + Discover-mode seeder tie-breaker per
 * `docs/projects/poker-shape-language/roundtable.md`.
 *
 * IDs are kebab-case-lowercase. Display names live with the surface code
 * (per `feedback_long_term_over_transition.md` — copy belongs near the
 * render, not in constants).
 *
 * Source enumeration: `docs/projects/poker-shape-language/gate2-voices/01-product-ux.md`
 * line 3.
 */
export const SHAPE_DESCRIPTOR_CATALOG = Object.freeze([
  Object.freeze({ id: 'silhouette',            displayName: 'Silhouette' }),
  Object.freeze({ id: 'equity-distribution-curve', displayName: 'Equity-Distribution Curve' }),
  Object.freeze({ id: 'spire-polarization',    displayName: 'Spire + Polarization' }),
  Object.freeze({ id: 'sizing-curve-tag',      displayName: 'Sizing Curve Tag' }),
  Object.freeze({ id: 'saddle',                displayName: 'Saddle' }),
  Object.freeze({ id: 'basin-sankey',          displayName: 'Basin + Sankey' }),
  Object.freeze({ id: 'ridgeline-ribbon',      displayName: 'Ridgeline + Ribbon' }),
  Object.freeze({ id: 'contour-tree',          displayName: 'Contour Tree' }),
  Object.freeze({ id: 'equity-basin-map',      displayName: 'Equity Basin Map' }),
  Object.freeze({ id: 'hand-trajectory',       displayName: 'Hand Trajectory' }),
]);

/**
 * Frozen array of just the IDs, in catalog order. Useful for iteration that
 * doesn't need display names.
 */
export const SHAPE_DESCRIPTOR_IDS = Object.freeze(
  SHAPE_DESCRIPTOR_CATALOG.map((d) => d.id),
);

/**
 * Set form for fast `has()` lookups (input validation, etc.).
 */
export const SHAPE_DESCRIPTOR_ID_SET = new Set(SHAPE_DESCRIPTOR_IDS);

// ───────────────────────────────────────────────────────────────────────────
// Action types — read-only scope (SPR-081)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Reducer action types for `shapeMasteryReducer`. Frozen to prevent runtime
 * mutation. Mirrors `ANCHOR_LIBRARY_ACTIONS` shape.
 *
 * Read-only scope (this sprint) — 3 active writers:
 *   - SHAPE_MASTERY_HYDRATED      (boot from IDB; bulk load)
 *   - ENROLL_SHAPE_MASTERY        (Q2 master toggle on)
 *   - DISENROLL_SHAPE_MASTERY     (Q2 master toggle off; data preserved per I-SM-6)
 *
 * Deferred to fast-follow WS — enumerated for completeness, but the reducer
 * leaves these cases as no-op + `// TODO(WS-NEXT)` markers:
 *   - SEED_DESCRIPTOR_DECLARATION (Q7 enrollment-journey seed)
 *   - RECORD_DRILL_OUTCOME        (lesson-runner drill completion)
 *   - MUTE_DESCRIPTOR             ("Mark as already known")
 *   - RECORD_SKIP_DISAMBIGUATION  (skip "already know / not today" picker)
 *   - UNMUTE_DESCRIPTOR           (transparency-screen unmute)
 *   - RECALIBRATE_DESCRIPTOR      (transparency-screen recalibrate)
 *   - RESET_SHAPE_MASTERY         (footer "Start fresh")
 *   - TOGGLE_SESSION_INCOGNITO    (incognito toggle)
 */
export const SHAPE_MASTERY_ACTIONS = Object.freeze({
  // Read-only scope (SPR-081) — 3 active
  SHAPE_MASTERY_HYDRATED: 'SHAPE_MASTERY_HYDRATED',
  ENROLL_SHAPE_MASTERY: 'ENROLL_SHAPE_MASTERY',
  DISENROLL_SHAPE_MASTERY: 'DISENROLL_SHAPE_MASTERY',

  // Deferred (fast-follow WS) — enumerated; reducer cases are no-op + TODO
  SEED_DESCRIPTOR_DECLARATION: 'SEED_DESCRIPTOR_DECLARATION',
  RECORD_DRILL_OUTCOME: 'RECORD_DRILL_OUTCOME',
  MUTE_DESCRIPTOR: 'MUTE_DESCRIPTOR',
  RECORD_SKIP_DISAMBIGUATION: 'RECORD_SKIP_DISAMBIGUATION',
  UNMUTE_DESCRIPTOR: 'UNMUTE_DESCRIPTOR',
  RECALIBRATE_DESCRIPTOR: 'RECALIBRATE_DESCRIPTOR',
  RESET_SHAPE_MASTERY: 'RESET_SHAPE_MASTERY',
  TOGGLE_SESSION_INCOGNITO: 'TOGGLE_SESSION_INCOGNITO',
});

/**
 * Set of action types that the reducer ACTIVELY HANDLES this sprint.
 * Used by tests + the I-SM-2 forbidden-action grep (no `APPLY_DECAY` etc).
 */
export const SHAPE_MASTERY_ACTIVE_WRITERS = Object.freeze([
  SHAPE_MASTERY_ACTIONS.SHAPE_MASTERY_HYDRATED,
  SHAPE_MASTERY_ACTIONS.ENROLL_SHAPE_MASTERY,
  SHAPE_MASTERY_ACTIONS.DISENROLL_SHAPE_MASTERY,
]);

// ───────────────────────────────────────────────────────────────────────────
// User-mute states (I-SM Writers table — `userMuteState`)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Per-descriptor mute state per Q2 verdict (hybrid master + per-descriptor mute).
 * 'not-interested' is transient (cleared on next session); 'already-known' is
 * durable until explicit Unmute. Read-only sprint emits 'none' on enrollment.
 */
export const USER_MUTE_STATES = Object.freeze({
  NONE: 'none',
  ALREADY_KNOWN: 'already-known',
  NOT_INTERESTED: 'not-interested',
});

export const VALID_USER_MUTE_STATES = Object.freeze([
  USER_MUTE_STATES.NONE,
  USER_MUTE_STATES.ALREADY_KNOWN,
  USER_MUTE_STATES.NOT_INTERESTED,
]);

// ───────────────────────────────────────────────────────────────────────────
// Declared-level states (Q4 verdict — declared vs data axis separation)
// ───────────────────────────────────────────────────────────────────────────

/**
 * `declaredLevel` — user-asserted signal kept SEPARATE from posterior per
 * I-SM-1. `null` = user has not declared. Read-only sprint never writes
 * 'known' or 'unknown' (those flip via the deferred SEED + SKIP_DISAMB
 * writers in fast-follow).
 */
export const DECLARED_LEVELS = Object.freeze({
  KNOWN: 'known',
  UNKNOWN: 'unknown',
});

export const VALID_DECLARED_LEVELS = Object.freeze([
  DECLARED_LEVELS.KNOWN,
  DECLARED_LEVELS.UNKNOWN,
  null,
]);

// ───────────────────────────────────────────────────────────────────────────
// Schema-version constants (I-SM-8 per-record schemaVersion)
// ───────────────────────────────────────────────────────────────────────────

/**
 * DescriptorMastery schemaVersion. Bumps on shape change. Per-record
 * (I-SM-8) — storage layer migrates absent or mismatched values forward
 * on read rather than hard-erroring.
 */
export const DESCRIPTOR_MASTERY_SCHEMA_VERSION = 1;

/**
 * Top-level ShapeMasteryState schemaVersion. Mirrors per-record convention.
 */
export const SHAPE_MASTERY_SCHEMA_VERSION = '1.0.0';

// ───────────────────────────────────────────────────────────────────────────
// Forbidden field names (I-SM-9 engagement-pressure guard)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Fields whose ONLY purpose is engagement-pressure framing — banned from
 * ShapeMasteryState / DescriptorMastery shapes per Gate 2 red line #5.
 * Tested via the I-SM-9 forbidden-field grep in reducer tests + panel tests.
 *
 * Note: `lastInteractedAt` is allowed (welcome-back gate, one-time banner)
 * but must never render as a streak counter.
 */
export const FORBIDDEN_MASTERY_FIELDS = Object.freeze([
  'currentStreak',
  'longestStreak',
  'daysActive',
  'consecutiveCorrectCount',
  'streakCount',
]);

/**
 * Forbidden composite/fused-score field names per I-SM-1 (separation of
 * signals — declared and posterior never merge into a single number).
 */
export const FORBIDDEN_FUSED_FIELDS = Object.freeze([
  'masteryScore',
  'fusedMastery',
  'confidenceLevel',
]);

// ───────────────────────────────────────────────────────────────────────────
// Default per-descriptor record + initial state
// ───────────────────────────────────────────────────────────────────────────

/**
 * Charter-default DescriptorMastery for an unseeded descriptor. Posterior
 * α=1/β=1 = uniform Beta = "no observations yet" per Bayesian convention +
 * I-SM-7 lower bound.
 */
export const defaultDescriptorMastery = () => Object.freeze({
  posterior: Object.freeze({ alpha: 1, beta: 1 }),
  declaredLevel: null,
  userMuteState: USER_MUTE_STATES.NONE,
  mutedAt: null,
  lastValidatedAt: null,
  lastInteractedAt: null,
  schemaVersion: DESCRIPTOR_MASTERY_SCHEMA_VERSION,
});

/**
 * Build a fresh `descriptors` dict from the catalog with charter defaults.
 * Called by HYDRATED when IDB returns no shapeMastery record.
 */
export const buildDefaultDescriptorsDict = () => {
  const dict = {};
  for (const { id } of SHAPE_DESCRIPTOR_CATALOG) {
    dict[id] = defaultDescriptorMastery();
  }
  return dict;
};

/**
 * Reducer initial state. Per Q2 verdict: enrollment defaults to off
 * (red line #1 — owner must explicitly enable).
 */
export const initialShapeMasteryState = Object.freeze({
  enrolled: false,
  enrolledAt: null,
  descriptors: Object.freeze({}),
  schemaVersion: SHAPE_MASTERY_SCHEMA_VERSION,
});

/**
 * Validation schema for `createValidatedReducer`. Top-level keys only
 * (createValidatedReducer doesn't support nested validation; per anchor
 * library precedent).
 */
export const SHAPE_MASTERY_STATE_SCHEMA = Object.freeze({
  enrolled: { type: 'boolean' },
  enrolledAt: {},
  descriptors: { type: 'object' },
  schemaVersion: { type: 'string' },
});
