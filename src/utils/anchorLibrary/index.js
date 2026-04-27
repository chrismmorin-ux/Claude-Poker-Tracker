/**
 * anchorLibrary/index.js — Public API for Exploit Anchor Library
 *
 * Per `docs/projects/exploit-anchor-library.project.md` Phase 5 Stream E.
 * Schema: `1.1-anchor-v1.0` compound semver per `schema-delta.md` §2 + `gate4-p3-decisions.md` §1.
 * Invariants: I-EAL-1..9 per `schema-delta.md` §4; I-WR-1..7 per `WRITERS.md`.
 *
 * Commit 1 (shipped 2026-04-24): scaffold + validator + Tier 1 scenario runner + EAL-SEED-01 scenario.
 * Commit 2 (shipped 2026-04-24): 4 synthetic villains + 3 more Tier-1 scenarios (SEED-02/03/04) at schema+GTO depth.
 * Commit 3 (shipped 2026-04-24): retirement evaluator — session-close Tier-3 per anchor-retirement.md.
 * Commit 4 (shipped 2026-04-25): primitive validity — Tier-2 posterior updater + cross-anchor invalidation ripple per schema-delta §3.3.1.
 * Phase 6 B3-foundation (shipped 2026-04-25 S10): observation-tag normalizer + W-AO-1 capture writer (pure utils for Hand Replay Section G capture).
 * Commit 2.5 (upcoming): end-to-end producer wiring (replace scenario test stubs with real assumptionEngine integration).
 * Phase 6 B3-remaining (upcoming): IDB v18 migration + AnchorLibraryContext/reducer/persistence + capture modal React components.
 * Commits 5-8 (upcoming): matcher, copy generators, selectors
 * — per `src/utils/anchorLibrary/CLAUDE.md` File Responsibilities table.
 *
 * Before editing ANY file in this directory, read `CLAUDE.md`.
 */

// ───────────────────────────────────────────────────────────────────────────
// Commit 1 — validator + Tier 1 scenario runner
// ───────────────────────────────────────────────────────────────────────────

export {
  validateAnchor,
  validateAnchorObservation,
  validatePerceptionPrimitive,
  parseSchemaVersion,
  ANCHOR_SCHEMA_VERSION,
  ANCHOR_EXTENSION_VERSION,
  SUPPORTED_BASE_VERSIONS,
} from './validateAnchor';

export {
  runAnchorScenario,
  runAnchorScenarioSuite,
} from './__sim__/anchorScenarioRunner';

// ───────────────────────────────────────────────────────────────────────────
// Commit 2 — synthetic villains + 4 Tier-1 scenarios (one per seed anchor)
// ───────────────────────────────────────────────────────────────────────────

export {
  NIT_SCARE_OVERFOLD,
  LAG_TURN_XX_OVERBLUFF,
  FISH_PAIRED_OVERCALL,
  TAG_OFFSCRIPT_VALUE_READ,
  ANCHOR_SEED_VILLAINS,
} from './__sim__/syntheticVillains';

export {
  EAL_SEED_01_ANCHOR,
  nitOverfoldRiver4flushScenario,
} from './__sim__/scenarios/nitOverfoldRiver4flush';

export {
  EAL_SEED_02_ANCHOR,
  lagOverbluffRiverProbeScenario,
} from './__sim__/scenarios/lagOverbluffRiverProbe';

export {
  EAL_SEED_03_ANCHOR,
  fishOvercallTurnDoubleBarrelScenario,
} from './__sim__/scenarios/fishOvercallTurnDoubleBarrel';

export {
  EAL_SEED_04_ANCHOR,
  tagOverfoldFlopDonkScenario,
} from './__sim__/scenarios/tagOverfoldFlopDonk';

// ───────────────────────────────────────────────────────────────────────────
// Commit 3 — retirement evaluator (session-close Tier-3)
// ───────────────────────────────────────────────────────────────────────────

export {
  evaluateAnchorRetirement,
  evaluateAllAnchors,
} from './retirementEvaluator';

// ───────────────────────────────────────────────────────────────────────────
// Commit 4 — primitive validity (Tier-2 posterior + cross-anchor invalidation)
// ───────────────────────────────────────────────────────────────────────────

export {
  updatePrimitiveValidity,
  applyFiringBatch,
  evaluatePrimitiveStatus,
  computeRipple,
  rebuildDependentAnchorCount,
  PRIMITIVE_LOAD_BEARING_THRESHOLD,
  DEFAULT_PENALTY_FACTOR,
} from './primitiveValidity';

// ───────────────────────────────────────────────────────────────────────────
// Phase 6 B3 foundation — Hand Replay Section G capture utils (Session 10)
// ───────────────────────────────────────────────────────────────────────────

export {
  normalizeTag,
  normalizeTagSet,
  isFixedEnumTag,
  isCustomTag,
  classifyTags,
  hasAtLeastOneFixedTag,
  OBSERVATION_TAG_ENUM,
} from './observationTags';

export { captureObservation } from './captureObservation';
