/**
 * qualityGate.js — Four-gate hard-edge actionability determination
 *
 * Part of the assumptionEngine module. See `CLAUDE.md` for rules (mandatory read).
 *
 * Per schema v1.1 §7.1, an assumption is actionable iff ALL of:
 *   1. posteriorConfidence ≥ threshold.confidence
 *   2. stability.compositeScore ≥ threshold.stability
 *   3. recognizability.score ≥ threshold (drill-specific OR live-specific)
 *   4. counterExploit.asymmetricPayoff ≥ threshold.asymmetricPayoff
 *   + 5. expectedDividend.sharpe ≥ threshold.sharpe (v1.1 Sharpe floor)
 *
 * Surface-specific splits (v1.1 CC-1):
 *   - actionableInDrill uses recognizabilityDrill threshold (0.40 default)
 *   - actionableLive uses recognizabilityLive threshold (0.60 default)
 *   - Hero-side assumptions (operator.target === 'hero') have actionableLive ALWAYS false,
 *     regardless of the gates — per I-AE-2 + CC-6.
 *
 * Composite score (for ranking — never for gating):
 *   Geometric mean of the four normalized dimensions. Used by drill card ordering
 *   and sidebar top-1 citation selection.
 *
 * Pure module — imports only assumptionTypes (and indirectly the thresholds there).
 */

import {
  VILLAIN_SIDE_THRESHOLDS,
  HERO_SIDE_THRESHOLDS,
  STABILITY_MIN_NON_NULL_SUBSCORES,
} from './assumptionTypes';

// ───────────────────────────────────────────────────────────────────────────
// Gate determination
// ───────────────────────────────────────────────────────────────────────────

/**
 * Evaluate a candidate assumption against the surface-specific gate profile.
 * Returns boolean + reason (first-failure diagnostic) + per-gate trace.
 *
 * @param {Object} assumption - VillainAssumption in v1.1 shape (validator not re-run here)
 * @param {'drill' | 'live'} surface
 * @returns {{ passed: boolean, reason?: string, gatesPassed: Object }}
 */
export const gateAssumption = (assumption, surface) => {
  if (!assumption || typeof assumption !== 'object') {
    return { passed: false, reason: 'assumption-missing', gatesPassed: {} };
  }
  if (surface !== 'drill' && surface !== 'live') {
    return { passed: false, reason: 'invalid-surface', gatesPassed: {} };
  }

  const isHeroSide = assumption.operator?.target === 'hero';

  // Hero-side assumptions never pass the live gate — I-AE-2 + CC-6.
  if (isHeroSide && surface === 'live') {
    return {
      passed: false,
      reason: 'hero-side-live-rendering-forbidden',
      gatesPassed: {},
    };
  }

  const thresholds = isHeroSide ? HERO_SIDE_THRESHOLDS : VILLAIN_SIDE_THRESHOLDS;

  const conf = assumption.evidence?.posteriorConfidence;
  const stability = assumption.stability?.compositeScore;
  const nonNullSubscores = assumption.stability?.nonNullSubscoreCount;
  const recog = assumption.recognizability?.score;
  const asymmetricPayoff = assumption.counterExploit?.asymmetricPayoff;
  const sharpe = assumption.consequence?.expectedDividend?.sharpe;

  const recogThreshold = surface === 'drill'
    ? thresholds.recognizabilityDrill
    : thresholds.recognizabilityLive;

  const gatesPassed = {
    confidence: isFiniteAtLeast(conf, thresholds.confidence),
    stability: stability !== null && stability !== undefined
      && isFiniteAtLeast(stability, thresholds.stability)
      && (nonNullSubscores === undefined
          || nonNullSubscores >= STABILITY_MIN_NON_NULL_SUBSCORES),
    recognizability: isFiniteAtLeast(recog, recogThreshold),
    asymmetricPayoff: isFiniteAtLeast(asymmetricPayoff, thresholds.asymmetricPayoff),
    sharpe: isFiniteAtLeast(sharpe, thresholds.sharpe),
  };

  if (!gatesPassed.confidence) {
    return { passed: false, reason: 'confidence-below-threshold', gatesPassed };
  }
  if (!gatesPassed.stability) {
    const reason = stability === null || stability === undefined
      ? 'insufficient-stability-coverage'
      : 'stability-below-threshold';
    return { passed: false, reason, gatesPassed };
  }
  if (!gatesPassed.recognizability) {
    return { passed: false, reason: 'recognizability-below-threshold', gatesPassed };
  }
  if (!gatesPassed.asymmetricPayoff) {
    return { passed: false, reason: 'asymmetric-payoff-below-threshold', gatesPassed };
  }
  if (!gatesPassed.sharpe) {
    return { passed: false, reason: 'low-sharpe', gatesPassed };
  }

  return { passed: true, gatesPassed };
};

/**
 * Compute the composite quality score for ranking.
 *
 * Geometric mean of normalized dimensions. Used ONLY for ranking
 * actionable assumptions (drill card ordering, sidebar top-1 selection).
 * NEVER used as a gate.
 *
 * @param {Object} dims - { confidence, stability, recognizability, asymmetricPayoff, sharpe }
 * @returns {number} Composite in [0, 1]
 */
export const computeComposite = (dims) => {
  if (!dims || typeof dims !== 'object') return 0;

  const values = [
    clamp01(dims.confidence),
    clamp01(dims.stability),
    clamp01(dims.recognizability),
    // asymmetricPayoff is in bb/100 firings; normalize with soft sigmoid for ranking.
    // 0 bb/100 → 0, 0.30 → ~0.5, 1.0 → ~0.88, 2.0 → ~0.98.
    sigmoidNormalizePayoff(dims.asymmetricPayoff),
    // sharpe ≥ 1 is passable; normalize 1.0 → 0.5, 3.0 → 0.88, infinite → 1.0.
    sigmoidNormalizeSharpe(dims.sharpe),
  ];

  // Guard against zero values producing a zero geometric mean (geometric mean
  // is 0 if any input is 0). Use a tiny floor to allow weak-but-nonzero
  // dimensions to contribute meaningfully.
  const floored = values.map((v) => Math.max(v, 0.001));
  const product = floored.reduce((a, b) => a * b, 1);
  return Math.pow(product, 1 / floored.length);
};

/**
 * Determine full actionability pair + composite + trace.
 * Convenience wrapper that runs both surface gates + composite.
 *
 * @param {Object} assumption - VillainAssumption
 * @returns {{ actionableInDrill, actionableLive, actionable, composite, gatesPassedDrill, gatesPassedLive, reason?}}
 */
export const determineActionability = (assumption) => {
  const drillGate = gateAssumption(assumption, 'drill');
  const liveGate = gateAssumption(assumption, 'live');

  const composite = computeComposite({
    confidence: assumption?.evidence?.posteriorConfidence,
    stability: assumption?.stability?.compositeScore,
    recognizability: assumption?.recognizability?.score,
    asymmetricPayoff: assumption?.counterExploit?.asymmetricPayoff,
    sharpe: assumption?.consequence?.expectedDividend?.sharpe,
  });

  return {
    actionableInDrill: drillGate.passed,
    actionableLive: liveGate.passed,
    actionable: liveGate.passed, // legacy alias
    composite,
    gatesPassedDrill: drillGate.gatesPassed,
    gatesPassedLive: liveGate.gatesPassed,
    reason: !drillGate.passed ? drillGate.reason : (!liveGate.passed ? liveGate.reason : undefined),
  };
};

// ───────────────────────────────────────────────────────────────────────────
// Pure helpers
// ───────────────────────────────────────────────────────────────────────────

const isFiniteAtLeast = (v, threshold) =>
  typeof v === 'number' && Number.isFinite(v) && v >= threshold;

const clamp01 = (v) =>
  Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;

const sigmoid = (x) => 1 / (1 + Math.exp(-x));

const sigmoidNormalizePayoff = (payoff) => {
  if (!Number.isFinite(payoff) || payoff <= 0) return 0;
  // Sigmoid centered at 0.30 (the threshold), scale ~3 bb/100 range.
  return sigmoid((payoff - 0.3) * 3);
};

const sigmoidNormalizeSharpe = (sharpe) => {
  if (!Number.isFinite(sharpe) || sharpe <= 0) return 0;
  // Sigmoid centered at 1.0 (the threshold), scale ~2 Sharpe units.
  return sigmoid((sharpe - 1.0) * 1.5);
};
