/**
 * sizingCurveTagClassifier.js — Classify an EV-vs-sizing curve into
 * one of 4 prototype shapes: Ridge / Plateau / Cliff / Ramp.
 *
 * Per the SLS Gate 2 roundtable (`docs/projects/poker-shape-language/
 * roundtable.md` line 30-31, line 80-84): "Coach's insight: the
 * *label* travels to the table; the *full curve* is study-only."
 *
 * Input shape: an array of `{ fraction, ev }` entries — `fraction`
 * is the bet size as a fraction of pot (or stack, depending on the
 * upstream producer; the classifier is invariant to the x-axis
 * unit), `ev` is the expected value for that sizing. Order doesn't
 * matter — the classifier sorts internally by `fraction`.
 *
 * Output uses the same discriminated-union shape as `silhouetteClassifier`:
 *   {
 *     label: 'ridge' | 'plateau' | 'cliff' | 'ramp' | 'compound' | 'empty',
 *     confidence: number,
 *     prototypeScores: Record<string, number>,
 *     components?: [string, string],   // present only when label === 'compound'
 *     peakIndex: number | null,
 *     peakEV: number,
 *   }
 *
 * Anti-pattern refused (HARD GUARDRAIL): the returned label is
 * presentation-only. It MUST NOT be used as an input to villain
 * modeling, exploit generation, or hero action selection. The hero
 * action recommendation is computed by `gameTreeEvaluator` and must
 * NEVER be derived from this classifier's output. Per
 * `feedback_first_principles_decisions.md` + POKER_THEORY.md §7 +
 * `shapeLanguage/CLAUDE.md` §1.
 *
 * Pure function. Deterministic. No IDB, no React, no dispatch.
 *
 * SLS Stream B2 — WS-042 / SPR-084.
 */

import {
  SIZING_CURVE_LABELS,
  MIN_SAMPLES_FOR_CLASSIFICATION,
  FLAT_EV_THRESHOLD,
  RIDGE_PEAK_PROMINENCE,
  PLATEAU_TOP_FRACTION,
  PLATEAU_TOLERANCE,
  MONOTONICITY_FRACTION,
  MONOTONIC_TOLERANCE,
  COMPOUND_DELTA,
} from './sizingCurveTagPrototypes';

/**
 * Classify a sizing-EV curve.
 *
 * @param {Array<{fraction: number, ev: number}> | null} evByFraction
 * @returns {{
 *   label: 'ridge' | 'plateau' | 'cliff' | 'ramp' | 'compound' | 'empty',
 *   confidence: number,
 *   prototypeScores: {ridge: number, plateau: number, cliff: number, ramp: number},
 *   components?: [string, string],
 *   peakIndex: number | null,
 *   peakEV: number,
 * }}
 */
export const classifySizingCurveTag = (evByFraction) => {
  const emptyResult = {
    label: 'empty',
    confidence: 0,
    prototypeScores: { ridge: 0, plateau: 0, cliff: 0, ramp: 0 },
    peakIndex: null,
    peakEV: 0,
  };

  if (!Array.isArray(evByFraction) || evByFraction.length < MIN_SAMPLES_FOR_CLASSIFICATION) {
    return emptyResult;
  }

  // Filter to finite entries, sort by fraction ascending.
  const sorted = evByFraction
    .filter((e) => e && Number.isFinite(e.fraction) && Number.isFinite(e.ev))
    .slice()
    .sort((a, b) => a.fraction - b.fraction);

  if (sorted.length < MIN_SAMPLES_FOR_CLASSIFICATION) return emptyResult;

  const evs = sorted.map((e) => e.ev);
  const evMax = Math.max(...evs);
  const evMin = Math.min(...evs);
  const span = evMax - evMin;
  let peakIndex = 0;
  for (let i = 1; i < evs.length; i++) {
    if (evs[i] > evs[peakIndex]) peakIndex = i;
  }

  // Flat curve — total span is below threshold. Plateau is the
  // closest single-label fit (no peak structure, no monotone trend).
  if (span < FLAT_EV_THRESHOLD) {
    return {
      label: 'plateau',
      confidence: 1.0,
      prototypeScores: { ridge: 0, plateau: 1, cliff: 0, ramp: 0 },
      peakIndex,
      peakEV: evMax,
    };
  }

  // ─── Compute per-prototype scores ────────────────────────────────

  // Ridge: peak prominence — height of peak above the mean of its two
  // neighbors, normalized by span. Capped at 1.
  let ridgeScore = 0;
  if (peakIndex > 0 && peakIndex < evs.length - 1) {
    const neighborMean = (evs[peakIndex - 1] + evs[peakIndex + 1]) / 2;
    const prominence = (evs[peakIndex] - neighborMean) / span;
    ridgeScore = Math.max(0, Math.min(1, prominence / RIDGE_PEAK_PROMINENCE));
  } else if (peakIndex === 0 || peakIndex === evs.length - 1) {
    // Peak at edge — not a ridge (cliff or ramp prevails).
    ridgeScore = 0;
  }

  // Plateau: fraction of samples within tolerance of peak.
  const plateauThreshold = evMax - PLATEAU_TOLERANCE * span;
  const samplesNearPeak = evs.filter((v) => v >= plateauThreshold).length;
  const plateauFraction = samplesNearPeak / evs.length;
  const plateauScore = Math.max(0, Math.min(1, plateauFraction / PLATEAU_TOP_FRACTION));

  // Cliff: monotone non-increasing (with tolerance).
  const tolerance = MONOTONIC_TOLERANCE * span;
  let nonIncCount = 0;
  let nonDecCount = 0;
  for (let i = 1; i < evs.length; i++) {
    if (evs[i] <= evs[i - 1] + tolerance) nonIncCount += 1;
    if (evs[i] >= evs[i - 1] - tolerance) nonDecCount += 1;
  }
  const totalPairs = evs.length - 1;
  const cliffScore = Math.max(0, Math.min(1, (nonIncCount / totalPairs) / MONOTONICITY_FRACTION));
  const rampScore = Math.max(0, Math.min(1, (nonDecCount / totalPairs) / MONOTONICITY_FRACTION));

  // ─── Disambiguate ramp vs cliff for edge-peak cases ──────────────
  // If the peak is at the last index, ramp wins; at the first, cliff wins.
  // Apply a small bias to break ties cleanly without overriding genuine
  // monotonicity scores.
  let cliffAdjusted = cliffScore;
  let rampAdjusted = rampScore;
  if (peakIndex === 0 && nonIncCount > nonDecCount) cliffAdjusted *= 1.1;
  if (peakIndex === evs.length - 1 && nonDecCount > nonIncCount) rampAdjusted *= 1.1;
  cliffAdjusted = Math.min(1, cliffAdjusted);
  rampAdjusted = Math.min(1, rampAdjusted);

  const prototypeScores = {
    ridge: ridgeScore,
    plateau: plateauScore,
    cliff: cliffAdjusted,
    ramp: rampAdjusted,
  };

  // ─── Pick the label ──────────────────────────────────────────────
  const ranked = SIZING_CURVE_LABELS
    .map((label) => ({ label, score: prototypeScores[label] }))
    .sort((a, b) => b.score - a.score);

  const [top1, top2] = ranked;

  // Compound: top-2 are within COMPOUND_DELTA AND both ≥ 0.4
  // (otherwise the curve is poorly fit by both — better to pick the
  // top one alone with a low confidence).
  if (top1.score - top2.score <= COMPOUND_DELTA && top1.score >= 0.4 && top2.score >= 0.4) {
    return {
      label: 'compound',
      confidence: (top1.score + top2.score) / 2,
      prototypeScores,
      components: [top1.label, top2.label],
      peakIndex,
      peakEV: evMax,
    };
  }

  return {
    label: top1.label,
    confidence: top1.score,
    prototypeScores,
    peakIndex,
    peakEV: evMax,
  };
};

/**
 * Display name for a sizing-curve-tag label.
 */
export const getSizingCurveTagDisplayName = (label) => {
  switch (label) {
    case 'ridge': return 'Ridge';
    case 'plateau': return 'Plateau';
    case 'cliff': return 'Cliff';
    case 'ramp': return 'Ramp';
    case 'compound': return 'Compound';
    case 'empty': return 'Empty';
    default: return label;
  }
};

export { SIZING_CURVE_LABELS };
