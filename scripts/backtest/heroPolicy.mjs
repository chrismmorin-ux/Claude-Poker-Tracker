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
 * WS-331 — THIS PASS NOW SERVES TWO POLICIES. Alongside `actions`, it returns `perCombo`:
 * the sampled combos with the equity `evaluateGameTree` computed for each. Pool Best Response
 * (`poolBestResponse.mjs`) consumes exactly that and needs no engine call of its own.
 *
 * The sharing is not only a saving. Because both policies marginalize over the SAME combos
 * with the SAME equities, they share their `range` and `equity` layers (WS-324 `stack.js`) and
 * differ only at `ev` and `action` — so comparing them isolates the decision rule instead of
 * quietly re-measuring the equity model underneath it.
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
import { comboLabel, comboClass, compactCandidate, compactLatency } from './decisionRecord.mjs';
import { makeSeededEquityFn } from './seededEquity.mjs';
import { resolveVillain, resolveVillainModel, VILLAIN_SOURCES } from './villainFeed.mjs';

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
  // WS-334 AC5. The depth-2/3 refinement clock, passed straight through to the engine.
  //
  // `undefined` — the default — means DO NOT PASS IT, so `evaluateGameTree` applies its own
  // default and every existing caller of this module is bit-for-bit unchanged. Passing 0
  // means "refine nothing": the depth-1 answer is the whole answer, which is what the engine
  // shipped in production for the life of the project (WS-334 measured zero depth-2 calls on
  // a live evaluation). That makes the depth-1 arm a REAL historical configuration rather
  // than a hypothetical one.
  refinementBudgetMs = undefined,
  // WS-393 — capture the per-combo detail this loop already computes and currently drops.
  //
  // OFF BY DEFAULT so every existing caller is byte-identical and pays nothing. When on,
  // `comboDetail` comes back alongside `actions`: one entry per sampled holding, carrying
  // the engine's WHOLE ranked candidate list with EVs, the equity, and the refinement stage
  // ledger. Nothing here feeds `actions` — the array is built beside the counters, never
  // into them — so a run with capture on and one with it off produce the same policy.
  captureComboDetail = false,
  // WS-433 — seeded Monte Carlo, per engine call. `(comboIndex) => 32-bit seed`, derived by
  // the caller from position in the stable enumeration (seedForCombo), never from execution
  // order. `null` (the default) leaves every existing caller on unseeded Math.random,
  // bit-identical to before this parameter existed. One seeded stream per evaluateGameTree
  // call: the engine's internal equity calls are serial, so draws are reproducible
  // regardless of which worker runs the evaluation.
  equitySeedFor = null,
  // WS-436 B2 — the styled-villain feed. `villainFeed` is the parsed artifact from
  // `buildVillainFeed` (POOL players only, by construction); `villainSource` selects
  // 'null' | 'stats' | 'styled'. The default keeps every existing caller byte-identical:
  // resolveVillain returns null on the 'null' source, a missing feed, or a villain with
  // no entry, and the legacy null-stats construction below is untouched on that path.
  // NOTE the 'styled' vs 'stats' contrast is only live on an engine where the label has
  // a channel: post-WS-436 `buildPlayerStats` cannot even REPRESENT a style field, so
  // the two arms are structurally identical at HEAD — which is falsifier #1 of the
  // removal, exercised for real against the pre-WS-436 worktree in the B4 protocol.
  villainFeed = null,
  villainSource = VILLAIN_SOURCES.NULL,
  // WS-540 — the shared per-decision combo sample. See the note at its use below.
  combos: providedCombos = null,
}) => {
  const responses = RESPONSES_BY_FACING[ctx.facingAction] || RESPONSES_BY_FACING.none;
  const board = ctx.board;
  const range = ctx.rangeBefore;
  if (!range || !board || board.length < 3) {
    return { ok: false, reason: POLICY_SKIP_REASONS.EMPTY_RANGE };
  }

  // WS-540 — `sampleCombos` is a PURE function of (range, board, k), and all three are
  // properties of the DECISION, not of the arm. Every arm at a node therefore recomputed a
  // bit-identical result. Measured 2026-08-20: that recomputation was 99.2% of a five-rung
  // engine-free run, ~74% of it inside `evaluate5` via `comboStrengthPercentile`, which
  // enumerates all 1176 opponent combos per hero combo.
  //
  // `combos` lets the CALLER hand in the one shared sample. It is optional and defaults to
  // computing it, so every existing caller is bit-identical and pays exactly what it paid
  // before. Consumers only read card1/card2/sampleWeight/weight/strength — nothing mutates
  // a combo — so one array is safely shared across arms.
  const combos = providedCombos ?? sampleCombos(range, board, comboSamples);
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

  // Villain construction. Legacy default: population-typical (null stats resolve to
  // POPULATION_PRIORS inside the engine — see the header). With a feed and a non-null
  // source, the villain seat's own POOL-mined aggregate stats are served instead; the
  // engine then personalises through the continuous channels (villainFoldLevel, the
  // depth-2 shrunk transfers). No villainModel is built for fed villains: the feed
  // carries aggregate stats, not decision summaries, and post-WS-436 a summary-less
  // model's priors are population anyway — stats-only IS the production shape.
  const villainPid = villainSeat != null
    ? (hand.seatPlayers?.[String(villainSeat)] ?? null)
    : null;
  const fed = resolveVillain(villainFeed, villainPid, villainSource);
  // FIND-138. Until this line every instrument in scripts/backtest/ passed `villainModel:
  // null` — all 11 of them — so anything reaching the game tree ONLY through the villain
  // model was structurally unmeasurable. `personalizedFoldCurve` is the case that forced it:
  // it is fitted for 62.6% of corpus players, it OUTRANKS the population curve on the bet
  // path (gameTreeEvaluator.js), and no harness could tell whether changing it changed
  // anything. Null on every source but MODEL, so all existing runs stay byte-identical.
  const fedModel = resolveVillainModel(villainFeed, villainPid, villainSource);
  const villainData = fed ?? { vpip: null, pfr: null, af: null, style: null, rawStats: {} };
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

  // WS-331. The equity the engine computes per combo is exactly what a best response to the
  // FIELD needs, and it is already paid for here. Carrying it out means PBR marginalizes over
  // the SAME sampled combos with the SAME equities, so the two policies differ only in their
  // decision rule — sampling a second time would compare them over two different ranges while
  // looking like it compared their advice.
  const perCombo = [];

  // WS-295 — THE ENGINE'S STATED EV, which this loop already paid for and used to discard.
  //
  // `result.recommendations` arrives sorted descending by `ev`, so `[0].ev` is the value the
  // engine ASSERTS for the action it selected and `[1].ev` is the runner-up it beat. Only
  // `[0].action` was ever read here; the numbers went out of scope at the end of the
  // iteration. Keeping them costs one array push and is what lets the optimizer's curse be
  // measured on the same pass rather than by standing up a second one.
  //
  // Each entry is one HOLDING hero could have at this node, not one decision. The node-level
  // aggregate below is therefore taken over hero's RANGE POSTERIOR — see `evStats`.
  const evSamples = [];

  // WS-393. Pushed at the TOP of the iteration and mutated in place as facts arrive, so
  // that the `continue` paths below — engine error, no recommendation, action out of the
  // corpus vocabulary — each leave a row saying exactly which one happened. Collecting
  // only the combos that survived to the bottom would silently make this a record of the
  // spots the engine could handle.
  const comboDetail = captureComboDetail ? [] : null;

  for (let comboIndex = 0; comboIndex < combos.length; comboIndex++) {
    const combo = combos[comboIndex];
    const detail = comboDetail && {
      card1: combo.card1,
      card2: combo.card2,
      combo: comboLabel(combo.card1, combo.card2),
      comboClass: comboClass(combo.card1, combo.card2),
      sampleWeight: combo.sampleWeight,
      rangeWeight: combo.weight,
      strength: combo.strength,
      heroEquity: null,
      engineError: false,
      noRecommendation: false,
      advisedAction: null,
      advisedPrimitive: null,
      inResponseSet: null,
      candidates: null,
      depthEligible: null,
      depthReached: null,
      // WS-432: did the logical refinement budget actually constrain this evaluation?
      budgetBound: null,
      latency: null,
      modelQuality: null,
    };
    if (detail) comboDetail.push(detail);

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
        villainModel: fedModel,
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
        // Spread rather than assigned, so an unset budget leaves the key ABSENT and the
        // engine's own default applies. Assigning `refinementBudgetMs: undefined` would also
        // trigger the default today, but only because the engine happens to use a default
        // parameter; a future `?? 2000` would silently turn "unset" into "zero".
        ...(refinementBudgetMs === undefined ? {} : { refinementBudgetMs }),
        // Same spread discipline: unseeded runs leave `equityFn` ABSENT so the engine's
        // default (unseeded handVsRange) applies and the legacy path stays byte-identical.
        ...(equitySeedFor ? { equityFn: makeSeededEquityFn(equitySeedFor(comboIndex)) } : {}),
      });
    } catch {
      engineErrors++;
      if (detail) detail.engineError = true;
      continue;
    }

    if (detail) {
      detail.heroEquity = Number.isFinite(result?.heroEquity) ? result.heroEquity : null;
      detail.candidates = Array.isArray(result?.recommendations)
        ? result.recommendations.map(compactCandidate)
        : null;
      detail.depthEligible = result?.treeMetadata?.depth ?? null;
      detail.depthReached = result?.treeMetadata?.depthReached ?? null;
      detail.budgetBound = result?.treeMetadata?.budgetBound ?? null;
      detail.latency = compactLatency(result?.treeMetadata?.latency);
      detail.modelQuality = result?.modelQuality ?? null;
    }

    // Recorded BEFORE the recommendation is inspected. A combo whose engine advice falls
    // outside the corpus response set still has a perfectly good equity, and dropping it here
    // would silently narrow PBR's range to "the combos the engine had an opinion about".
    if (Number.isFinite(result?.heroEquity)) {
      perCombo.push({ sampleWeight: combo.sampleWeight, heroEquity: result.heroEquity });
    }

    const top = result?.recommendations?.[0];
    if (!top) {
      engineErrors++;
      if (detail) detail.noRecommendation = true;
      continue;
    }
    if (detail) detail.advisedAction = top.action ?? null;

    // Recorded BEFORE the corpus-vocabulary filter below, for the same reason `perCombo` is:
    // whether the engine's advice maps onto an action the hand history could contain is a fact
    // about the CORPUS, not about the engine's decision. Dropping those combos here would
    // measure the curse only on the spots the corpus happens to be able to express.
    const runnerUp = result.recommendations[1];
    if (Number.isFinite(top.ev)) {
      evSamples.push({
        w: combo.sampleWeight,
        statedEv: top.ev,
        // `null` rather than 0 when the engine offered exactly one action: a node with no
        // alternative has NO margin, and it also has no max to be optimistic about. Zeroing it
        // would plant a false "the top two were tied" at exactly the nodes where the curse is
        // structurally absent, dragging the margin covariate toward zero for the wrong reason.
        topTwoMargin: Number.isFinite(runnerUp?.ev) ? top.ev - runnerUp.ev : null,
        nActions: result.recommendations.length,
        depthReached: result?.treeMetadata?.depthReached ?? null,
        // WS-432. Whether the logical refinement budget BOUND on this evaluation. The
        // node-level share is the instrument that proves the budget still exists: a run at
        // a nonzero budget where this is uniformly false is a disabled gate, not a fast one.
        budgetBound: result?.treeMetadata?.budgetBound ?? null,
      });
    }

    const primitive = toPrimitive(top.action);
    if (detail) {
      detail.advisedPrimitive = primitive;
      detail.inResponseSet = Boolean(primitive && responses.includes(primitive));
    }
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
      // Returned even on the failure path: PBR can still be scored at a node where the
      // engine had no admissible recommendation, and refusing to hand back equities we
      // already computed would make the ceiling's decision set a subset of the engine's —
      // which would flatter the engine on exactly the spots it could not handle.
      perCombo,
      // Returned on the failure path too: a node where the engine had no admissible
      // recommendation is one of the more interesting rows in the whole file, and the
      // caller cannot ask why after the fact if the evidence is dropped here.
      comboDetail,
    };
  }

  // Renormalize over the mass actually used. NO smoothing is applied: a zero here is a
  // real statement — "the engine advises this action with no hand in hero's range" —
  // and smoothing it would fabricate propensity mass that the policy does not have.
  // The consequence is that such decisions get weight 0 and contribute nothing, which
  // is correct rather than lossy.
  const actions = {};
  for (const a of responses) actions[a] = counts[a] / used;

  return {
    ok: true, actions, samples: combos.length, engineErrors, outOfSet, perCombo,
    evStats: summarizeEv(evSamples),
    comboDetail,
    // WS-436 B2 — whether THIS decision's villain was actually served from the feed.
    // Coverage must be visible: a feed whose entries never match would silently
    // reproduce the null arm (the shipped-but-inert failure mode, WS-276 family),
    // and the aggregate comparison would read as "no effect" instead of "no feed".
    villainFed: fed != null,
  };
};

/**
 * Collapse per-combo stated EVs into the node-level quantities WS-295 needs.
 *
 * WHAT `statedEvSd` IS, precisely, because the ticket calls the covariate "posterior width at
 * the node" and there is more than one posterior in play:
 *
 *   It is the dispersion of the engine's stated EV ACROSS THE HOLDINGS HERO COULD HAVE, weighted
 *   by the range posterior `decisionAccumulator` inferred. It is the width of hero's RANGE
 *   posterior expressed in EV units.
 *
 *   It is NOT the villain-model posterior width. This pass holds the villain at population
 *   baseline by design (see the module header), so that width is CONSTANT across every decision
 *   in the run and cannot be a covariate here at all. A reader who assumes otherwise would take
 *   this as evidence about a channel the run never varied.
 *
 * Weights are the range probabilities, so the variance is the population-weighted one (divide by
 * the total weight, not by n-1): these are not n independent draws from a superpopulation, they
 * are a weighted enumeration of one posterior.
 */
const summarizeEv = (samples) => {
  if (!samples.length) return null;

  const W = samples.reduce((s, x) => s + x.w, 0);
  if (!(W > 0)) return null;
  const mean = samples.reduce((s, x) => s + x.w * x.statedEv, 0) / W;
  const variance = samples.reduce((s, x) => s + x.w * (x.statedEv - mean) ** 2, 0) / W;

  // Margins exist only where the engine offered a second action. Averaged over THAT subset,
  // with its own weight total, and the count reported so a margin computed from two of ten
  // combos is not read as a property of the node.
  const withMargin = samples.filter((x) => Number.isFinite(x.topTwoMargin));
  const Wm = withMargin.reduce((s, x) => s + x.w, 0);
  const marginMean = Wm > 0
    ? withMargin.reduce((s, x) => s + x.w * x.topTwoMargin, 0) / Wm
    : null;

  const depths = samples.map((x) => x.depthReached).filter(Number.isFinite);

  // WS-432. Restricted to the samples that carry the field (an older engine or an errored
  // evaluation reports null), weighted by the same range posterior as every other stat here.
  const withBudgetBound = samples.filter((x) => typeof x.budgetBound === 'boolean');
  const Wb = withBudgetBound.reduce((s, x) => s + x.w, 0);
  const budgetBoundShare = Wb > 0
    ? withBudgetBound.reduce((s, x) => s + (x.budgetBound ? x.w : 0), 0) / Wb
    : null;

  return {
    combosScored: samples.length,
    statedEvMean: mean,
    statedEvSd: Math.sqrt(variance),
    topTwoMarginMean: marginMean,
    combosWithMargin: withMargin.length,
    nActionsMean: samples.reduce((s, x) => s + x.w * x.nActions, 0) / W,
    // The engine reports the depth it actually REACHED, not the depth the street made it
    // eligible for (WS-334). Carried so a curse figure can be read against the depth that
    // produced it — which is the WS-361 question.
    depthReachedMax: depths.length ? Math.max(...depths) : null,
    // WS-432. `budgetBoundShare` is the range-posterior-weighted share of sampled holdings
    // whose evaluation the logical budget actually constrained; `budgetBoundAny` is the
    // node-level flag the report aggregates. Both null when no sample carried the field.
    budgetBoundShare,
    budgetBoundAny: withBudgetBound.length ? withBudgetBound.some((x) => x.budgetBound) : null,
  };
};
