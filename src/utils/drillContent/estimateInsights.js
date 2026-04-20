/**
 * estimateInsights.js — post-submit feedback helpers for EstimateMode.
 *
 * Three derivations:
 *
 *   1. buildFrameworkInsight(frameworkMatches, userEstimate, truthEquity)
 *      For a single submitted estimate: find which applicable banded framework
 *      BEST matches the user's guess and which best matches the truth. Surface
 *      a hint when they disagree ("you reasoned like X, but Y dominates here").
 *
 *   2. buildCalibration(drills)
 *      Over the user's historical estimate drills: compute per-framework
 *      SIGNED mean delta (user − truth). A positive value means the user
 *      tends to OVERESTIMATE the favored side in that framework; negative
 *      means they UNDERESTIMATE. Returns a compact array sorted by
 *      |signedAvgDelta| descending so the UI can show the most miscalibrated
 *      frameworks first.
 *
 *   3. extractTrend(drills, limit)
 *      Last N estimate attempts as signed deltas (user − truth) for a
 *      sparkline. Most-recent last so the sparkline reads left-to-right.
 *
 * All three are pure functions — no IO, no React. Callers pass in the drill
 * array from usePreflopDrillsPersistence.
 */

import { FRAMEWORKS } from './frameworks';

const FRAMEWORK_BY_ID = Object.values(FRAMEWORKS).reduce((acc, fw) => {
  acc[fw.id] = fw;
  return acc;
}, {});

// ---------- (1) Framework mis-application hint ---------- //

/**
 * Compute the center-of-band equity predicted by each applicable
 * framework-subcase from the user's perspective on hand A (hero).
 *
 * Returns array of { frameworkId, frameworkName, subcaseId, predictedEquity }
 * — filtered to subcases with a `band` array; unbanded modifiers (e.g.,
 * STRAIGHT_COVERAGE, FLUSH_CONTENTION, BROADWAY_VS_CONNECTOR) are skipped.
 *
 * `frameworkMatches` is the output of `classifyMatchup(handA, handB)` from
 * frameworks.js — each entry carries the framework, its matched subcase id,
 * and `favored` ('A' | 'B' | null). We convert predicted equity to hero's
 * (hand-A's) perspective by flipping when favored === 'B'.
 */
export const computeFrameworkPredictions = (frameworkMatches) => {
  const out = [];
  for (const m of frameworkMatches || []) {
    const fw = FRAMEWORK_BY_ID[m.framework.id];
    if (!fw) continue;
    const sub = fw.subcases?.find((s) => s.id === m.subcase);
    if (!sub?.band) continue; // skip unbanded (modifiers, decomposition)
    const [lo, hi] = sub.band;
    const favoredMid = (lo + hi) / 2;
    // If hand A is favored, predicted hero equity is the midpoint; if hand B
    // is favored, hero's equity is 1 − midpoint. `favored: null` shouldn't
    // happen with banded subcases, but guard against it by returning null.
    let predicted;
    if (m.favored === 'A') predicted = favoredMid;
    else if (m.favored === 'B') predicted = 1 - favoredMid;
    else predicted = favoredMid; // fallback — banded subcases should have a side
    out.push({
      frameworkId: m.framework.id,
      frameworkName: m.framework.name,
      subcaseId: m.subcase,
      predictedEquity: predicted,
    });
  }
  return out;
};

/**
 * Given a set of applicable banded predictions, a user's estimate (0–1),
 * and the truth, produce a mis-application insight or null.
 *
 *   - If NO banded framework applies: return { kind: 'no_banded', … }.
 *   - If one or more apply:
 *       - userFramework = argmin_{fw in applied} |predicted − user|
 *       - truthFramework = argmin_{fw in applied} |predicted − truth|
 *       - If userFramework !== truthFramework, return a mis-app hint.
 *       - If they agree, return { kind: 'aligned', userFramework }.
 */
export const buildFrameworkInsight = (frameworkMatches, userEstimate, truthEquity) => {
  const predictions = computeFrameworkPredictions(frameworkMatches);
  if (predictions.length === 0) {
    return { kind: 'no_banded' };
  }

  const closestTo = (target) =>
    predictions.reduce((best, p) =>
      Math.abs(p.predictedEquity - target) < Math.abs(best.predictedEquity - target) ? p : best,
    );

  const userMatch = closestTo(userEstimate);
  const truthMatch = closestTo(truthEquity);

  if (userMatch.frameworkId !== truthMatch.frameworkId) {
    return {
      kind: 'mis_applied',
      userFramework: userMatch,
      truthFramework: truthMatch,
      predictions,
    };
  }
  return { kind: 'aligned', userFramework: userMatch, predictions };
};

// ---------- (2) Per-framework signed calibration ---------- //

/**
 * Build per-framework signed-delta stats from the drill history.
 *
 * Each estimate drill record stores `userAnswer.estimate` and `truth.equity`
 * (hero's equity, in [0,1]) plus `truth.frameworks` (array of framework ids
 * that applied). For each drill, attribute the signed delta (user − truth)
 * to every applicable framework.
 *
 * Returns an array of { frameworkId, frameworkName, n, signedAvgDelta,
 * absAvgDelta }, sorted by |signedAvgDelta| descending. Callers typically
 * render the top 2-3 with a message like "You overshoot Race matchups by
 * +4.2% on average" when |signedAvgDelta| exceeds a threshold.
 *
 * Frameworks with fewer than MIN_SAMPLES attempts are filtered out so the
 * UI doesn't surface noise.
 */
const MIN_SAMPLES = 3;

export const buildCalibration = (drills) => {
  const agg = {};
  for (const d of drills || []) {
    if (d?.drillType !== 'estimate') continue;
    const user = d?.userAnswer?.estimate;
    const truth = d?.truth?.equity;
    const fwIds = d?.truth?.frameworks;
    if (typeof user !== 'number' || typeof truth !== 'number' || !Array.isArray(fwIds)) continue;
    const signed = user - truth;
    for (const id of fwIds) {
      if (!agg[id]) agg[id] = { sumSigned: 0, sumAbs: 0, n: 0 };
      agg[id].sumSigned += signed;
      agg[id].sumAbs += Math.abs(signed);
      agg[id].n++;
    }
  }

  const out = [];
  for (const id of Object.keys(agg)) {
    const { sumSigned, sumAbs, n } = agg[id];
    if (n < MIN_SAMPLES) continue;
    const fw = FRAMEWORK_BY_ID[id];
    out.push({
      frameworkId: id,
      frameworkName: fw?.name || id,
      n,
      signedAvgDelta: sumSigned / n,
      absAvgDelta: sumAbs / n,
    });
  }
  out.sort((a, b) => Math.abs(b.signedAvgDelta) - Math.abs(a.signedAvgDelta));
  return out;
};

// ---------- (3) Recent-delta trend for the sparkline ---------- //

/**
 * Return last `limit` signed deltas (user − truth) from estimate drills,
 * most-recent-last for left-to-right chronological rendering. Each entry:
 *   { signedDelta, timestamp }
 * Entries missing userAnswer.estimate or truth.equity are skipped.
 */
export const extractTrend = (drills, limit = 20) => {
  const points = [];
  for (const d of drills || []) {
    if (d?.drillType !== 'estimate') continue;
    const user = d?.userAnswer?.estimate;
    const truth = d?.truth?.equity;
    if (typeof user !== 'number' || typeof truth !== 'number') continue;
    points.push({ signedDelta: user - truth, timestamp: d.timestamp || 0 });
  }
  // Drills are loaded newest-first from storage; reverse to chronological,
  // then take last `limit`.
  points.reverse();
  if (points.length > limit) return points.slice(points.length - limit);
  return points;
};
