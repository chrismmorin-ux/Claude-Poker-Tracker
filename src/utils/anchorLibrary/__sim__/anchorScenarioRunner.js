/**
 * anchorScenarioRunner.js — Tier-1 math-integrity runner for ExploitAnchor scenarios
 *
 * Part of the anchorLibrary Tier-1 simulator per `schema-delta.md` §7 + inherited
 * from `assumptionEngine/__sim__/scenarioRunner.js` pattern.
 *
 * An anchor scenario validates three things:
 *
 *   1. **Schema integrity** — anchor passes `validateAnchor` (schema-delta §2 + §4).
 *   2. **GTO baseline math** — anchor's `gtoBaseline.referenceRate` is derivable from
 *      the declared `method` + game-state (e.g. MDF = pot / (pot + bet) when bet sizing
 *      is specified). Per `POKER_THEORY.md` §6.2 MDF formula.
 *   3. **Predicted vs simulated dividend** — anchor's `consequence.expectedDividend.mean`
 *      matches simulated dividend against a synthetic villain policy within the
 *      scenario's tolerance (default 5%). Delegates to
 *      `assumptionEngine/__sim__/scenarioRunner.js` for the per-predicate portion.
 *
 * Plus honesty check (I-AE-3 inherited): dial=0 → dividend ≈ 0.
 *
 * Pure module — no IO; deterministic (all randomness seeded).
 *
 * Pass conditions (schema-delta §7 + inherited calibration.md §2.5):
 *   - All three assertions above green.
 *   - `relativeError ≤ tolerance`.
 *   - Honesty check passes per underlying scenarioRunner.
 */

import { validateAnchor } from '../validateAnchor';

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

/**
 * Run a Tier-1 anchor scenario.
 *
 * @typedef {Object} AnchorScenario
 * @property {string} name
 * @property {Object} anchor                        — the ExploitAnchor under test
 * @property {Object} villain                       — SyntheticVillainPolicy from assumptionEngine/__sim__/syntheticVillains
 * @property {Object} villainTendency               — input to produceAssumptions
 * @property {Object} gameState                     — input to produceAssumptions
 * @property {Object} [sessionContext]              — input to produceAssumptions
 * @property {string} targetPredicate               — primary predicate this anchor tests (e.g. 'foldToRiverBet')
 * @property {number} [firings=10000]
 * @property {number} [tolerance=0.05]
 * @property {Object} [gtoContext]                  — extra game-state for GTO math verification
 * @property {number} [gtoContext.potSize]          — pot size at decision node (pre-bet)
 * @property {number} [gtoContext.betSize]          — bet size at decision node
 * @property {function} produceAssumptions          — injected (same as assumptionEngine's runner)
 * @property {function} runPredicateScenario        — injected (assumptionEngine's runScenario)
 *
 * @returns {AnchorScenarioResult}
 */
export const runAnchorScenario = (scenario) => {
  const name = scenario.name || 'unnamed-anchor-scenario';
  const firings = scenario.firings ?? 10000;
  const tolerance = scenario.tolerance ?? 0.05;

  // ─── Assertion 1: Schema integrity ──────────────────────────────────────
  const schemaResult = validateAnchor(scenario.anchor);
  if (!schemaResult.ok) {
    return buildResult({
      name,
      passed: false,
      reason: `schema invalid: ${schemaResult.errors.join('; ')}`,
      schemaOk: false,
      schemaErrors: schemaResult.errors,
    });
  }

  // ─── Assertion 2: GTO baseline math ─────────────────────────────────────
  const gtoResult = verifyGtoBaseline(scenario.anchor, scenario.gtoContext);
  if (!gtoResult.passed) {
    return buildResult({
      name,
      passed: false,
      reason: `GTO baseline math mismatch: ${gtoResult.reason}`,
      schemaOk: true,
      gtoOk: false,
      gto: gtoResult,
    });
  }

  // ─── Assertion 3: Predicted vs simulated dividend ───────────────────────
  // Delegate to the injected predicate-level scenarioRunner from assumptionEngine.
  // This preserves single-source-of-truth for the predicate simulation math.
  if (typeof scenario.runPredicateScenario !== 'function') {
    return buildResult({
      name,
      passed: false,
      reason: 'runPredicateScenario must be injected (from assumptionEngine/__sim__/scenarioRunner)',
      schemaOk: true,
      gtoOk: true,
    });
  }

  const predicateResult = scenario.runPredicateScenario({
    name: `${name} → predicate ${scenario.targetPredicate}`,
    villain: scenario.villain,
    villainTendency: scenario.villainTendency,
    gameState: scenario.gameState,
    sessionContext: scenario.sessionContext || {},
    targetPredicate: scenario.targetPredicate,
    firings,
    tolerance,
    produceAssumptions: scenario.produceAssumptions,
  });

  return buildResult({
    name,
    passed: predicateResult.passed && (predicateResult.honestyCheck?.passed ?? true),
    reason: predicateResult.reason,
    schemaOk: true,
    gtoOk: true,
    gto: gtoResult,
    predicate: predicateResult,
  });
};

/**
 * Run a suite of anchor scenarios.
 *
 * @param {Array<AnchorScenario>} scenarios
 * @returns {{allPassed: boolean, results: Array<AnchorScenarioResult>}}
 */
export const runAnchorScenarioSuite = (scenarios) => {
  const results = scenarios.map((s) => runAnchorScenario(s));
  return {
    allPassed: results.every((r) => r.passed),
    results,
  };
};

// ───────────────────────────────────────────────────────────────────────────
// GTO baseline math verification
// ───────────────────────────────────────────────────────────────────────────

/**
 * Verify that the anchor's gtoBaseline.referenceRate is derivable from the
 * declared method + scenario's game-state.
 *
 * For `MDF` method: referenceRate should equal fold rate at MDF for the given
 * bet-sizing, i.e. `1 − MDF = bet / (pot + bet)` per POKER_THEORY.md §6.2.
 *
 * For other methods (`pot-odds-equilibrium`, `hand-down-equity`, `range-balance`),
 * verification is out of scope for Commit 1 — they require more game-state than
 * we currently thread through. Returns `{ passed: true, deferred: true }` in
 * those cases so the scenario doesn't fail spuriously on non-MDF anchors.
 *
 * Tolerance: 0.02 (2 percentage points) — accounts for anchor's choice of
 * referenceRate interpolation across bet-sizing range.
 */
const verifyGtoBaseline = (anchor, gtoContext) => {
  const method = anchor.gtoBaseline.method;
  const referenceRate = anchor.gtoBaseline.referenceRate;

  if (method !== 'MDF') {
    return {
      passed: true,
      deferred: true,
      method,
      reason: `GTO verification for method "${method}" deferred to later commits`,
    };
  }

  if (!gtoContext || !Number.isFinite(gtoContext.potSize) || !Number.isFinite(gtoContext.betSize)) {
    return {
      passed: false,
      method,
      reason: 'gtoContext.potSize + gtoContext.betSize required for MDF verification',
    };
  }

  // MDF = pot / (pot + bet)
  // fold-rate-at-MDF (what the anchor's referenceRate represents) = 1 − MDF = bet / (pot + bet)
  const expectedFoldRate = gtoContext.betSize / (gtoContext.potSize + gtoContext.betSize);
  const diff = Math.abs(expectedFoldRate - referenceRate);
  const tolerance = 0.02;

  if (diff > tolerance) {
    return {
      passed: false,
      method,
      expectedFoldRate,
      declaredReferenceRate: referenceRate,
      diff,
      tolerance,
      reason: `MDF-derived fold rate ${expectedFoldRate.toFixed(3)} differs from declared referenceRate ${referenceRate.toFixed(3)} by ${diff.toFixed(3)} (tolerance ${tolerance})`,
    };
  }

  return {
    passed: true,
    method,
    expectedFoldRate,
    declaredReferenceRate: referenceRate,
    diff,
    tolerance,
  };
};

// ───────────────────────────────────────────────────────────────────────────
// Result shape
// ───────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} AnchorScenarioResult
 * @property {string} scenarioName
 * @property {boolean} passed
 * @property {string|null} reason
 * @property {boolean} schemaOk
 * @property {string[]} [schemaErrors]
 * @property {boolean} [gtoOk]
 * @property {Object} [gto]          — GTO verification details
 * @property {Object} [predicate]    — delegated predicate scenario result
 */

const buildResult = ({ name, passed, reason, schemaOk, schemaErrors, gtoOk, gto, predicate }) => ({
  scenarioName: name,
  passed,
  reason: reason || null,
  schemaOk,
  schemaErrors: schemaErrors || null,
  gtoOk: gtoOk ?? null,
  gto: gto || null,
  predicate: predicate || null,
});
