/**
 * assumptionEngine/index.js — Public API for Exploit Deviation Assumption Engine
 *
 * Implementation per `docs/projects/exploit-deviation/architecture.md` §3.1.
 * Ruthlessly minimal public API — ≤ 6 exports. Everything else is internal.
 *
 * Schema: v1.1 per `docs/projects/exploit-deviation/schema.md`.
 * Invariants: I-AE-1 through I-AE-7 + I-AE-CIRC-1 per architecture §5.
 *
 * Commit 3 (shipped 2026-04-23): types + validator + migrations.
 * Commits 4-5 (upcoming): producer + gate + operator + suppression + calibration hooks.
 *
 * Before editing any file in this directory, read this directory's `CLAUDE.md`.
 */

// ───────────────────────────────────────────────────────────────────────────
// Primary public API
// ───────────────────────────────────────────────────────────────────────────

// Migration — runs on IDB open to upgrade legacy records to current schema.
export { migratePersistedAssumption, supportedMigrationPaths } from './migrations';

// Validator — for boundary payloads (R-10.1) + persisted-record integrity checks.
export {
  validateAssumption,
  validateExtensionPayload,
  needsMigration,
} from './validator';

// Commit 4 — assumption production + gate + operator application
export { produceAssumptions, PRODUCTION_RECIPES } from './assumptionProducer';
export { gateAssumption, determineActionability, computeComposite } from './qualityGate';
export { applyOperator, composeOperators, computeDialFromQuality } from './operator';

// Commit 5 — suppression + calibration accumulator
export {
  resolveSuppressions,
  findSuppressionCycles,
  topologicalSuppressionOrder,
  SuppressionCycleError,
} from './suppression';
export {
  createCalibrationAccumulator,
  classifyGap,
  computeTransformScale,
} from './__backtest__/calibrationAccumulator';

// ───────────────────────────────────────────────────────────────────────────
// Types + constants — re-exported so consumers can reference enums without
// reaching into assumptionTypes.js directly. These are pure-data; no behavior.
// ───────────────────────────────────────────────────────────────────────────

export {
  SCHEMA_VERSION,
  SCHEMA_VERSION_HISTORY,
  PREDICATE_KEYS,
  DEVIATION_TYPES,
  EMOTIONAL_TRIGGER_TYPES,
  ASSUMPTION_STATUS,
  STREETS,
  POSITIONS,
  TEXTURES,
  HERO_LINE_TYPES,
  VILLAIN_STYLES,
  SURFACES,
  VILLAIN_SIDE_THRESHOLDS,
  HERO_SIDE_THRESHOLDS,
  DIAL_DEFAULTS,
  CALIBRATION_LADDER,
  DEFAULT_DECAY_HALFLIFE_DAYS,
} from './assumptionTypes';

// Sub-validators — exposed for targeted testing + for callers who want to
// validate partial payloads (e.g. validate just scope before committing to
// full assumption construction).
export {
  validateScope,
  validateEvidence,
  validateStability,
  validateRecognizability,
  validateConsequence,
  validateCounterExploit,
  validateOperator,
  validateNarrative,
  validateEmotionalTrigger,
  validateQuality,
  validateClaim,
} from './validator';
