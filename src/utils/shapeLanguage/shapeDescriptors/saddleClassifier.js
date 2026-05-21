/**
 * saddleClassifier.js — Classify a villain's per-combo equity distribution
 * into one of 5 Saddle labels: `saddle` / `wayAhead` / `wayBehind` / `flat`
 * / `empty`.
 *
 * Saddle has two genuinely independent dimensions — `wayAheadMass` (how
 * much of villain's range beats hero by a comfortable margin) and
 * `wayBehindMass` (how much loses by a comfortable margin). The output
 * shape is two-field {wayAheadMass, wayBehindMass, label, confidence}
 * rather than a single discriminated union, mirroring `equityShapeClassifier`
 * (Spire + Polarization) — see INV-SLS-B3-SADDLE-TWO-MASS in
 * `system/invariants.md`.
 *
 * Input shape: `perCombo` array from `villainAnalysis.perCombo`
 * (wired through `evaluateGameTree` → `buildCounterfactualTree` →
 * `useHandReplayAnalysis` per SPR-086). Each entry:
 *   { card1: number, card2: number, weight: number, bucket: string, heroEquity: number }
 *
 * The classifier ignores `card1`/`card2`/`bucket` — it only uses
 * `weight` and `heroEquity`. The `bucket` field already classifies
 * each combo into nuts/strong/marginal/draw/air, but Saddle's
 * way-ahead-way-behind dimensions cut across that classification
 * cleanly (a "draw" combo on the flop can be way-behind on the river,
 * etc.).
 *
 * Output:
 *   {
 *     wayAheadMass: number,        // weighted fraction of combos w/ heroEquity < 0.35
 *     wayBehindMass: number,       // weighted fraction of combos w/ heroEquity > 0.65
 *     middleMass: number,          // derived; wayAheadMass + wayBehindMass + middleMass = 1
 *     label: 'saddle' | 'wayAhead' | 'wayBehind' | 'flat' | 'empty',
 *     confidence: number,          // [0, 1]
 *   }
 *
 * The two masses are the primary signal; the label is a derived rollup.
 * Surfaces that only render `label` without the underlying masses are
 * losing information — they should at minimum show both percentages
 * (per the SaddleSection embed).
 *
 * Anti-pattern refused (HARD GUARDRAIL): the returned label and masses
 * are presentation-only. They MUST NOT be used as inputs to villain
 * modeling, exploit generation, or hero action selection. Villain
 * decisions derive from equity / pot odds / SPR / players-remaining
 * per POKER_THEORY.md §7 + `feedback_first_principles_decisions.md`.
 *
 * Pure function. Deterministic. No IDB, no React, no dispatch.
 *
 * SLS Stream B3 — WS-043 / SPR-088.
 */

import {
  WAY_BEHIND_EQUITY_CEILING,
  WAY_AHEAD_EQUITY_FLOOR,
  WAY_AHEAD_MASS_FLOOR,
  WAY_BEHIND_MASS_FLOOR,
  MIDDLE_MASS_CEILING,
  MIN_CLASSIFIABLE_COMBO_COUNT,
  SADDLE_DISPLAY_NAMES,
} from './saddlePrototypes';

/**
 * Classify a per-combo equity distribution into Saddle space.
 *
 * @param {Array<{weight: number, heroEquity: number}> | null | undefined} perCombo
 * @returns {{
 *   wayAheadMass: number,
 *   wayBehindMass: number,
 *   middleMass: number,
 *   label: 'saddle' | 'wayAhead' | 'wayBehind' | 'flat' | 'empty',
 *   confidence: number,
 * }}
 */
export const classifySaddle = (perCombo) => {
  const emptyResult = {
    wayAheadMass: 0,
    wayBehindMass: 0,
    middleMass: 0,
    label: 'empty',
    confidence: 0,
  };

  if (!Array.isArray(perCombo) || perCombo.length < MIN_CLASSIFIABLE_COMBO_COUNT) {
    return emptyResult;
  }

  // Filter to entries with finite weight + heroEquity and weight > 0.
  // The combinatorial reasoning behind ignoring weight===0 combos:
  // they represent removed-from-range hands and shouldn't pull the
  // distribution toward any mass bucket.
  const valid = perCombo.filter(
    (c) =>
      c &&
      Number.isFinite(c.weight) &&
      Number.isFinite(c.heroEquity) &&
      c.weight > 0,
  );

  if (valid.length < MIN_CLASSIFIABLE_COMBO_COUNT) return emptyResult;

  let totalWeight = 0;
  let wayAheadWeight = 0;
  let wayBehindWeight = 0;
  let middleWeight = 0;

  for (const combo of valid) {
    totalWeight += combo.weight;
    if (combo.heroEquity < WAY_BEHIND_EQUITY_CEILING) {
      wayAheadWeight += combo.weight; // villain way-ahead on this combo
    } else if (combo.heroEquity > WAY_AHEAD_EQUITY_FLOOR) {
      wayBehindWeight += combo.weight; // villain way-behind on this combo
    } else {
      middleWeight += combo.weight; // middle bucket (close decision)
    }
  }

  if (totalWeight === 0) return emptyResult;

  // Count each mass directly (NOT via subtraction) so the partition
  // sum exactly equals 1.0 in floating-point and boundary tests like
  // "middleMass exactly at MIDDLE_MASS_CEILING" land deterministically.
  const wayAheadMass = wayAheadWeight / totalWeight;
  const wayBehindMass = wayBehindWeight / totalWeight;
  const middleMass = middleWeight / totalWeight;

  const wayAheadElevated = wayAheadMass > WAY_AHEAD_MASS_FLOOR;
  const wayBehindElevated = wayBehindMass > WAY_BEHIND_MASS_FLOOR;
  const middleDepleted = middleMass < MIDDLE_MASS_CEILING;

  // ─── Derive the rollup label ─────────────────────────────────────
  let label;
  if (wayAheadElevated && wayBehindElevated && middleDepleted) {
    label = 'saddle';
  } else if (wayAheadElevated && !wayBehindElevated) {
    label = 'wayAhead';
  } else if (wayBehindElevated && !wayAheadElevated) {
    label = 'wayBehind';
  } else {
    // Either both elevated but middle not depleted (bimodal-with-noise
    // = closer to flat than saddle), or neither elevated.
    label = 'flat';
  }

  // ─── Confidence ─────────────────────────────────────────────────
  // For elevated-dimension labels, confidence scales how far the mass
  // sits above its floor, normalized by the room between floor and a
  // theoretical max of 1.0:
  //   confidence = (mass - floor) / (1 - floor)
  // A wayAhead-only range right at floor (mass 0.30) → confidence 0.
  // A wayAhead with mass 0.65 (mid-range strong) → confidence 0.5.
  // A wayAhead with mass 1.0 (every combo way-ahead) → confidence 1.0.
  // This gives genuine graduation across the elevated regime rather
  // than saturating at the floor.
  //
  // For saddle, confidence combines the min-of-the-two masses (the
  // dimension that's least elevated is the weak link) with how far the
  // middle is below ceiling (more depletion = more confidence in the
  // saddle pattern).
  const aboveFloor = (mass, floor) =>
    Math.max(0, Math.min(1, (mass - floor) / (1 - floor)));

  let confidence;
  if (label === 'saddle') {
    const minMass = Math.min(wayAheadMass, wayBehindMass);
    const massConfidence = aboveFloor(minMass, WAY_AHEAD_MASS_FLOOR);
    const middleConfidence =
      MIDDLE_MASS_CEILING > 0
        ? Math.max(0, Math.min(1, (MIDDLE_MASS_CEILING - middleMass) / MIDDLE_MASS_CEILING))
        : 0;
    confidence = (massConfidence + middleConfidence) / 2;
  } else if (label === 'wayAhead') {
    confidence = aboveFloor(wayAheadMass, WAY_AHEAD_MASS_FLOOR);
  } else if (label === 'wayBehind') {
    confidence = aboveFloor(wayBehindMass, WAY_BEHIND_MASS_FLOOR);
  } else {
    // flat: confidence is how far BOTH masses sit below their floors.
    // High when both small; lower when one is close to firing.
    const maxMass = Math.max(wayAheadMass, wayBehindMass);
    confidence = Math.max(0, 1 - maxMass / WAY_AHEAD_MASS_FLOOR);
  }

  return {
    wayAheadMass,
    wayBehindMass,
    middleMass,
    label,
    confidence,
  };
};

/**
 * Display name for a Saddle label.
 */
export const getSaddleDisplayName = (label) =>
  SADDLE_DISPLAY_NAMES[label] || '—';
