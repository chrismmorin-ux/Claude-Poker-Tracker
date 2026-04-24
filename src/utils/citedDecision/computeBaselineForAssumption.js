/**
 * computeBaselineForAssumption.js — Async wrapper around gameTreeEvaluator for citations
 *
 * Part of the citedDecision module. See `CLAUDE.md` for rules (mandatory read).
 *
 * Purpose: given a VillainAssumption + villainTendency, produce the `BaselineEvaluation`
 * object that `produceCitedDecision({ baseline })` expects. The baseline is the
 * engine depth-3 evaluation per Theory Roundtable Stage 4 — dividend is always
 * measured against this, not against GTO or hero's current strategy.
 *
 * Two call modes:
 *   1. With synthesized node (drill) — pass assumption + villainTendency, we
 *      synthesize via baselineSynthesis.js.
 *   2. With explicit node (backtest, live) — pass node directly; we still wrap
 *      the gameTree call and adapt the result.
 *
 * Failure modes (per architecture §5 I-AE-6):
 *   - `evaluateGameTree` throws → return { baseline: null, reason: 'gameTree-error' }
 *   - `evaluateGameTree` bails out (no recommendations) → { baseline: null, reason: 'gameTree-empty' }
 *   - Downstream consumer (produceCitedDecision) returns { citation: null, reason: 'insufficient-baseline' }
 *   - Drill UI labels "compute timed out — try again or skip" per surface spec line 338.
 *
 * Pure outside of the gameTree call (which itself is async but pure w.r.t. inputs).
 */

import { evaluateGameTree } from '../exploitEngine/gameTreeEvaluator';
import { synthesizeNodeFromAssumption } from './baselineSynthesis';

// ───────────────────────────────────────────────────────────────────────────
// Adaptation: gameTree output → BaselineEvaluation shape
// ───────────────────────────────────────────────────────────────────────────

/**
 * gameTreeEvaluator returns:
 *   {
 *     recommendations: [{ action, ev, sizing, villainResponse, ... }, ...],
 *     heroEquity, segmentation, bucketEquities, foldPct, treeMetadata, ...
 *   }
 *
 * produceCitedDecision expects:
 *   baseline: {
 *     actionEVs: { [actionName]: { ev, sizing } },
 *     villainDistribution: { fold, call, raise },  // ActionDistribution summing to 1
 *     recommendedAction: { action, ev, sizing },
 *   }
 */
const distributionFromVillainResponse = (villainResponse) => {
  if (!villainResponse || typeof villainResponse !== 'object') {
    return { fold: 0.4, call: 0.5, raise: 0.1 };
  }
  const fold = villainResponse.fold?.pct ?? 0;
  const call = villainResponse.call?.pct ?? 0;
  const raise = villainResponse.raise?.pct ?? 0;
  const sum = fold + call + raise;
  if (sum <= 0) {
    // Villain responded with check/bet branches instead (hero checked / donked)
    // Coerce into a neutral distribution.
    return { fold: 0.4, call: 0.5, raise: 0.1 };
  }
  return { fold: fold / sum, call: call / sum, raise: raise / sum };
};

const adaptResultToBaselineEvaluation = (result) => {
  const recs = Array.isArray(result?.recommendations) ? result.recommendations : [];
  if (recs.length === 0) return null;

  const actionEVs = {};
  let bestRec = null;
  let bestEV = -Infinity;
  for (const rec of recs) {
    const sizing = rec.sizing?.betFraction
      ?? rec.sizing?.sizing
      ?? (typeof rec.sizing === 'number' ? rec.sizing : null);
    const safeEV = Number.isFinite(rec.ev) ? rec.ev : 0;
    actionEVs[rec.action] = { ev: safeEV, sizing };
    // Pick best by safe EV (NaN coerced to 0 above; comparisons are valid).
    if (safeEV > bestEV) {
      bestEV = safeEV;
      bestRec = { action: rec.action, ev: safeEV, sizing };
    }
  }
  if (!bestRec) return null;

  // Find the original recommendation record to extract villainResponse for distribution.
  const bestOriginal = recs.find((r) => r.action === bestRec.action);
  const villainDistribution = distributionFromVillainResponse(bestOriginal?.villainResponse);

  return {
    actionEVs,
    villainDistribution,
    recommendedAction: {
      action: bestRec.action,
      ev: bestRec.ev,
      sizing: bestRec.sizing,
    },
  };
};

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

/**
 * Compute a BaselineEvaluation for a given assumption.
 *
 * @param {Object} params
 * @param {Object} params.assumption     — VillainAssumption v1.1
 * @param {Object} [params.villainTendency={}] — { style, observedRates, ... }
 * @param {Object} [params.node]          — Optional pre-synthesized game state. If absent, synthesized internally.
 * @param {Object} [params.opts={}]
 * @returns {Promise<{
 *   baseline: Object | null,
 *   node: Object,
 *   source: 'synthesized' | 'real' | null,
 *   reason?: 'gameTree-empty' | 'gameTree-error',
 *   error?: string,
 *   treeMetadata?: Object,
 * }>}
 */
export const computeBaselineForAssumption = async ({
  assumption,
  villainTendency = {},
  node = null,
  opts = {},
} = {}) => {
  if (!assumption) {
    return { baseline: null, node: null, source: null, reason: 'missing-assumption' };
  }

  const gameState = node ?? synthesizeNodeFromAssumption(assumption, villainTendency, opts);

  try {
    const result = await evaluateGameTree({
      villainRange: gameState.villainRange,
      board: gameState.board,
      heroCards: gameState.heroCards,
      potSize: gameState.potSize,
      villainAction: gameState.villainAction,
      villainBet: gameState.villainBet,
      effectiveStack: gameState.effectiveStack,
      numOpponents: gameState.numOpponents ?? 1,
      // playerStats + villainModel left undefined — gameTreeContext falls back to
      // population priors when absent, which is acceptable for a drill teaching spot.
      playerStats: opts.playerStats,
      villainModel: opts.villainModel,
      // trials: keep conservative to stay under perf budget (≤80ms ceiling per architecture §6).
      trials: opts.trials ?? 300,
      contextHints: opts.contextHints ?? {},
      rakeConfig: opts.rakeConfig ?? null,
    });

    const baseline = adaptResultToBaselineEvaluation(result);
    if (!baseline) {
      return {
        baseline: null,
        node: gameState,
        source: gameState.synthesized ? 'synthesized' : 'real',
        reason: 'gameTree-empty',
        treeMetadata: result?.treeMetadata,
      };
    }

    return {
      baseline,
      node: gameState,
      source: gameState.synthesized ? 'synthesized' : 'real',
      treeMetadata: result?.treeMetadata,
    };
  } catch (err) {
    return {
      baseline: null,
      node: gameState,
      source: gameState.synthesized ? 'synthesized' : 'real',
      reason: 'gameTree-error',
      error: err?.message ?? String(err),
    };
  }
};

// Exposed for tests only
export const __TEST_ONLY__ = Object.freeze({
  adaptResultToBaselineEvaluation,
  distributionFromVillainResponse,
});
