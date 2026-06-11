/**
 * anchorPredicates.js — Anchor-owned predicate registry (WS-218 / DEC pending)
 *
 * ExploitAnchor claims may use predicates that the assumption engine does NOT
 * produce. Per the founder-ratified WS-218 decision (2026-06-11), those
 * predicates live HERE — not in assumptionEngine PREDICATE_KEYS — because the
 * parent enum carries a binding CI discipline (assumptionTypes entry +
 * producer recipe + narrative + Tier-1 scenario, see assumptionEngine/CLAUDE.md
 * "DO NOT add a predicate without a Tier-1 scenario") designed for predicates
 * the producer EMITS from villainTendency.observedRates. Anchor predicates are
 * authored per-anchor, are not producer-emitted, and their underlying
 * tendencies are not tracked in observedRates.
 *
 * PARALLEL DISCIPLINE (binding, mirrors the parent rule):
 *   Every entry in ANCHOR_PREDICATE_KEYS requires an anchor-level Tier-1
 *   math-integrity scenario in `__sim__/scenarios/` (synthetic villain,
 *   10k-hand sim, predicted-vs-simulated dividend within 5%, GTO baseline
 *   math verification). No anchor predicate ships without one.
 *
 * Predicates already in assumptionEngine PREDICATE_KEYS (e.g. SEED-01's
 * `foldToRiverBet`) MUST NOT be duplicated here — base-registry membership
 * already satisfies validateClaim. This registry is the ADDITIONAL vocabulary
 * passed to validateAssumption via `options.additionalPredicates`
 * (see validateAnchorFull).
 *
 * Graduation path: if producer plumbing for one of these tendencies lands
 * later, the predicate moves to PREDICATE_KEYS under the full 4-artifact
 * discipline and is removed here — no schema change required.
 *
 * Pure module — no imports.
 */

export const ANCHOR_PREDICATE_KEYS = Object.freeze([
  'riverProbeBluffFrequencyAfterTurnXX', // SEED-02 lagOverbluffRiverProbe
  'callVsTurnDoubleBarrelPaired',        // SEED-03 fishOvercallTurnDoubleBarrel
  'foldVsFlopDonkWetConnected',          // SEED-04 tagOverfoldFlopDonk
]);

/**
 * Retired anchor predicates stay listed so persisted anchors deserialize
 * cleanly without validation errors (mirrors assumptionEngine
 * DEPRECATED_PREDICATES retirement mechanism).
 */
export const DEPRECATED_ANCHOR_PREDICATES = Object.freeze([]);
