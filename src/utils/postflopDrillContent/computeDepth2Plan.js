/**
 * computeDepth2Plan — depth-2-accurate engine plan for the Hand Plan Layer.
 *
 * LSW-D1: replaces the v1-simplified-ev path in `computeEnginePlan` with a
 * direct call to `evaluateGameTree`, which:
 *   - computes per-combo equity (no group approximation)
 *   - models villain's response with depth-2/3 narrowing
 *   - returns `recommendations[].handPlan` (built by `buildResponseGuidance`)
 *     with structured branches — `ifCall`, `ifRaise`, `ifVillainBets`,
 *     `ifVillainChecks`, `nextStreet` — that populate `EnginePlan.nextStreetPlan`
 *
 * Output shape mirrors `derivePlanFromBucketEVs` (planDerivation.js) so
 * HandPlanSection can swap derivations transparently. Caveats differ:
 *   - 'v1-simplified-ev' is omitted on success
 *   - 'real-range' replaces 'synthetic-range' (we use the real archetype range)
 *   - 'depth2-bailed-out' is added when `treeMetadata.depthReached < 2`
 *
 * Pure module — depends only on the exploit engine + pokerCore + EV math.
 */

import { evaluateGameTree } from '../exploitEngine/gameTreeEvaluator';
import { parseAndEncode } from '../pokerCore/cardParser';

/**
 * Translate a 4-char combo string ('J♥T♠') to a 2-element integer array
 * `[card1, card2]` suitable for `evaluateGameTree.heroCards`.
 */
const parseHeroCombo = (comboStr) => {
  if (typeof comboStr !== 'string' || comboStr.length !== 4) return null;
  const c1 = parseAndEncode(comboStr.slice(0, 2));
  const c2 = parseAndEncode(comboStr.slice(2, 4));
  if (c1 < 0 || c2 < 0 || c1 === c2) return null;
  return [c1, c2];
};

/**
 * Map drill-engine villain action kinds to the engine's `villainAction`
 * input. The engine treats `cbet` as `bet` for response modeling and uses
 * `donk` as a distinct context flag when hero is the preflop aggressor.
 */
const mapVillainAction = (kind) => {
  if (typeof kind !== 'string') return undefined;
  switch (kind) {
    case 'cbet':
    case 'bet':       return 'bet';
    case 'donk':      return 'donk';
    case 'raise':     return 'raise';
    case 'checkraise':return 'raise';
    case 'check':     return 'check';
    case 'call':      return undefined; // engine ignores; villain has no live action
    case 'fold':      return undefined;
    default:          return undefined;
  }
};

/**
 * Compute villain bet size in big blinds from authored size fraction + pot.
 * Returns 0 when villain action is non-bet (check, call, fold).
 */
const computeVillainBet = (villainAction, pot) => {
  if (!villainAction || typeof villainAction !== 'object') return 0;
  const { kind, size } = villainAction;
  const isBetKind = kind === 'bet' || kind === 'cbet' || kind === 'donk' || kind === 'raise' || kind === 'checkraise';
  if (!isBetKind) return 0;
  if (!Number.isFinite(size) || size <= 0) return 0;
  if (!Number.isFinite(pot) || pot <= 0) return 0;
  return pot * size;
};

/**
 * Build an EnginePlan errorState envelope. Mirrors the shape of
 * `derivePlanFromBucketEVs` so HandPlanSection's error-rendering branch
 * stays universal.
 */
const errorPlan = (heroCombo, decisionKind, kind, userMessage, diagnostic, recovery) => ({
  heroCombo,
  perAction: [],
  bestActionLabel: null,
  bestActionReason: null,
  decisionKind,
  caveats: [],
  nextStreetPlan: null,
  errorState: { kind, userMessage, diagnostic, ...(recovery ? { recovery } : {}) },
});

/**
 * @typedef {object} ComputeDepth2PlanInput
 * @property {string} heroCombo            — 4-char combo (e.g. 'J♥T♠')
 * @property {Float64Array} villainRange   — 1326-length range vector
 * @property {number[]} board              — encoded card integers (3-5)
 * @property {number} pot                  — bb
 * @property {{kind, size?}} [villainAction] — node.villainAction shape
 * @property {string} [decisionKind]       — 'standard' | 'bluff-catch' | 'thin-value'
 * @property {object} [contextHints]       — passed through to evaluateGameTree
 * @property {number} [trials=500]
 * @property {number} [effectiveStack]
 * @property {object} [villainModel]
 * @property {object} [playerStats]
 */

/**
 * Compute a depth-2 EnginePlan via `evaluateGameTree`.
 *
 * Returns an `EnginePlan` (same shape as `derivePlanFromBucketEVs`):
 *   { heroCombo, perAction, bestActionLabel, bestActionReason, decisionKind,
 *     caveats, nextStreetPlan, errorState }
 *
 * Never throws — always returns a plan with populated `errorState` on
 * failure (matches I-HP-2 graceful-degradation contract).
 *
 * @param {ComputeDepth2PlanInput} input
 * @returns {Promise<EnginePlan>}
 */
export const computeDepth2Plan = async (input) => {
  if (!input || typeof input !== 'object') {
    return errorPlan(null, 'standard', 'engine-internal', 'Missing input', 'input is null/undefined');
  }
  const {
    heroCombo,
    villainRange,
    board,
    pot,
    villainAction = null,
    decisionKind = 'standard',
    contextHints = {},
    trials = 500,
    effectiveStack = null,
    villainModel = null,
    playerStats = null,
  } = input;

  // Validation (parallel to computeBucketEVsV2's pre-flight)
  if (typeof heroCombo !== 'string' || heroCombo.length !== 4) {
    return errorPlan(heroCombo, decisionKind, 'malformed-hero',
      'heroCombo must be a 4-char combo string',
      `heroCombo was ${JSON.stringify(heroCombo)}`);
  }
  const heroCards = parseHeroCombo(heroCombo);
  if (!heroCards) {
    return errorPlan(heroCombo, decisionKind, 'malformed-hero',
      'heroCombo could not be parsed',
      `parseHeroCombo returned null for '${heroCombo}'`);
  }
  if (!(villainRange instanceof Float64Array) || villainRange.length === 0) {
    return errorPlan(heroCombo, decisionKind, 'range-unavailable',
      'Villain range missing',
      'villainRange must be a non-empty Float64Array');
  }
  if (!Array.isArray(board) || board.length < 3 || board.length > 5) {
    return errorPlan(heroCombo, decisionKind, 'malformed-hero',
      'Board must have 3-5 cards',
      `board was ${JSON.stringify(board)}`);
  }
  if (!Number.isFinite(pot) || pot < 0) {
    return errorPlan(heroCombo, decisionKind, 'engine-internal',
      'Invalid pot',
      `pot was ${pot}`);
  }

  const villainBet = computeVillainBet(villainAction, pot);
  const vAction = mapVillainAction(villainAction?.kind);

  // Run the game tree.
  let tree;
  try {
    tree = await evaluateGameTree({
      villainRange,
      board,
      heroCards,
      potSize: pot,
      villainAction: vAction,
      villainBet,
      contextHints,
      trials,
      effectiveStack,
      villainModel,
      playerStats,
    });
  } catch (err) {
    return errorPlan(heroCombo, decisionKind, 'engine-internal',
      'Engine error computing game tree',
      err?.message || String(err));
  }

  if (!tree || !Array.isArray(tree.recommendations) || tree.recommendations.length === 0) {
    return errorPlan(heroCombo, decisionKind, 'engine-internal',
      'Game tree returned no recommendations',
      'evaluateGameTree output had empty recommendations array');
  }

  // Translate recommendations → perAction.
  // recommendations[] is sorted by EV descending; treeMetadata.branches counts
  // hero actions evaluated. The first entry is the best action.
  const perAction = tree.recommendations.map((r, i) => ({
    actionLabel: typeof r.action === 'string' ? r.action : '',
    actionKind: typeof r.action === 'string' ? r.action : null,
    betFraction: Number.isFinite(r.sizing?.betFraction) ? r.sizing.betFraction : null,
    ev: Number.isFinite(r.ev) ? r.ev : 0,
    evLow: null, // depth-2 doesn't surface CI bounds today; defer to D2
    evHigh: null,
    isBest: i === 0,
    unsupported: false,
  }));

  const best = tree.recommendations[0];
  const bestActionLabel = typeof best?.action === 'string' && best.action.length > 0
    ? best.action
    : null;
  const bestActionReason = typeof best?.reasoning === 'string' && best.reasoning.length > 0
    ? best.reasoning
    : null;

  // Caveats — clear v1-simplified-ev (depth-2 IS real EV); add bailedOut
  // marker when the tree didn't reach depth 2.
  const caveats = ['real-range'];
  const depthReached = tree.treeMetadata?.depthReached ?? 1;
  if (depthReached < 2) {
    caveats.push('depth2-bailed-out');
  }
  if (tree.modelQuality?.overallSource === 'population') {
    caveats.push('population-priors');
  }

  // Pass through the structured handPlan (built by `buildResponseGuidance`)
  // — when present, it carries the forward-look branches the v1 stub couldn't.
  const nextStreetPlan = best?.handPlan || null;

  return {
    heroCombo,
    perAction,
    bestActionLabel,
    bestActionReason,
    decisionKind,
    caveats,
    nextStreetPlan,
    errorState: null,
    // Diagnostic footer — surfaces depthReached/computeMs to UI for
    // optional rendering. Not required for plan rendering.
    treeMetadata: tree.treeMetadata || null,
  };
};
