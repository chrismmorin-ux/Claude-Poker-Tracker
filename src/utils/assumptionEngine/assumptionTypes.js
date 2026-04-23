/**
 * assumptionTypes.js — Frozen enums + constants for VillainAssumption schema v1.1
 *
 * Part of the assumptionEngine module. See `CLAUDE.md` for rules (mandatory read).
 *
 * Authoritative shape: `docs/projects/exploit-deviation/schema.md` v1.1.
 *
 * Pure module — no imports, no side effects. Re-imported by validator, producer,
 * operator, suppression, migrations, and the __sim__/__backtest__ test helpers.
 *
 * Schema version history:
 *   1.0 → 1.1 (2026-04-23, Phase 2 Theory Roundtable): added resistanceConfidence,
 *          consequence.expectedDividend.sharpe, operator.suppresses, scope.activationFrequency,
 *          surface-specific actionable flags, hero-side gate profile,
 *          emotional-transform version + styleMultipliers + conservative-ceiling rule.
 *          Migration handler in `migrations.js`.
 */

export const SCHEMA_VERSION = '1.1';

export const SCHEMA_VERSION_HISTORY = Object.freeze(['1.0', '1.1']);

// ───────────────────────────────────────────────────────────────────────────
// Predicate keys — the behavioral claim types VillainAssumption can express
// ───────────────────────────────────────────────────────────────────────────

export const PREDICATE_KEYS = Object.freeze([
  'foldToCbet',
  'foldToTurnBarrel',
  'foldToRiverBet',
  'checkRaiseFrequency',
  'checkRaiseBluffFrequency',
  'cbetFrequency',
  'threeBetFrequency',
  'threeBetBluffFrequency',
  'fourBetFrequency',
  'donkFrequency',
  'thinValueFrequency',
  'slowplayFrequency',
  'overbetFrequency',
  'sizingVariance',
  'leadRangePresence',
  'wtsd',
  'foldVsOverbet',
  'foldOnScareCard',
]);

/**
 * Deprecated predicates — retained so persisted records referencing them
 * can deserialize without error. Producer will NOT emit these; validator
 * accepts them but marks status as 'retired'.
 */
export const DEPRECATED_PREDICATES = Object.freeze([]);

// ───────────────────────────────────────────────────────────────────────────
// Deviation types — what hero does when an assumption fires
// ───────────────────────────────────────────────────────────────────────────

export const DEVIATION_TYPES = Object.freeze([
  'bluff-prune',     // remove bluff combos from hero's range at node
  'value-expand',    // add thin-value combos to hero's betting range
  'sizing-shift',    // change sizing for a fixed set of combos
  'range-bet',       // eliminate check-back range
  'spot-skip',       // avoid a spot entirely (preflop fold or tighten)
  'line-change',     // switch lines (check instead of bet, etc.)
]);

// ───────────────────────────────────────────────────────────────────────────
// Emotional trigger types — state-conditional activation per schema §1.9
// ───────────────────────────────────────────────────────────────────────────

export const EMOTIONAL_TRIGGER_TYPES = Object.freeze([
  'fear-exploit',   // villain IS scared, capitalize
  'greed-exploit',  // villain IS greedy, capitalize
  'fear-blind',     // villain should be scared but isn't — deepest exploit
  'greed-blind',    // villain fails to capitalize on greed (e.g., doesn't fast-play nuts)
]);

// ───────────────────────────────────────────────────────────────────────────
// Scope-dimension enums
// ───────────────────────────────────────────────────────────────────────────

export const STREETS = Object.freeze(['preflop', 'flop', 'turn', 'river']);
export const POSITIONS = Object.freeze(['IP', 'OOP', 'any']);
export const TEXTURES = Object.freeze([
  'dry', 'wet', 'paired', 'monotone', 'flush-complete', 'straight-complete', 'any',
]);
export const HERO_LINE_TYPES = Object.freeze([
  'single-barrel', 'double-barrel', 'triple-barrel', 'donk', 'probe', 'check-raise', 'any',
]);

// ───────────────────────────────────────────────────────────────────────────
// Villain styles — consumed by emotional tilt transform + prior selection
// ───────────────────────────────────────────────────────────────────────────

export const VILLAIN_STYLES = Object.freeze(['Fish', 'Nit', 'LAG', 'TAG', 'Unknown']);

// ───────────────────────────────────────────────────────────────────────────
// Lifecycle status
// ───────────────────────────────────────────────────────────────────────────

export const ASSUMPTION_STATUS = Object.freeze([
  'candidate',  // produced but not yet qualified
  'active',     // passes gates, actionable
  'expiring',   // calibration gap exceeded 0.35 threshold; degraded rendering
  'retired',    // retired permanently; never renders
]);

// ───────────────────────────────────────────────────────────────────────────
// Surfaces — used by gate function
// ───────────────────────────────────────────────────────────────────────────

export const SURFACES = Object.freeze(['drill', 'live']);

// ───────────────────────────────────────────────────────────────────────────
// Operator targets
// ───────────────────────────────────────────────────────────────────────────

export const OPERATOR_TARGETS = Object.freeze(['villain', 'hero']);

// ───────────────────────────────────────────────────────────────────────────
// Claim operators
// ───────────────────────────────────────────────────────────────────────────

export const CLAIM_OPERATORS = Object.freeze(['<=', '>=', '==', 'in_range']);

// ───────────────────────────────────────────────────────────────────────────
// Prior types
// ───────────────────────────────────────────────────────────────────────────

export const PRIOR_TYPES = Object.freeze(['population', 'style']);

// ───────────────────────────────────────────────────────────────────────────
// Gate thresholds — schema v1.1 §7.1
// ───────────────────────────────────────────────────────────────────────────

/**
 * Villain-side gate thresholds. Drill surface is more permissive on
 * recognizability because the drill IS training the recognition pattern.
 * Live surface demands ≤ 1.5s read budget per Mid-Hand Chris.
 *
 * Units:
 *   confidence        — Bayesian posterior P(claim true | evidence)
 *   stability         — composite stability score [0, 1]
 *   recognizability   — recognizability score [0, 1]
 *   asymmetricPayoff  — bb per 100 trigger firings (§1.5 unit correction)
 *   sharpe            — mean / sd floor
 */
export const VILLAIN_SIDE_THRESHOLDS = Object.freeze({
  confidence: 0.80,
  stability: 0.70,
  recognizabilityDrill: 0.40,
  recognizabilityLive: 0.60,
  asymmetricPayoff: 0.30,
  sharpe: 1.0,
});

/**
 * Hero-side gate thresholds (schema §7.1 + CC-6 resolution).
 * Relaxed relative to villain-side because self-observation has higher noise.
 * `actionableLive` is always false for hero-side — they only render in drill.
 */
export const HERO_SIDE_THRESHOLDS = Object.freeze({
  confidence: 0.70,
  stability: 0.60,
  recognizabilityDrill: 0.50,
  asymmetricPayoff: 0.20,
  sharpe: 1.0,
});

// ───────────────────────────────────────────────────────────────────────────
// Decay half-life defaults (schema §1.2)
// ───────────────────────────────────────────────────────────────────────────

export const DEFAULT_DECAY_HALFLIFE_DAYS = Object.freeze({
  cash: 30,
  tournament: 7,
});

// ───────────────────────────────────────────────────────────────────────────
// Stability validity rules (schema §1.3 / Phase 2 Stage 2 resolution)
// ───────────────────────────────────────────────────────────────────────────

export const STABILITY_SUBSCORE_MIN_SAMPLE_SIZE = 8;
export const STABILITY_MIN_NON_NULL_SUBSCORES = 2;

// ───────────────────────────────────────────────────────────────────────────
// Dial defaults (schema §6.1)
// ───────────────────────────────────────────────────────────────────────────

export const DIAL_DEFAULTS = Object.freeze({
  dialFloor: 0.3,
  dialCeiling: 0.9,
  sigmoidSteepness: 8,  // k parameter
});

// ───────────────────────────────────────────────────────────────────────────
// Calibration ladder thresholds (calibration.md §3.3)
// ───────────────────────────────────────────────────────────────────────────

export const CALIBRATION_LADDER = Object.freeze({
  wellCalibratedGap: 0.20,       // ≤ 0.20 — no action
  targetZone: 0.25,              // 0.20–0.25 — flagged
  conservativeCeilingTrigger: 0.25, // > 0.25 — scale down emotional transform
  retirementTrigger: 0.35,       // > 0.35 — move to expiring
  retirementConsecutiveSessions: 10, // 10 consecutive sessions over trigger
});
