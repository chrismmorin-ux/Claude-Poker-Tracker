/**
 * citedDecisionProducer.js — Compose baseline + assumptions + emotional state → CitedDecision
 *
 * Part of the citedDecision module. See `CLAUDE.md` for rules (mandatory read).
 *
 * Per schema v1.1 §5 — `CitedDecision` is the output the drill and live surfaces both render.
 * Same underlying object, different query (drill expanded, live compressed).
 *
 * Orchestration flow:
 *   1. Filter assumptions by surface-specific actionability (drill tolerates more than live).
 *   2. Drop hero-side assumptions when surface === 'live' per I-AE-2.
 *   3. Compute blend from applied-assumption bundle + context (schema §4.1).
 *   4. Compose operator transforms via applyOperator (assumptionEngine), scaled by dial × blend.
 *   5. Apply emotional tilt (emotionalState) to the mutated distribution.
 *   6. Derive recommendedAction from the composition of deviation types (v1 heuristic).
 *   7. Compute total dividend and per-assumption Shapley-ish attribution.
 *   8. Assemble CitedDecision with baselineAction, recommendedAction, citations, contestability.
 *
 * I-AE-3 honesty check: if blend === 0 OR all dials are 0, recommendedAction === baselineAction
 * and dividend === 0. Enforced via `isZeroBlend` short-circuit.
 *
 * I-AE-6 baseline presence: caller must supply a valid `baseline` object; if absent,
 * producer returns { citation: null, reason: "insufficient-baseline" }.
 *
 * I-AE-2 hero-side live exclusion: hero-side assumptions filtered for live surface.
 *
 * Imports from sibling modules (consumer-direction allowed):
 *   - assumptionEngine/operator (applyOperator, composeOperators)
 *   - emotionalState (applyEmotionalTilt)
 *   - ./dialMath (computeBlend, isZeroBlend)
 *   - ./attribution (computeShapleyContributions)
 */

import { composeOperators } from '../assumptionEngine/operator';
import { applyEmotionalTilt } from '../emotionalState';
import { computeBlend, isZeroBlend } from './dialMath';
import { computeShapleyContributions } from './attribution';

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

/**
 * Produce a CitedDecision from baseline + assumptions + emotional state.
 *
 * @param {Object} params
 * @param {Object} params.node - GameState per schema
 * @param {Array} params.assumptions - VillainAssumption[] (caller has run suppression already)
 * @param {Object} params.emotionalState - EmotionalState per schema §3 (or null)
 * @param {Object} params.baseline - BaselineEvaluation: { actionEVs, villainDistribution, recommendedAction }
 * @param {Object} [params.options]
 * @param {'drill' | 'live'} [params.options.surface='drill']
 * @param {string} [params.options.villainStyle='Unknown']
 * @param {number} [params.options.varianceBudget=0]
 * @param {'cash' | 'tournament' | 'high-stakes'} [params.options.stakeContext='cash']
 * @returns {Object|null} CitedDecision or { citation: null, reason } on baseline absence
 */
export const produceCitedDecision = ({
  node,
  assumptions = [],
  emotionalState = null,
  baseline,
  options = {},
} = {}) => {
  // I-AE-6 — baseline presence gate
  if (!baseline || typeof baseline !== 'object' || !baseline.actionEVs) {
    return { citation: null, reason: 'insufficient-baseline' };
  }

  const {
    surface = 'drill',
    villainStyle = 'Unknown',
    varianceBudget = 0,
    stakeContext = 'cash',
  } = options;

  // Filter by surface-specific actionability.
  const applied = filterBySurface(assumptions, surface);

  // Compute blend.
  const blend = computeBlend(applied, { varianceBudget, stakeContext });

  // I-AE-3 honesty check — short-circuit to baseline when nothing is committed.
  if (isZeroBlend(applied, blend) || applied.length === 0) {
    return buildBaselineOnlyDecision({ node, baseline, emotionalState, blend });
  }

  // Compose operators.
  const composed = composeOperators(
    applied.map((a) => ({ operator: a.operator, dial: (a.operator?.currentDial ?? 0) * blend })),
    baseline.villainDistribution,
  );

  // Apply emotional tilt (secondary transform).
  const mutatedDistribution = emotionalState
    ? applyEmotionalTilt(composed, emotionalState, villainStyle)
    : composed;

  // Derive recommended action + EV from the composition of deviations.
  const baselineAction = normalizeBaselineAction(baseline);
  const recommendedAction = deriveRecommendedAction(baselineAction, applied, baseline);

  // Total dividend = recommendedEV − baselineEV (both from baseline.actionEVs lookup).
  const baselineEV = lookupEV(baseline, baselineAction);
  const recommendedEV = lookupEV(baseline, recommendedAction);
  const totalDividend = recommendedEV - baselineEV;

  // Attribution: Shapley-ish leave-one-out.
  const citations = computeShapleyContributions(applied, totalDividend, blend);

  // Contestability: drill-only. Live surface omits the alternateDials array.
  const contestability = surface === 'drill'
    ? buildContestability({ applied, baseline, baselineAction })
    : { alternateDials: [] };

  return {
    node,
    baselineAction,
    recommendedAction,
    dividend: totalDividend,
    citations,
    dialPositions: buildDialPositions(applied),
    blend,
    emotionalState: emotionalState || null,
    contestability,
    surface,
  };
};

/**
 * Convenience re-export — compute blend as a standalone utility.
 */
export { computeBlend } from './dialMath';

// ───────────────────────────────────────────────────────────────────────────
// Filtering / surface semantics
// ───────────────────────────────────────────────────────────────────────────

const filterBySurface = (assumptions, surface) => {
  if (!Array.isArray(assumptions)) return [];
  return assumptions.filter((a) => {
    if (!a || !a.quality) return false;
    if (surface === 'live') {
      // I-AE-2 hero-side live exclusion
      if (a.operator?.target === 'hero') return false;
      return a.quality.actionableLive === true;
    }
    return a.quality.actionableInDrill === true;
  });
};

// ───────────────────────────────────────────────────────────────────────────
// Baseline + recommended action derivation
// ───────────────────────────────────────────────────────────────────────────

/**
 * Baseline decision returned when blend is zero (honesty check) or when no assumptions
 * pass the surface filter.
 */
const buildBaselineOnlyDecision = ({ node, baseline, emotionalState, blend }) => {
  const baselineAction = normalizeBaselineAction(baseline);
  const baselineEV = lookupEV(baseline, baselineAction);
  return {
    node,
    baselineAction,
    recommendedAction: baselineAction, // I-AE-3 honesty check
    dividend: 0,
    citations: [],
    dialPositions: {},
    blend,
    emotionalState: emotionalState || null,
    contestability: { alternateDials: [] },
    surface: null,
  };
};

const normalizeBaselineAction = (baseline) => {
  // Prefer explicit `recommendedAction` on baseline; else pick argmax EV.
  if (baseline.recommendedAction && typeof baseline.recommendedAction === 'object') {
    return baseline.recommendedAction;
  }
  const evs = baseline.actionEVs || {};
  let best = { action: 'check', ev: -Infinity };
  for (const [action, info] of Object.entries(evs)) {
    const ev = info?.ev ?? -Infinity;
    if (ev > best.ev) {
      best = { action, ev, sizing: info?.sizing };
    }
  }
  return best;
};

/**
 * Derive recommended action by composing applied assumptions' deviation types.
 * v1 heuristic — real re-evaluation via second gameTree call lands in Commit 7
 * (reducer integration) or a future Commit 6.5.
 *
 * Mapping (first matching wins; assumptions pre-sorted by composite descending):
 *   bluff-prune   → switch bet → check (if baselineAction was bet)
 *   value-expand  → switch check → bet (if baselineAction was check, with sizing boost)
 *   range-bet     → switch any → bet (small size)
 *   sizing-shift  → same action, alternate size
 *   spot-skip     → fold
 *   line-change   → alternate action explicitly in recipe (v1: check)
 */
const deriveRecommendedAction = (baselineAction, applied, baseline) => {
  if (!Array.isArray(applied) || applied.length === 0) return baselineAction;

  // Top-composite assumption drives the primary deviation
  const primary = applied[0];
  const deviationType = primary.consequence?.deviationType;

  switch (deviationType) {
    case 'bluff-prune': {
      // Bluff-prune changes hero's range. If baseline was bet, recommended is check.
      if (baselineAction.action === 'bet' || baselineAction.action === 'raise') {
        return { action: 'check', ev: lookupEV(baseline, { action: 'check' }) };
      }
      return baselineAction;
    }
    case 'value-expand': {
      // If baseline was check, shift to bet.
      if (baselineAction.action === 'check') {
        const betInfo = baseline.actionEVs?.bet;
        return {
          action: 'bet',
          ev: betInfo?.ev ?? baselineAction.ev,
          sizing: betInfo?.sizing ?? 0.66,
        };
      }
      return baselineAction;
    }
    case 'range-bet': {
      // Range-bet: always bet; smaller size than baseline if baseline was bet.
      const betInfo = baseline.actionEVs?.bet;
      return {
        action: 'bet',
        ev: betInfo?.ev ?? baselineAction.ev,
        sizing: 0.33, // range-bet default sizing
      };
    }
    case 'sizing-shift': {
      // Same action, alternate size
      return {
        ...baselineAction,
        sizing: primary.operator?.transform?.sizingShift?.to?.[0] ?? baselineAction.sizing,
      };
    }
    case 'spot-skip': {
      return { action: 'fold', ev: lookupEV(baseline, { action: 'fold' }) };
    }
    case 'line-change':
    default:
      return baselineAction;
  }
};

const lookupEV = (baseline, action) => {
  if (!action || !action.action) return 0;
  const info = baseline?.actionEVs?.[action.action];
  if (info && Number.isFinite(info.ev)) return info.ev;
  // Fallback — if requested action isn't in baseline.actionEVs, return 0.
  return 0;
};

// ───────────────────────────────────────────────────────────────────────────
// Contestability + dial positions (drill only per CC-5)
// ───────────────────────────────────────────────────────────────────────────

const buildDialPositions = (applied) => {
  const result = {};
  for (const a of applied) {
    if (a.id) result[a.id] = a.operator?.currentDial ?? 0;
  }
  return result;
};

/**
 * Build alternateDials for drill contestability.
 * Per schema §5: "alternateDials: Array<{description, dialPositions, resultingAction}>"
 *
 * v1 produces two alternates: "all dials to 0" and "all dials to 1".
 * Real implementation can explore finer granularity via future enhancements.
 */
const buildContestability = ({ applied, baseline, baselineAction }) => {
  if (!Array.isArray(applied) || applied.length === 0) {
    return { alternateDials: [] };
  }

  const zeroDials = {};
  const oneDials = {};
  for (const a of applied) {
    if (a.id) {
      zeroDials[a.id] = 0;
      oneDials[a.id] = 1;
    }
  }

  return {
    alternateDials: [
      {
        description: 'All dials → 0 (balanced-baseline recommendation)',
        dialPositions: zeroDials,
        resultingAction: baselineAction,
      },
      {
        description: 'All dials → 1 (full commitment)',
        dialPositions: oneDials,
        // Full commitment returns the same recommendation the primary dial would; for v1
        // we label it without re-running derivation (which would require producing another
        // CitedDecision recursively — architecturally acceptable to summarize).
        resultingAction: deriveRecommendedAction(
          baselineAction,
          applied.map((a) => ({
            ...a,
            operator: { ...a.operator, currentDial: 1 },
          })),
          baseline,
        ),
      },
    ],
  };
};
