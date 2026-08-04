/**
 * poolBestResponse.mjs — PBR: the max-EV response to the mined population policy (WS-331).
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS IS, AND THE THREE OBJECTS IT REFUSES TO BE
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * The founder asked for "a statistically perfect model — the boring one" to attribute how
 * much EV comes from playing perfectly against the pool. That framing collapsed three
 * different objects, and building them as one would have poisoned the anchor:
 *
 *   1. NOT A LEAST-SQUARES FIT. Minimizing squared error on predicted frequencies is not
 *      maximizing EV. `evCost.mjs` already establishes why in this repo: a fold-estimate
 *      error costs nothing unless it moves hero across a decision boundary. A model off by
 *      5% everywhere that never flips a decision costs ZERO; one off by 1% exactly at
 *      breakeven costs real money. Squared error cannot tell them apart.
 *
 *   2. NOT GTO. An equilibrium is UNEXPLOITABLE and deliberately leaves money on the table
 *      against a weak field. A best response takes that money and is itself maximally
 *      exploitable. No single object is both. The equilibrium post is `equilibriumPost.mjs`
 *      and it DOES NOT EXIST YET.
 *
 *   3. NOT A REGRESSION ON REALIZED CHIPS. This one is the trap, because it is the cheapest
 *      thing to build and it is wrong in a way shrinkage cannot repair. See below.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHY PBR IS COMPUTED STRUCTURALLY AND NEVER REGRESSED FROM OUTCOMES
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * The tempting construction is to estimate Q(s,a) = E[realized net | s, a] from the corpus
 * with the very shrinkage machinery `behaviorPolicy` already has, then take the argmax. It
 * would reuse everything and it would be a fantasy.
 *
 * Pool players who raise hold stronger cards than pool players who check, and their hole
 * cards are MASKED pre-showdown (`d dh p1 ????`). So realized net is not independent of the
 * action given the observable state: the observational Q for aggressive actions is inflated
 * by hand strength, and an argmax over it selects THE ACTION WHOSE VALUE IS MOST CONFOUNDED
 * rather than the action that is actually best. More data makes it converge harder onto the
 * wrong answer, which is precisely why shrinkage — a variance tool — cannot touch it.
 *
 * The structural construction has no such channel. Each action is PRICED from hero's range
 * equity, the pot geometry, and the field's MEASURED response rate. Nothing is read off a
 * realized outcome, so there is no strength-selection to be confounded by.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHAT PBR IS A CEILING *ON* — the scope label that must travel with every figure
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Founder decision, 2026-08-04: PBR is COARSE. It best-responds one step, at the same
 * decision-context hierarchy `pi_pool` is mined over. It is therefore a ceiling ON THAT
 * ABSTRACTION, not on the game — a full-tree best response would need multi-street
 * continuations and is a much larger build. Every figure carries `PBR_SCOPE` saying so.
 *
 * That is a real limit and it cuts in the honest direction: a one-step best response can
 * only UNDERSTATE what a full-tree one would win, so `exploitationEfficiency` computed
 * against it is, if anything, generous to the strategy being scored.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS COSTS NO ENGINE CALLS
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * `heroPolicyAt` already calls `evaluateGameTree` once per sampled combo, and that call
 * already returns `heroEquity` — the combo's equity against villain's range. That is the
 * one quantity PBR needs. So PBR reads the equity the engine pass already paid for, over
 * the SAME sampled combos.
 *
 * This is not merely a saving. It means PBR and the engine's policy share their `range` and
 * `equity` layers exactly (WS-324 `stack.js` vocabulary) and differ only at `ev` and
 * `action`. The comparison therefore isolates the DECISION RULE instead of quietly
 * re-measuring the equity model — which is what makes `firstStructuralDivergence` between
 * the two surfaces meaningful rather than decorative.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHY THE EMITTED POLICY IS A MIXTURE, NOT A POINT MASS
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * The argmax runs PER COMBO — each holding has its own equity and therefore its own best
 * action — and the result is then weighted by the combo's mass in hero's range. So
 * `pi_PBR(. | s)` comes out as a distribution, exactly like `pi_ours`.
 *
 * That is both correct and load-bearing for the estimator. A genuinely deterministic policy
 * would give every decision an importance weight of either 0 or 1/pi_pool, and effective
 * sample size would collapse. Marginalizing over the range is not a variance dodge — it is
 * the same treatment `heroPolicy` applies for the same reason (hole cards are unobserved),
 * and applying it to only one of the two policies would compare them on different terms.
 */

import { calcFoldEquity, expectedCallers } from '../../src/utils/exploitEngine/foldEquityCalculator.js';
import { getRangePositionCategory } from '../../src/utils/positionUtils.js';
import { buildSurfaceEntry } from '../../src/utils/standardOfRecord/surfaceRegistry.js';
import { buildLayer } from '../../src/utils/standardOfRecord/stack.js';
import { RESPONSES_BY_FACING, queryPolicy, POLICY_PARTITION_STAMP } from './behaviorPolicy.mjs';
import { sizeBucketFor, liveOpponentCount } from './decisionGeometry.mjs';
import { LeakageError } from './leakageGuard.mjs';

/**
 * The standing warning. PBR is a YARDSTICK AND MUST NEVER BE PLAYED.
 *
 * Being a best response to a measured field, it is maximally exploitable by construction:
 * anyone who observes it can counter it for free. It answers "how much was there to win
 * here at all", which is a different question from "what should I do".
 *
 * Attached to every figure the same way `ipsEstimator.TREATMENT` is, and rendered by
 * `heroEvReport`. A number that escapes without it is a number that will be read as advice.
 */
export const PBR_WARNING =
  'PBR IS A MEASURING STICK, NEVER A STRATEGY TO ADOPT. It is a best response to the '
  + 'measured field and is therefore MAXIMALLY EXPLOITABLE by construction — an opponent who '
  + 'observes it counters it for free. It bounds what was available to win; it does not '
  + 'recommend anything.';

/** The abstraction PBR is a ceiling on. Travels with every figure. */
export const PBR_SCOPE =
  'one-step best response at the mined decision-context hierarchy — a ceiling ON THAT '
  + 'ABSTRACTION, not on the full game. A full-tree best response could only find more, so '
  + 'exploitation efficiency measured against this post is generous to the strategy scored.';

/**
 * Candidate bet sizings, as a fraction of the pot excluding any live bet.
 *
 * A MENU, not a continuum, and the reason is what the field's data can resolve. Fold rates
 * are conditioned on `sizeBucket` (boundaries 33/66/100/150% in `decisionGeometry`), so
 * sizings finer than those buckets would differ in hero's arithmetic while mapping to the
 * identical measured fold rate — precision the instrument does not have, presented as if it
 * did. These four straddle the buckets and no more.
 */
export const PBR_SIZINGS = Object.freeze([0.33, 0.5, 0.75, 1.0]);

/**
 * Shrinkage values swept to separate real ceiling from fitted noise.
 *
 * THE SECOND-ORDER GUARD, and the one that decides whether the post is trustworthy. A best
 * response to a MEASURED model exploits every quirk of that model, including quirks that
 * are estimation noise — so an uncorrected PBR reports an inflated ceiling no real strategy
 * could reach, and every strategy scored against it looks worse than it is.
 *
 * Regularizing the population model harder should shrink PBR's edge. HOW FAST it shrinks is
 * the measurement: a ceiling that collapses as the model is smoothed was mostly fitted
 * noise; one that holds is signal. Report the CURVE, never one point.
 *
 * `DEFAULT_SHRINK_WEIGHT` (10) is included so the swept curve contains the shipped operating
 * point rather than bracketing it.
 */
export const PBR_SHRINK_SWEEP = Object.freeze([2, 5, 10, 20, 50, 100]);

/**
 * Disclaimer entries for the WS-330 register, as DATA.
 *
 * WS-330 has not shipped, so there is no register to append to yet. Writing this as prose in
 * a comment would leave WS-330 to re-derive it — and a falsifier that lives in a comment is
 * not a falsifier. Exported as a structure so the register consumes it verbatim when it
 * lands, and so a test can assert every entry actually carries its falsifier.
 */
export const PBR_DISCLAIMERS = Object.freeze([
  Object.freeze({
    id: 'PBR-overfits-the-model',
    claimAtRisk: 'PBR bounds what was available to win against this field.',
    disclaimer:
      'PBR best-responds to an ESTIMATED population policy, so it exploits estimation noise '
      + 'as readily as real tendencies. Held out on POOL/EVAL, which removes the same-player '
      + 'channel; it does NOT remove the possibility that pool-wide quirks are themselves '
      + 'sampling artefacts of a single 2009 month.',
    falsifier:
      'Sweep the population model shrinkage (PBR_SHRINK_SWEEP). If PBR\'s edge decays toward '
      + 'the engine\'s edge as regularization rises, the ceiling was substantially fitted '
      + 'noise and every exploitation-efficiency figure computed against it was understated. '
      + 'A flat curve falsifies the overfit claim.',
    status: 'open',
    ticket: 'WS-331',
  }),
  Object.freeze({
    id: 'PBR-is-a-ceiling-on-the-abstraction',
    claimAtRisk: 'Exploitation efficiency states what fraction of the available edge a strategy captures.',
    disclaimer:
      'The denominator is a ONE-STEP best response at the mined hierarchy, not a full-tree '
      + 'one. It cannot find multi-street lines, so it understates the true ceiling and '
      + 'overstates every efficiency computed from it.',
    falsifier:
      'Build the full-tree PBR (blocked on the WS-326 simulator) and compare. If efficiency '
      + 'figures fall materially, the coarse post was flattering the strategy.',
    status: 'open',
    ticket: 'WS-331',
  }),
]);

/**
 * Refuse a PBR that could have been fitted on the players it will be scored against.
 *
 * DELIBERATELY NOT A CALL TO `validateBehaviorPolicy`, though it checks a table that one has
 * also seen. That guard answers "may this table be a DENOMINATOR for these players"; this one
 * answers "may a POLICY DERIVED from this table be scored on them". The second question is
 * strictly stronger and fails in a case the first passes: at `poolPct = 100` every player is
 * a POOL player, the stamp is honest, the denominator is legitimate — and a best response
 * fitted on everyone would be evaluated on its own training set, which is the inflated-
 * ceiling failure this ticket exists to prevent. Folding one check into the other would mean
 * weakening a guard to fit a second payload.
 *
 * @throws {LeakageError}
 */
export const validatePbrHeldOut = (table, poolPct) => {
  const p = table?.provenance;
  if (!p || !Array.isArray(table?.levels)) {
    throw new LeakageError(
      'PBR refused: no behaviour-policy table supplied. PBR IS a best response to pi_pool — '
      + 'without one there is nothing to best-respond TO, and any fallback would be a ceiling '
      + 'derived from an assumption rather than from the field.',
    );
  }
  if (p.partition !== POLICY_PARTITION_STAMP) {
    throw new LeakageError(
      `PBR refused: behaviour-policy table is not stamped "${POLICY_PARTITION_STAMP}" `
      + `(got ${JSON.stringify(p.partition)}). A best response fitted on all players and then `
      + 'scored on those same players exploits its own estimation noise, and reports a ceiling '
      + 'no strategy could reach.',
      { provenance: p },
    );
  }
  if (!Number.isFinite(poolPct) || poolPct <= 0 || poolPct >= 100) {
    throw new LeakageError(
      `PBR refused: poolPct=${poolPct} leaves no disjoint EVAL set. PBR must be FIT on POOL `
      + 'and EVALUATED on EVAL; a same-partition PBR is inadmissible by construction, not '
      + 'merely noisy.',
      { poolPct },
    );
  }
  if (p.poolPct !== poolPct) {
    throw new LeakageError(
      `PBR refused: behaviour policy was mined at poolPct=${p.poolPct} but this run partitions `
      + `at poolPct=${poolPct}. The EVAL players would not be disjoint from the players whose `
      + 'behaviour PBR best-responds to.',
      { provenance: p, poolPct },
    );
  }
  return table;
};

/**
 * The node hero's aggressive action CREATES, from the node hero is acting at.
 *
 * `pi_pool` is keyed on the ACTING player's context, so reading "how often does the field
 * fold to a bet of this size here" means querying it as the villain who now faces one — not
 * as hero. Three coordinates flip and the rest carry over.
 *
 * `isAgg` is the approximation in this function and is called out rather than buried:
 * preflop-aggressor is a property of the hand, not a two-sided flag, so complementing hero's
 * is only right heads-up. It is the least specific dimension in the ladder that this touches,
 * so a miss here costs a shrinkage step rather than a wrong cell.
 */
export const responseContext = (ctx, hand, { heroBetTotalBB, potBeforeVillainBB, facing }) => ({
  facingAction: facing,
  // Villain is in position exactly when hero is not.
  isIP: ctx.isIP === 'ip' ? 'oop' : 'ip',
  isAgg: ctx.isAgg === 'agg' ? 'nonagg' : 'agg',
  texture: ctx.texture,
  street: ctx.street,
  posCategory: ctx.opponentSeat != null
    ? getRangePositionCategory(Number(ctx.opponentSeat), hand?.gameState?.dealerButtonSeat)
    : ctx.posCategory,
  sizeBucket: sizeBucketFor(heroBetTotalBB, potBeforeVillainBB),
});

/**
 * Per-action value in big blinds for ONE holding, given the field's measured responses.
 *
 * POT CONVENTION, stated once because getting it wrong is silent and fatal. `potExBetBB` is
 * the pot EXCLUDING any live bet hero faces — the same convention `decisionGeometry`
 * documents as `enginePotChips` and the same one `villainRequiredEquity` uses when it
 * derives a raise price as `(R - B) / (P + 2R)`. So with pot P, villain bet B, hero raising
 * TO R, the called pot is P + 2R and the folded pot hero collects is P + B.
 *
 * MULTIWAY. The measured fold rate is ONE opponent's. Fold-through compounds
 * (POKER_THEORY 6.1), so it is raised to the live-opponent power and `expectedCallers`
 * converts what is left into the called-pot size. This compounds a MEASURED per-opponent
 * rate; it does not multiply a count by a per-opponent constant, which is the WS-274
 * anti-pattern. Hero's equity stays the heads-up figure the engine returned — the same
 * number the engine's own policy is scored on, so the comparison is not tilted by it.
 *
 * @returns {Object} action -> value in bb. Keys are exactly the node's response set.
 */
export const actionValues = ({
  facingAction,
  equity,
  potExBetBB,
  facingBetBB,
  numOpponents = 1,
  foldRateFor,
}) => {
  const responses = RESPONSES_BY_FACING[facingAction] || RESPONSES_BY_FACING.none;
  const P = Math.max(0, potExBetBB);
  const B = Math.max(0, facingBetBB);
  const eq = Math.min(1, Math.max(0, equity));
  const k = Math.max(1, numOpponents);
  const out = {};

  // Value of the best available aggressive sizing, and nothing else about it: PBR picks its
  // size inside the argmax, but the corpus only records the PRIMITIVE, so only the primitive
  // is emitted. The sizing is a means to the ceiling, not part of the scored policy.
  const bestAggressive = (isRaise) => {
    let best = -Infinity;
    for (const frac of PBR_SIZINGS) {
      // A raise is sized off the pot it is raising INTO (which contains villain's bet) and
      // must at minimum match it, or it is not a raise.
      const total = isRaise
        ? Math.max(B * 2, B + (P + B) * frac)
        : P * frac;
      if (!(total > 0)) continue;

      const one = foldRateFor(total, isRaise);
      if (!Number.isFinite(one)) continue;
      const foldThrough = Math.pow(Math.min(0.999999, Math.max(0, one)), k);
      const callers = expectedCallers(foldThrough, k);

      // `calcFoldEquity` prices the bet case exactly: potSize excludes hero's own wager and
      // the called pot is potSize + betSize*(callers+1).
      const { totalEV } = calcFoldEquity({
        potSize: P, betSize: total, foldPct: foldThrough, heroEquity: eq, numCallers: callers,
      });
      // ONE DELTA for the raise case, and it is the whole difference between the two: the
      // fold branch collects villain's already-posted bet too. Adding it here keeps the
      // audited formula intact rather than forking a second copy of it.
      const ev = isRaise ? totalEV + foldThrough * B : totalEV;
      if (ev > best) best = ev;
    }
    return best === -Infinity ? null : best;
  };

  for (const a of responses) {
    switch (a) {
      case 'fold':
        // Zero by definition — hero forfeits what is already in and invests nothing more.
        // Every other action is priced relative to this, which is what makes the argmax a
        // decision rather than a comparison of levels.
        out.fold = 0;
        break;
      case 'check':
        // No further investment; hero realizes equity in the pot as it stands. Deliberately
        // no realization discount: the engine's policy is scored without one at this node
        // too, and applying it to one side only would move the comparison for a reason that
        // has nothing to do with the decision rule.
        out.check = eq * P;
        break;
      case 'call':
        // Hero matches B; called pot is P + 2B; hero invested B.
        out.call = eq * (P + 2 * B) - B;
        break;
      case 'bet':
        out.bet = bestAggressive(false) ?? 0;
        break;
      case 'raise':
        out.raise = bestAggressive(true) ?? 0;
        break;
      default:
        break;
    }
  }
  return out;
};

/**
 * pi_PBR(. | s) — the range-marginalized best response at one decision node.
 *
 * Takes the combos and equities the engine pass ALREADY computed. It deliberately does not
 * sample or evaluate anything itself: a second sampler here would silently compare two
 * policies over two different ranges, and the whole point of sharing the pass is that they
 * are compared over one.
 *
 * @param {Object} args
 * @param {Object} args.ctx        - decisionAccumulator seam payload
 * @param {Object} args.hand       - app-shaped corpus hand
 * @param {Object} args.geo        - `decisionGeometry` output for this node
 * @param {Array}  args.perCombo   - [{ sampleWeight, heroEquity }] from `heroPolicyAt`
 * @param {Object} args.policy     - validated behaviour-policy table
 * @param {number} [args.shrinkWeight] - override for the sweep
 * @returns {{ok: true, actions: Object, combosUsed: number}|{ok: false, reason: string}}
 */
export const poolBestResponseAt = ({ ctx, hand, geo, perCombo, policy, shrinkWeight }) => {
  const facingAction = ctx.facingAction ?? 'none';
  const responses = RESPONSES_BY_FACING[facingAction];
  if (!responses) return { ok: false, reason: 'unknown-facing' };
  if (!Array.isArray(perCombo) || perCombo.length === 0) return { ok: false, reason: 'no-combos' };
  if (!geo) return { ok: false, reason: 'bad-geometry' };

  const B = geo.facingBetBB;
  const P = Math.max(0, geo.potBB - B);
  const numOpponents = Math.max(1, liveOpponentCount(hand, ctx.order, ctx.playerSeat));

  // Fold rates depend only on the SIZING, not on hero's holding, so they are resolved once
  // per node and reused across every combo. Memoized rather than recomputed inside the combo
  // loop: `queryPolicy` walks the whole hierarchy, and at 10 combos x 4 sizings that is 40
  // identical walks per decision for one distinct answer per sizing.
  const foldCache = new Map();
  const foldRateFor = (heroBetTotalBB, isRaise) => {
    const key = `${isRaise ? 'r' : 'b'}|${heroBetTotalBB.toFixed(4)}`;
    if (foldCache.has(key)) return foldCache.get(key);
    const potBeforeVillainBB = P + (isRaise ? B : 0) + heroBetTotalBB;
    const rc = responseContext(ctx, hand, {
      heroBetTotalBB,
      potBeforeVillainBB,
      // Villain faces a RAISE only when they already have money in this street.
      facing: isRaise ? 'raise' : 'bet',
    });
    const { actions } = queryPolicy(policy, rc, { shrinkWeight });
    const f = actions?.fold;
    foldCache.set(key, f);
    return f;
  };

  const counts = {};
  for (const a of responses) counts[a] = 0;
  let used = 0;

  for (const combo of perCombo) {
    const eq = combo?.heroEquity;
    const w = combo?.sampleWeight;
    if (!Number.isFinite(eq) || !Number.isFinite(w) || w <= 0) continue;

    const values = actionValues({
      facingAction, equity: eq, potExBetBB: P, facingBetBB: B, numOpponents, foldRateFor,
    });

    let bestAction = null;
    let bestValue = -Infinity;
    for (const a of responses) {
      const v = values[a];
      if (!Number.isFinite(v)) continue;
      // Strict `>` makes ties resolve to the FIRST action in the response set, which is
      // ordered passive-first (`fold, call, raise` / `check, bet`). A ceiling that breaks
      // ties toward aggression would inflate itself on exactly the marginal spots where the
      // measurement is least sure.
      if (v > bestValue) { bestValue = v; bestAction = a; }
    }
    if (bestAction === null) continue;

    counts[bestAction] += w;
    used += w;
  }

  if (used <= 0) return { ok: false, reason: 'no-scorable-combos' };

  // Renormalize over the mass actually used, with NO smoothing — same rule `heroPolicy`
  // applies and for the same reason. A zero here is a real statement ("no holding in hero's
  // range prefers this action"), and smoothing it would fabricate propensity mass the policy
  // does not have.
  const actions = {};
  for (const a of responses) actions[a] = counts[a] / used;
  return { ok: true, actions, combosUsed: perCombo.length };
};

/**
 * PBR across the shrinkage sweep, in one pass over the combos.
 *
 * Only the fold-rate lookup and the argmax vary with `shrinkWeight` — the equities are fixed
 * and already paid for — so the whole curve costs a handful of hierarchy walks per decision.
 * That is what makes reporting the curve rather than one point affordable.
 *
 * @returns {Object} shrinkWeight -> action distribution (entries that failed are omitted)
 */
export const poolBestResponseSweep = (args, sweep = PBR_SHRINK_SWEEP) => {
  const out = {};
  for (const w of sweep) {
    const r = poolBestResponseAt({ ...args, shrinkWeight: w });
    if (r.ok) out[w] = r.actions;
  }
  return out;
};

/** The registered surface id. Greppable, and the value `heroEvRunner` stamps on a PBR run. */
export const PBR_SURFACE_ID = 'pool-best-response';

/**
 * PBR as a registered Declared surface (WS-322 / ADR-009).
 *
 * DECLARED, not Field, and the distinction is the point. A Field is what a population is
 * OBSERVED to do; PBR is a rule someone AUTHORED on purpose — "take the max-EV action against
 * the measured field" — which happens to take a Field as input. Registering it as a Field
 * would say the pool plays this way, and the pool emphatically does not.
 *
 * All five layers are declared because PBR genuinely has all five: it marginalizes over
 * hero's range, consumes per-combo equity, reads a fold probability off `pi_pool`, computes
 * an EV per action, and emits an action distribution.
 */
export const PBR_SURFACE = buildSurfaceEntry({
  surfaceId: PBR_SURFACE_ID,
  surfaceKind: 'Declared',
  sources: ['SRC-012'],
  pool: 'HandHQ online cash, July 2009, numeric stakes',
  stack: [
    buildLayer({
      layer: 'range',
      inputs: ['decisionAccumulator.rangeBefore'],
      outputType: 'weighted combo set',
      assumptions: ['hero\'s range is the one the app infers, taken BEFORE hero\'s own action'],
    }),
    buildLayer({
      layer: 'equity',
      inputs: ['evaluateGameTree.heroEquity'],
      outputType: 'per-combo equity vs villain range',
      assumptions: [
        'heads-up equity is reused multiway; the engine policy is scored on the same number',
      ],
    }),
    buildLayer({
      layer: 'foldProbability',
      inputs: ['behaviorPolicy.queryPolicy'],
      outputType: 'P(fold | response node)',
      assumptions: [
        'the field\'s measured response, NOT the engine\'s fold curve — this is the layer at '
        + 'which PBR diverges from the engine surface',
        'per-opponent rate compounded to fold-through (POKER_THEORY 6.1)',
      ],
    }),
    buildLayer({
      layer: 'ev',
      inputs: ['foldEquityCalculator.calcFoldEquity'],
      outputType: 'bb per action',
      assumptions: [
        'one-step horizon — no multi-street continuation',
        'sizing chosen from PBR_SIZINGS inside the argmax',
      ],
    }),
    buildLayer({
      layer: 'action',
      inputs: ['per-combo argmax'],
      outputType: 'action distribution',
      assumptions: ['ties resolve to the most passive action in the response set'],
    }),
  ],
});
