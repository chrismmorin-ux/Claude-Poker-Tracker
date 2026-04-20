/**
 * scheduler.js — picks the next drill matchup, weighted toward weak frameworks.
 *
 * Strategy: per-framework accuracy lowers → matchups in that framework get
 * sampled more. Recent matchups are penalized to avoid immediate repetition.
 * Under ~5 total attempts (cold start), falls back to uniform random.
 */

const MIN_ATTEMPTS_FOR_WEIGHTING = 5;
const RECENCY_WINDOW = 5;
const RECENCY_PENALTY = 0.3;

// Delta-aware weighting knobs. Below DELTA_MIN_SAMPLES attempts with a
// recorded numeric delta, we ignore avgDelta (too noisy). DELTA_WEIGHT_SCALE
// converts average delta to a weight contribution: at delta=0.10 (way off),
// contribution hits the cap of DELTA_WEIGHT_CAP so it doesn't dominate the
// accuracy signal.
const DELTA_MIN_SAMPLES = 3;
const DELTA_WEIGHT_SCALE = 0.10;   // delta of 10% adds 1.0 to weight
const DELTA_WEIGHT_CAP = 1.0;

/**
 * Pick the next matchup from `library` given accumulated `frameworkAccuracy`
 * and an array of `recentIds` (most-recent first).
 */
export const pickNextMatchup = (library, frameworkAccuracy = {}, recentIds = []) => {
  if (!library || library.length === 0) return null;
  const recentSet = new Set((recentIds || []).slice(0, RECENCY_WINDOW));

  // Cold start: if user has fewer than threshold attempts across any framework,
  // sample uniformly (skipping very recent entries).
  const totalAttempts = Object.values(frameworkAccuracy)
    .reduce((sum, f) => sum + (f?.attempts || 0), 0);
  if (totalAttempts < MIN_ATTEMPTS_FOR_WEIGHTING) {
    const candidates = library.filter((m) => !recentSet.has(m.id));
    const pool = candidates.length > 0 ? candidates : library;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const weights = library.map((m) => {
    const stats = frameworkAccuracy[m.primary];
    const acc = stats?.attempts ? stats.accuracy : 0.5;
    const avgDelta = stats?.deltaSamples >= DELTA_MIN_SAMPLES ? stats.avgDelta : 0;
    // Lower accuracy → higher weight. Also: higher avg delta → higher weight,
    // so hero gets more matchups in frameworks where they're imprecise even
    // if their binary "correct within ±5%" rate is high. Delta weight is
    // the larger equivalent of (1 - accuracy), so a ±3% average delta adds
    // ~0.3 to the weight — meaningful without dominating.
    const accuracyPull = 1.5 - acc;
    const deltaPull = Math.min(DELTA_WEIGHT_CAP, avgDelta / DELTA_WEIGHT_SCALE);
    const frameworkWeight = Math.max(0.5, Math.min(2.5, accuracyPull + deltaPull));
    const recencyMul = recentSet.has(m.id) ? RECENCY_PENALTY : 1;
    return frameworkWeight * recencyMul;
  });

  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return library[Math.floor(Math.random() * library.length)];
  let r = Math.random() * total;
  for (let i = 0; i < library.length; i++) {
    r -= weights[i];
    if (r <= 0) return library[i];
  }
  return library[library.length - 1];
};

// ---------- Recipe Drill sampling ---------- //

const RANK_CHARS = 'AKQJT98765432';
const ALL_HAND_CLASSES = (() => {
  const out = [];
  // Pairs
  for (const r of RANK_CHARS) out.push(`${r}${r}`);
  // Unpaired, higher rank first, suited + offsuit
  for (let i = 0; i < RANK_CHARS.length; i++) {
    for (let j = i + 1; j < RANK_CHARS.length; j++) {
      out.push(`${RANK_CHARS[i]}${RANK_CHARS[j]}s`);
      out.push(`${RANK_CHARS[i]}${RANK_CHARS[j]}o`);
    }
  }
  return out;
})();

/**
 * Pick a Recipe Drill matchup from the FULL 169×169 hand-class space.
 *
 * Unlike pickNextMatchup (which samples from a curated library), Recipe Drill
 * needs breadth across every shape and lane. Uniform sampling over all 169
 * hand classes for both hero and villain, with self-match rejection and a
 * small recent-penalty bias to avoid immediate repeats.
 *
 * Returns `{ id, a, b }` — same shape as library matchups so callers can
 * reuse recent-id tracking. `id` is the canonical key "{hero}_{villain}".
 *
 * @param {string[]} recentKeys most-recent first, capped by the caller
 */
export const pickRecipeMatchup = (recentKeys = []) => {
  const recentSet = new Set(recentKeys);
  // Reject-sample: up to 20 tries to avoid self-match + recent. In the
  // unlikely case every attempt is a recent hit, fall through to a random
  // non-self pair (with recent collision allowed).
  for (let i = 0; i < 20; i++) {
    const a = ALL_HAND_CLASSES[Math.floor(Math.random() * ALL_HAND_CLASSES.length)];
    const b = ALL_HAND_CLASSES[Math.floor(Math.random() * ALL_HAND_CLASSES.length)];
    if (a === b) continue;
    const id = `${a}_${b}`;
    if (!recentSet.has(id)) return { id, a, b };
  }
  // Fallback.
  const a = ALL_HAND_CLASSES[Math.floor(Math.random() * ALL_HAND_CLASSES.length)];
  let b = ALL_HAND_CLASSES[Math.floor(Math.random() * ALL_HAND_CLASSES.length)];
  while (b === a) {
    b = ALL_HAND_CLASSES[Math.floor(Math.random() * ALL_HAND_CLASSES.length)];
  }
  return { id: `${a}_${b}`, a, b };
};

/**
 * Score a user's equity estimate against ground truth.
 *   delta        = |user − truth|
 *   correct      = delta ≤ tolerance (default 0.05 = ±5%)
 *   starRating   = 3 for <2%, 2 for <5%, 1 for <10%, 0 otherwise
 */
export const scoreEstimate = (userEstimate, truthEquity, tolerance = 0.05) => {
  const delta = Math.abs(userEstimate - truthEquity);
  const correct = delta <= tolerance;
  let stars = 0;
  if (delta < 0.02) stars = 3;
  else if (delta < 0.05) stars = 2;
  else if (delta < 0.10) stars = 1;
  return { delta, correct, stars };
};

/**
 * Score a user's framework selection (set of ids) against the true applicable
 * frameworks. Returns precision/recall/F1 + per-id verdicts.
 */
export const scoreFrameworkSelection = (pickedIds, trueIds) => {
  const picked = new Set(pickedIds);
  const truth = new Set(trueIds);
  const tp = [...truth].filter((id) => picked.has(id));
  const fp = [...picked].filter((id) => !truth.has(id));
  const fn = [...truth].filter((id) => !picked.has(id));
  const precision = picked.size > 0 ? tp.length / picked.size : 0;
  const recall = truth.size > 0 ? tp.length / truth.size : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const correct = fp.length === 0 && fn.length === 0;
  return { correct, tp, fp, fn, precision, recall, f1 };
};

/**
 * Score a Recipe Drill attempt — hero must compose:
 *   1. The hero's *shape* id  (e.g., "ax-suited")
 *   2. The *lane* id within that shape (e.g., "vs-unpaired-no-shared")
 *   3. A final equity estimate
 *
 * Each step is scored independently so hero sees which part of the recipe
 * they got right. Final-equity tolerance defaults to ±5% (matching
 * Estimate Drill).
 *
 * @param {Object} params
 * @param {string} params.pickedShapeId
 * @param {string} params.pickedLaneId
 * @param {number} params.pickedEquity     in [0, 1]
 * @param {string} params.trueShapeId
 * @param {string} params.trueLaneId
 * @param {number} params.trueEquity        in [0, 1]
 * @param {number} [params.equityTolerance=0.05]
 */
export const scoreRecipe = ({
  pickedShapeId,
  pickedLaneId,
  pickedEquity,
  trueShapeId,
  trueLaneId,
  trueEquity,
  equityTolerance = 0.05,
}) => {
  const shapeCorrect = pickedShapeId === trueShapeId;
  // Lane only counts if shape was right (lanes are scoped to shapes).
  const laneCorrect = shapeCorrect && pickedLaneId === trueLaneId;
  const equityDelta = Math.abs((pickedEquity ?? 0) - trueEquity);
  const equityCorrect = equityDelta <= equityTolerance;
  let stars = 0;
  if (shapeCorrect) stars++;
  if (laneCorrect) stars++;
  if (equityCorrect) stars++;
  return {
    shapeCorrect,
    laneCorrect,
    equityCorrect,
    equityDelta,
    stars,             // 0–3
    correct: stars === 3,
  };
};
