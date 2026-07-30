/**
 * heroPolicy.mjs — pi_ours(a | s): what the ENGINE advises at a decision node.
 *
 * THE PROBLEM THIS SOLVES. `evaluateGameTree` requires `heroCards`, and the corpus
 * masks hole cards pre-showdown (`d dh p1 ????`). The obvious workaround — score only
 * hands where the cards were revealed at showdown — is badly biased and unusable: a
 * player who folds never shows, so that subset contains ZERO fold decisions, and it
 * conditions on reaching showdown, an event downstream of the very decision being
 * scored.
 *
 * THE RESOLUTION. Treat the engine's advice as a DISTRIBUTION over actions, taken over
 * the holdings hero could actually have at that node:
 *
 *     pi_ours(a | s) = sum over combos h in hero's range of P(h | s) * 1[engine advises a | h]
 *
 * The range is the one the app itself infers — `decisionAccumulator` narrows it street
 * by street and the WS-287 seam emits it as `rangeBefore`, taken BEFORE hero's own
 * action is folded in so the advice is not conditioned on the action being scored.
 * No hole cards are required and no showdown selection arises.
 *
 * This also changes what the number MEANS, and the result doc must say so: it is the
 * value of the engine's advice averaged over the hands hero could hold, not over the
 * hand hero actually held. That is a weaker claim than a cards-known instrument would
 * make, and it is the strongest claim this corpus supports.
 *
 * SAMPLING IS SYSTEMATIC, NOT RANDOM. Combos are ordered by board-relative strength and
 * sampled at equally-spaced cumulative-weight points. This stratifies across the whole
 * strength spectrum in proportion to range mass — nuts through air — rather than
 * leaving coverage to luck at the small K the engine's cost forces. It is also exactly
 * reproducible, which a backtest requires.
 *
 * WHAT V1 DOES NOT DO — the villain is at POPULATION baseline, not personalized. The
 * per-villain model is already scored by C1 (58.7% accuracy, WS-285); C3 asks about the
 * DECISION SPINE (POKER_THEORY 6.1-6.4 plus sizing and multiway) that sits between a
 * villain model and a recommendation. Holding the villain at baseline isolates the
 * spine instead of re-measuring personalization through it. The interaction of the two
 * is a v2 arm, not a silent omission.
 */

import { enumerateCombos } from '../../src/utils/pokerCore/rangeMatrix.js';
import { comboStrengthPercentile } from '../../src/utils/pokerCore/handEvaluator.js';
import { getRangePositionCategory } from '../../src/utils/positionUtils.js';
import { buildBaselineRange } from '../../src/utils/exploitEngine/preflopAdvisor.js';
import { evaluateGameTree } from '../../src/utils/exploitEngine/gameTreeEvaluator.js';
import { buildPlayerStats } from '../../src/utils/exploitEngine/liveGameContext.js';
import { PRIMITIVE_ACTIONS } from '../../src/constants/primitiveActions.js';
import { RESPONSES_BY_FACING } from './behaviorPolicy.mjs';
import { decisionGeometry, liveOpponentCount } from './decisionGeometry.mjs';

/** Default number of holdings sampled from hero's range per decision. */
export const DEFAULT_COMBO_SAMPLES = 10;

/** Monte Carlo trials per engine call. Lower than the app's 500 — see costNote. */
export const DEFAULT_TRIALS = 200;

export const POLICY_SKIP_REASONS = {
  EMPTY_RANGE: 'empty-range',
  NO_COMBOS: 'no-combos',
  ENGINE_ERROR: 'engine-error',
  NO_RECOMMENDATION: 'no-recommendation',
  ACTION_OUT_OF_SET: 'action-out-of-set',
  BAD_GEOMETRY: 'bad-geometry',
};

/**
 * The engine's action vocabulary is richer than the corpus's. Map each recommendation
 * onto the primitive that would actually be RECORDED at this node.
 *
 * `check-raise` is the one that matters: it is a plan, not an immediate action, and the
 * action taken right now is a check. Recording it as a raise would compare our advice
 * against an action the hand history could not contain.
 */
const toPrimitive = (action) => {
  switch (action) {
    case 'check-raise': return PRIMITIVE_ACTIONS.CHECK;
    case 'fold': return PRIMITIVE_ACTIONS.FOLD;
    case 'check': return PRIMITIVE_ACTIONS.CHECK;
    case 'call': return PRIMITIVE_ACTIONS.CALL;
    case 'bet': return PRIMITIVE_ACTIONS.BET;
    case 'raise': return PRIMITIVE_ACTIONS.RAISE;
    default: return null;
  }
};

/**
 * Systematic weight-proportional sample of `k` combos, ordered by board strength.
 *
 * Sorting by strength before systematic sampling is what makes this stratified: the
 * sample points march up the strength axis, so a range that is 20% nutted and 40% air
 * contributes roughly that mix at any k, instead of depending on where random draws
 * happened to land.
 */
export const sampleCombos = (range, board, k = DEFAULT_COMBO_SAMPLES) => {
  const combos = enumerateCombos(range, board);
  if (combos.length === 0) return [];

  for (const c of combos) {
    c.strength = comboStrengthPercentile(c.card1, c.card2, board);
  }
  combos.sort((a, b) => a.strength - b.strength);

  const total = combos.reduce((s, c) => s + c.weight, 0);
  if (!(total > 0)) return [];
  if (combos.length <= k) {
    return combos.map((c) => ({ ...c, sampleWeight: c.weight / total }));
  }

  // Equally spaced cumulative-weight points, offset to the midpoint of each stratum
  // so the sample is not biased toward either tail.
  const out = [];
  const step = total / k;
  let cum = 0;
  let idx = 0;
  for (let i = 0; i < k; i++) {
    const target = (i + 0.5) * step;
    while (idx < combos.length - 1 && cum + combos[idx].weight < target) {
      cum += combos[idx].weight;
      idx++;
    }
    out.push({ ...combos[idx], sampleWeight: 1 / k });
  }
  return out;
};

/**
 * Compute pi_ours at one decision node.
 *
 * @param {Object} args
 * @param {Object} args.ctx   - the decisionAccumulator seam payload
 * @param {Object} args.hand  - app-shaped corpus hand
 * @param {Object} [args.rakeConfig]
 * @param {number} [args.comboSamples]
 * @param {number} [args.trials]
 * @returns {Promise<{ok: true, actions, samples, engineErrors}|{ok: false, reason}>}
 */
export const heroPolicyAt = async ({
  ctx, hand, rakeConfig = null,
  comboSamples = DEFAULT_COMBO_SAMPLES,
  trials = DEFAULT_TRIALS,
}) => {
  const responses = RESPONSES_BY_FACING[ctx.facingAction] || RESPONSES_BY_FACING.none;
  const board = ctx.board;
  const range = ctx.rangeBefore;
  if (!range || !board || board.length < 3) {
    return { ok: false, reason: POLICY_SKIP_REASONS.EMPTY_RANGE };
  }

  const combos = sampleCombos(range, board, comboSamples);
  if (combos.length === 0) return { ok: false, reason: POLICY_SKIP_REASONS.NO_COMBOS };

  const geo = decisionGeometry(hand, ctx.order, ctx.street);
  if (!geo) return { ok: false, reason: POLICY_SKIP_REASONS.BAD_GEOMETRY };

  // The engine takes the pot EXCLUDING the bet hero is facing and re-adds it
  // internally (gameTreeEvaluator: `effectivePot = potSize + villainBet` for a raise).
  // Passing the raw pot here would count the live bet twice and shift every pot-odds
  // and breakeven computation downstream of it.
  const villainBet = geo.betChips;
  const potSize = geo.enginePotChips;

  const villainAction = ctx.facingAction === 'none' ? undefined : ctx.facingAction;
  const buttonSeat = hand.gameState.dealerButtonSeat;
  const villainSeat = ctx.opponentSeat;
  const villainPos = villainSeat != null
    ? getRangePositionCategory(Number(villainSeat), buttonSeat)
    : 'LATE';

  // Population-typical villain: null stats resolve to POPULATION_PRIORS inside the
  // engine, which is precisely the baseline this arm intends. See the header.
  const villainData = { vpip: null, pfr: null, af: null, style: null, rawStats: {} };
  const playerStats = buildPlayerStats(villainData, villainPos);
  const villainRange = buildBaselineRange(null, null, villainPos);

  const numOpponents = Math.max(1, liveOpponentCount(hand, ctx.order, ctx.playerSeat));
  // The acting seat's OWN remaining stack, not the multiway effective stack — a
  // documented approximation inherited from the adapter (phhAdapter `_backtest`).
  const effectiveStack = geo.stackChips;

  const counts = {};
  for (const a of responses) counts[a] = 0;
  let engineErrors = 0;
  let outOfSet = 0;
  let used = 0;

  for (const combo of combos) {
    let result;
    try {
      result = await evaluateGameTree({
        villainRange,
        board,
        heroCards: [combo.card1, combo.card2],
        potSize,
        villainAction,
        villainBet,
        deadCards: board,
        playerStats,
        villainModel: null,
        trials,
        contextHints: {
          observations: [],
          sizingTells: null,
          texture: ctx.texture,
          posCategory: ctx.posCategory,
          isIP: ctx.isIP === 'ip',
          isPreflopAggressor: ctx.isAgg === 'agg',
        },
        effectiveStack,
        numOpponents,
        opponentModels: [],
        rakeConfig,
      });
    } catch {
      engineErrors++;
      continue;
    }

    const top = result?.recommendations?.[0];
    if (!top) { engineErrors++; continue; }

    const primitive = toPrimitive(top.action);
    if (!primitive || !responses.includes(primitive)) { outOfSet++; continue; }

    counts[primitive] += combo.sampleWeight;
    used += combo.sampleWeight;
  }

  if (used <= 0) {
    return {
      ok: false,
      reason: engineErrors > 0
        ? POLICY_SKIP_REASONS.ENGINE_ERROR
        : POLICY_SKIP_REASONS.ACTION_OUT_OF_SET,
    };
  }

  // Renormalize over the mass actually used. NO smoothing is applied: a zero here is a
  // real statement — "the engine advises this action with no hand in hero's range" —
  // and smoothing it would fabricate propensity mass that the policy does not have.
  // The consequence is that such decisions get weight 0 and contribute nothing, which
  // is correct rather than lossy.
  const actions = {};
  for (const a of responses) actions[a] = counts[a] / used;

  return { ok: true, actions, samples: combos.length, engineErrors, outOfSet };
};
