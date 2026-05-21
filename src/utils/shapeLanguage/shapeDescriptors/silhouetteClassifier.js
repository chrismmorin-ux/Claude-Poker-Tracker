/**
 * silhouetteClassifier.js — Classify a 169-cell preflop range into one of
 * 5 silhouette prototypes (Oval / Barbell / Triangle / Comb / Cloud), or
 * a compound label when the top-2 prototypes are within COMPOUND_DELTA.
 *
 * Pure function. Deterministic. No IDB, no React, no dispatch.
 *
 * Per the SLS Gate 2 roundtable T6 verdict (`roundtable.md` line 64):
 * compound labels are the principled response to ambiguity, not a fallback
 * when the math is broken — a flipping single-label classifier is worse
 * than a stable compound.
 *
 * Anti-pattern refused (HARD GUARDRAIL): the returned label MUST NOT
 * be used as an input to villain modeling, exploit generation, or any
 * decision-driving computation. Silhouette is a presentation-only label
 * derived FROM the range matrix; villain decisions derive from equity /
 * pot odds / SPR / players-remaining per POKER_THEORY.md §7 +
 * `feedback_first_principles_decisions.md`.
 *
 * SLS Stream B1 — WS-041 / SPR-082.
 */

import { GRID_SIZE, computeGridFeatures } from '../gridFeatures';
import {
  SILHOUETTE_LABELS,
  SILHOUETTE_PROTOTYPES,
  COMPOUND_DELTA,
  getFeatureScales,
} from './silhouettePrototypes';

/**
 * Minimum total weighted combo mass before classification is meaningful.
 * Below ~10 combos (~0.75% of all hands), the input is too sparse to
 * classify reliably; return an `empty` label with zero confidence rather
 * than forcing a prototype match.
 */
const MIN_CLASSIFIABLE_MASS = 10;

/**
 * Compute a prototype-specific distance score given the input features
 * and the prototype's signature. Lower distance = better match.
 *
 * Uses per-feature weighted squared deviation normalized by feature scale.
 */
const distanceToPrototype = (features, prototype, scales) => {
  let d = 0;
  for (const key of Object.keys(prototype.targets)) {
    const target = prototype.targets[key];
    const weight = prototype.weights[key];
    const scale = scales[key] || 1;
    const value = features[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const dev = (value - target) / scale;
    d += weight * dev * dev;
  }
  return d;
};

/**
 * Classify a 169-cell preflop range grid into a silhouette label.
 *
 * @param {Float64Array | number[]} grid — 169-cell preflop range. Weights
 *   in [0, 1].
 * @returns {{
 *   label: 'oval' | 'barbell' | 'triangle' | 'comb' | 'cloud' | 'compound' | 'empty',
 *   confidence: number,
 *   prototypeScores: Record<string, number>,
 *   features: object,
 *   components?: [string, string],
 * }}
 */
export const classifySilhouette = (grid) => {
  if (!grid || (grid.length !== GRID_SIZE)) {
    return {
      label: 'empty',
      confidence: 0,
      prototypeScores: { oval: 0, barbell: 0, triangle: 0, comb: 0, cloud: 0 },
      features: computeGridFeatures(new Float64Array(GRID_SIZE)),
    };
  }

  const features = computeGridFeatures(grid);

  // Sparse-input guard: a virtually empty range can't be meaningfully
  // classified. Surfaces are expected to suppress the embed in this case.
  if (features.totalMass < MIN_CLASSIFIABLE_MASS) {
    return {
      label: 'empty',
      confidence: 0,
      prototypeScores: { oval: 0, barbell: 0, triangle: 0, comb: 0, cloud: 0 },
      features,
    };
  }

  const scales = getFeatureScales();

  // Compute raw distances per prototype.
  const distances = {};
  for (const label of SILHOUETTE_LABELS) {
    distances[label] = distanceToPrototype(features, SILHOUETTE_PROTOTYPES[label], scales);
  }

  // Convert distances → probabilities via softmax(-distance). Lower
  // distance gets exponentially higher probability. Numerically stable
  // via max-subtraction.
  const negDistances = SILHOUETTE_LABELS.map((l) => -distances[l]);
  const maxNeg = Math.max(...negDistances);
  const exps = negDistances.map((nd) => Math.exp(nd - maxNeg));
  const sumExp = exps.reduce((a, b) => a + b, 0);
  const prototypeScores = {};
  SILHOUETTE_LABELS.forEach((l, i) => {
    prototypeScores[l] = sumExp === 0 ? 0 : exps[i] / sumExp;
  });

  // Top-2 prototypes by score.
  const ranked = SILHOUETTE_LABELS
    .map((l) => ({ label: l, score: prototypeScores[l] }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const runnerUp = ranked[1];

  // Compound when top-2 are within COMPOUND_DELTA — preserves stability
  // per the T6 verdict.
  if (runnerUp && top.score - runnerUp.score < COMPOUND_DELTA) {
    return {
      label: 'compound',
      confidence: top.score,
      prototypeScores,
      features,
      components: [top.label, runnerUp.label],
    };
  }

  return {
    label: top.label,
    confidence: top.score,
    prototypeScores,
    features,
  };
};

/**
 * Convenience: lookup a prototype's display name.
 */
export const getSilhouetteDisplayName = (label) => {
  if (label === 'compound') return 'Compound';
  if (label === 'empty') return 'Empty';
  return SILHOUETTE_PROTOTYPES[label]?.displayName || label;
};

/**
 * Convenience: lookup a prototype's morphology word (alt-name from the
 * SLS roundtable — condensed / polarized / linear / capped / merged).
 */
export const getSilhouetteMorphology = (label) => {
  if (label === 'compound' || label === 'empty') return null;
  return SILHOUETTE_PROTOTYPES[label]?.morphology || null;
};
