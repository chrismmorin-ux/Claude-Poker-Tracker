/**
 * reconstruct.js — PMC Phase 5a primitive (WS-177 / SPR-068) +
 *                  Phase 5a-2 engine queries (WS-178 / SPR-070).
 *
 * Reconstructs a `predictionAudit` payload from a saved hand. Called at
 * hand-save time by usePersistence (Q1 ratified — post-hoc reconstruction
 * at hand-end; zero coupling into live-decision hot paths).
 *
 * SCOPE
 *   - observedAction[]: fully populated from actionSequence (Phase 5a).
 *   - predictedDistribution[]: one entry per modeled decision-node (Phase 5a-2).
 *       * Hero decision-nodes: soft policy from evaluateGameTree EVs (softmax).
 *       * Villain preflop decision-nodes: action-probability distribution
 *         derived from rangeProfile per-action grid sums.
 *       * Villain postflop decision-nodes: empty distribution this ship —
 *         requires villainDecisionModel/actionRates from gameTreeContext,
 *         which exceeds "no new range-engine math" per WS-178 scope.
 *   - modelVersion: composed via composeModelVersion() from the writer.
 *
 * FOUNDER RATIFICATIONS (SPR-070, 2026-05-10)
 *   D1 — Engine plumbing: ref-getter bridge. usePersistence reads
 *        deps via engineCtxGetterRef.current?.() at save time.
 *   D2 — Decision-node identification: configurable `isModeledNode`
 *        predicate; default = "first betting action by a seat on a street".
 *   D3 — Empty-distribution policy: record `distribution: []` and continue.
 *        Preserves 1:1 alignment between observedAction[] and
 *        predictedDistribution[] entry counts.
 *
 * AP-PMC-04: predictedDistribution entries are model OUTPUT, not user
 * identity. The hero-evRealized strip in the writer's sanitizer governs
 * observedAction only — predictedDistribution passes through unchanged.
 *
 * Pure-ish: deterministic given (handData, deps). No IDB access.
 */

import { composeModelVersion } from '../persistence/predictionAuditWriter';
import { getVillainRange } from '../rangeEngine/rangeAccessors';
import { getPositionName } from '../positionUtils';

const HERO_ACTOR_ID = 'hero';

const BETTING_ACTIONS = new Set([
  'bet', 'raise', 'call', 'check', 'fold',
  'open', '3bet', 'three-bet', 'threeBet',
  'allIn', 'all-in', 'all_in',
]);

const PREFLOP_VILLAIN_CANDIDATES = ['open', 'coldCall', 'threeBet'];

const actorOf = (seat, mySeat) =>
  (seat != null && seat === mySeat) ? 'hero' : 'villain';

const actorIdOf = (seat, mySeat, seatPlayers) => {
  if (seat != null && seat === mySeat) return HERO_ACTOR_ID;
  if (!seatPlayers || typeof seatPlayers !== 'object') return null;
  const pid = seatPlayers[seat];
  return pid == null ? null : pid;
};

/**
 * Default predicate: first betting action by a seat on a given street is a
 * modeled decision-node. Matches what the engine actually models well —
 * preflop opens, cbet decisions, and first action on each subsequent street.
 *
 * Custom predicates can widen or narrow this set per-caller.
 *
 * @param {Object} entry — actionSequence entry { seat, action, street, ... }
 * @param {Object} ctx — { street, seat, actor, actorId, prevActionsThisStreet, fullActionSequence, index }
 */
const defaultIsModeledNode = (entry, ctx) => {
  if (!entry || !BETTING_ACTIONS.has(entry.action)) return false;
  const { seat, prevActionsThisStreet } = ctx;
  return !prevActionsThisStreet.some(prev => prev.seat === seat);
};

/**
 * Villain preflop action-distribution from rangeProfile per-action grid sums.
 * Sums each candidate-action grid (open / coldCall / threeBet) and normalizes.
 *
 * Returns [] when no usable grid is present (D3=A — empty array is the
 * "model couldn't evaluate" signal).
 */
const buildVillainPreflopDistribution = (rangeProfile, position) => {
  if (!rangeProfile?.ranges?.[position]) return [];
  const totals = PREFLOP_VILLAIN_CANDIDATES
    .map(action => {
      const grid = getVillainRange(rangeProfile, position, action);
      if (!grid) return null;
      let sum = 0;
      for (let i = 0; i < grid.length; i++) sum += grid[i];
      return { action, raw: sum };
    })
    .filter(x => x && x.raw > 0);
  if (totals.length === 0) return [];
  const totalRaw = totals.reduce((s, x) => s + x.raw, 0);
  return totals.map(x => ({ action: x.action, weight: x.raw / totalRaw }));
};

/**
 * Softmax normalization of evaluateGameTree action EVs into a soft policy
 * distribution. Stable formulation (subtracts max EV before exp).
 *
 * Returns [] when no actions or all EVs are non-finite.
 */
const softmaxNormalize = (actions) => {
  if (!Array.isArray(actions) || actions.length === 0) return [];
  const evs = actions.map(a => Number.isFinite(a?.ev) ? a.ev : -Infinity);
  let max = -Infinity;
  for (const ev of evs) { if (ev > max) max = ev; }
  if (!Number.isFinite(max)) return [];
  const exps = evs.map(ev => ev === -Infinity ? 0 : Math.exp(ev - max));
  let sum = 0;
  for (const x of exps) sum += x;
  if (sum === 0) return [];
  return actions.map((a, i) => {
    const out = { action: a.action, weight: exps[i] / sum };
    if (a.sizing != null) out.sizing = a.sizing;
    return out;
  });
};

/**
 * Hero decision-node policy from evaluateGameTree.
 *
 * NOTE (Phase 5a-2 scope): production snapshot construction is intentionally
 * minimal. evaluateGameTree expects { villainRange, board, heroCards,
 * potSize, villainAction, ... } — fully reconstructing those from saved
 * handData (potSize at the exact decision-node, single-villain identification
 * in multiway, board cards by street, etc.) is non-trivial and a known
 * weak spot. We pass a context shape and rely on evaluateGameTree's own
 * input validation to fail cleanly on incomplete inputs — caught here and
 * recorded as `distribution: []` per D3=A.
 *
 * Tests inject a mocked `evaluateGameTree` that returns `{ actions: [...] }`
 * to verify the softmax pipeline without depending on snapshot quality.
 *
 * A follow-up ticket can flesh out a proper post-hoc evaluator input
 * (similar pattern to useHandReplayAnalysis seatRangeProfiles).
 */
const buildHeroDistribution = async ({ handData, entry, ctx, evaluateGameTree }) => {
  if (typeof evaluateGameTree !== 'function') return [];
  let result;
  try {
    result = await evaluateGameTree({ handData, entry, ctx });
  } catch (e) {
    return [];
  }
  const actions = Array.isArray(result?.actions) ? result.actions : [];
  return softmaxNormalize(actions);
};

/**
 * Reconstruct a predictionAudit payload from the given handData snapshot.
 *
 * @param {Object} handData — saveHand input shape:
 *   { gameState: { actionSequence, mySeat, dealerButtonSeat, ... },
 *     seatPlayers: { [seat]: playerId, ... }, ... }
 * @param {Object} [deps] — engine-context dependencies. When empty,
 *   `predictedDistribution[]` is empty (Phase 5a behavior preserved).
 *   { isModeledNode?, getRangeProfile?, evaluateGameTree? }
 *     - isModeledNode: (entry, ctx) => boolean — defaults to first-action-per-street-per-actor
 *     - getRangeProfile: (playerId) => RangeProfile | null — typically tendencyMap[id]?.rangeProfile
 *     - evaluateGameTree: stateless reference from exploitEngine
 * @returns {Promise<{
 *   predictedDistribution: Array<{ actor, actorId, seat, distribution }>,
 *   observedAction: Array<{ actor, actorId, seat, actionTaken, sizing? }>,
 *   modelVersion: string,
 * }>}
 */
export const reconstructPredictionAudit = async (handData, deps = {}) => {
  const gameState = (handData && handData.gameState) || {};
  const actionSequence = Array.isArray(gameState.actionSequence)
    ? gameState.actionSequence
    : [];
  const mySeat = gameState.mySeat;
  const dealerButtonSeat = gameState.dealerButtonSeat;
  const seatPlayers = (handData && handData.seatPlayers) || {};

  const observedAction = actionSequence.map((entry) => {
    const seat = entry?.seat ?? null;
    const result = {
      actor: actorOf(seat, mySeat),
      actorId: actorIdOf(seat, mySeat, seatPlayers),
      seat,
      actionTaken: entry?.action ?? null,
    };
    if (entry && typeof entry.amount === 'number') {
      result.sizing = entry.amount;
    }
    return result;
  });

  // Phase 5a backward compatibility: if no engine-context deps were provided
  // (Phase 5a callers, or persistence before <EngineCtxBridge/> populates the
  // ref), return an empty predictedDistribution[] — same shape as Phase 5a.
  // The new predicate-driven population only activates when the caller opts
  // in by providing at least one dep function.
  const hasAnyDep = deps && (
    typeof deps.isModeledNode === 'function' ||
    typeof deps.getRangeProfile === 'function' ||
    typeof deps.evaluateGameTree === 'function'
  );
  if (!hasAnyDep) {
    return { predictedDistribution: [], observedAction, modelVersion: composeModelVersion() };
  }

  const {
    isModeledNode = defaultIsModeledNode,
    getRangeProfile,
    evaluateGameTree,
  } = deps;

  const predictedDistribution = [];
  const prevActionsByStreet = {};

  for (let i = 0; i < actionSequence.length; i++) {
    const entry = actionSequence[i];
    const street = entry?.street ?? null;
    const seat = entry?.seat ?? null;

    if (street && seat != null) {
      const prevActionsThisStreet = prevActionsByStreet[street] || [];
      const actor = actorOf(seat, mySeat);
      const actorId = actorIdOf(seat, mySeat, seatPlayers);
      const ctx = {
        street,
        seat,
        actor,
        actorId,
        prevActionsThisStreet: prevActionsThisStreet.slice(),
        fullActionSequence: actionSequence,
        index: i,
      };

      if (isModeledNode(entry, ctx)) {
        let distribution = [];
        if (actor === 'hero') {
          distribution = await buildHeroDistribution({
            handData, entry, ctx, evaluateGameTree,
          });
        } else if (actor === 'villain') {
          if (street === 'preflop') {
            const rangeProfile = (typeof getRangeProfile === 'function' && actorId != null)
              ? getRangeProfile(actorId)
              : null;
            const position = getPositionName(seat, dealerButtonSeat);
            distribution = buildVillainPreflopDistribution(rangeProfile, position);
          }
          // postflop villain → distribution stays [] this ship (D3=A)
        }
        predictedDistribution.push({ actor, actorId, seat, distribution });
      }
    }

    if (street) {
      prevActionsByStreet[street] = prevActionsByStreet[street] || [];
      prevActionsByStreet[street].push(entry);
    }
  }

  return {
    predictedDistribution,
    observedAction,
    modelVersion: composeModelVersion(),
  };
};
