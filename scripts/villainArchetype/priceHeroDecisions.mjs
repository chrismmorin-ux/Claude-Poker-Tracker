/**
 * priceHeroDecisions.mjs — what hero's decision was worth, and what the best one was worth.
 *
 * NO SHEBANG, DELIBERATELY — see `reviewSession.mjs`. This module is imported by tests.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE NUMBER THIS PRODUCES, AND WHY IT IS NOT A SOLVER COMPARISON
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * FOUNDER, 2026-08-21: "solver is not the ideal strategy, not even on a regular table. why
 * are we referring to it like it is."
 *
 * So the yardstick is POOL BEST RESPONSE — the max-EV response to the field's MEASURED
 * behaviour — and the reported quantity is EV LEFT ON THE TABLE: money that was actually
 * there, against these opponents, and was not taken. An equilibrium comparison answers a
 * different question ("was hero exploitable"), and against a weak field the two point in
 * opposite directions.
 *
 * `poolBestResponse.mjs` carries the standing warning that PBR must never be PLAYED — it is
 * maximally exploitable by construction. It is a ceiling, not advice. Nothing here
 * recommends an action; it prices the one hero took.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE ARM THE CORPUS STRUCTURALLY CANNOT RUN
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * `heroPolicy.mjs` must marginalize over a SAMPLED range because the corpus masks hole cards
 * (`d dh p1 ????`), and its own header concedes that is the weaker claim. WS-294's cards-known
 * arm can only reach the ~30% of corpus decisions that saw a showdown — a subset containing
 * ZERO folds, since a fold never shows.
 *
 * A session the founder played has his cards on EVERY decision, folds included. So the combo
 * priced here is not a sample: it is one combo, the real one, weight 1. That is why this
 * runner can price a FOLD, which is where a tight player's money actually goes.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * A FALSE CLAIM STOOD HERE. RECORDED RATHER THAN QUIETLY DELETED.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * This block used to end "...which no corpus arm and NO COMMERCIAL TRACKER will ever show
 * him." The second half is FALSE and was refuted by a Gate 2 roundtable on 2026-08-21 in one
 * click: GTO Wizard's Hand History Analyzer prices folds explicitly — its own documentation
 * reads "SB should have called the river. Instead, they folded, losing 7.65 bb."
 *
 * The error was a CATEGORY ERROR, and it is worth naming because it is easy to repeat. The
 * HandHQ corpus masks hole cards because it is THIRD-PARTY DATAMINED history. A player's own
 * hand history has never masked that player's own cards — PokerStars writes
 * `Dealt to Hero [Xx Yy]` in the HOLE CARDS block before any action, folds included. A
 * property of one corpus was generalised into a property of every tool. Pricing a fold also
 * never required the masked information: a fold is the zero point at the node, and what gets
 * priced is the EV of the ALTERNATIVES under some model of villain's range.
 *
 * WHAT SURVIVES, AND IT IS STILL A REAL DIFFERENTIATOR:
 *
 *   1. Everyone who prices a fold prices it against a SOLVER's model of villain's range. This
 *      runner prices it against the field's MEASURED behaviour. No counterexample was found.
 *   2. GTO Wizard skips what it has no solution for — "such as multiway postflop spots." At
 *      9-handed live 1/2 that is a large share of the hands that matter, and this runner has
 *      no such hole.
 *
 * The narrow corpus claim — that the corpus's only cards-known slice is showdowns and contains
 * zero folds — is CORRECT and is what `renderSessionReview.mjs` says to the founder's face.
 * That user-facing text never made the wider claim and needed no correction.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHY THE VALUE FUNCTION AND THE FOLD RATES ARE IMPORTED, NEVER RESTATED
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * `evLeftBB` is a SUBTRACTION between the ceiling's value and hero's value. Two numbers that
 * get subtracted must come off one axis or the difference is meaningless. So `actionValues`
 * and `makeFoldRateFor` are imported from `poolBestResponse.mjs` — the same functions the
 * ceiling itself is computed with — rather than reimplemented against the same formulas.
 * A faithful second copy would still be a second copy, and WS-291 is what happens when two
 * representations of one quantity are never forced to meet.
 */

import { actionValues, makeFoldRateFor } from '../backtest/poolBestResponse.mjs';
import { RESPONSES_BY_FACING } from '../backtest/behaviorPolicy.mjs';
import { liveOpponentCount } from '../backtest/decisionGeometry.mjs';

/**
 * Reasons a decision could not be priced. CLOSED SET, and each one means something different
 * from the others — collapsing them would hide which are a data problem, which are a coverage
 * problem, and which are the instrument declining to guess.
 */
export const PRICE_SKIPS = Object.freeze({
  BAD_GEOMETRY: 'bad-geometry',
  UNKNOWN_FACING: 'unknown-facing',
  NO_EQUITY: 'no-equity',
  ACTION_NOT_IN_RESPONSE_SET: 'action-not-in-response-set',
  NO_SCORABLE_ACTION: 'no-scorable-action',
  OBSERVED_ACTION_UNPRICED: 'observed-action-unpriced',
});

/**
 * Price one decision.
 *
 * @param {Object} args
 * @param {Object} args.ctx            - decisionAccumulator seam payload
 * @param {Object} args.hand           - app-shaped hand
 * @param {Object} args.geo            - `decisionGeometry` output for this node
 * @param {number} args.heroEquity     - equity of hero's ACTUAL holding (0-1)
 * @param {string} args.observedAction - what hero did
 * @param {Object} args.policy         - validated behaviour-policy table
 * @param {number} [args.shrinkWeight]
 * @returns {{ok: true, ...}|{ok: false, reason: string}}
 */
export const priceDecisionAt = ({
  ctx, hand, geo, heroEquity, observedAction, policy, shrinkWeight,
}) => {
  if (!geo) return { ok: false, reason: PRICE_SKIPS.BAD_GEOMETRY };
  const facingAction = ctx?.facingAction ?? 'none';
  const responses = RESPONSES_BY_FACING[facingAction];
  if (!responses) return { ok: false, reason: PRICE_SKIPS.UNKNOWN_FACING };
  if (!Number.isFinite(heroEquity)) return { ok: false, reason: PRICE_SKIPS.NO_EQUITY };
  if (!responses.includes(observedAction)) {
    return { ok: false, reason: PRICE_SKIPS.ACTION_NOT_IN_RESPONSE_SET, observedAction, responses };
  }

  const B = geo.facingBetBB;
  const P = Math.max(0, geo.potBB - B);
  const numOpponents = Math.max(1, liveOpponentCount(hand, ctx.order, ctx.playerSeat));

  const values = actionValues({
    facingAction,
    equity: heroEquity,
    potExBetBB: P,
    facingBetBB: B,
    numOpponents,
    foldRateFor: makeFoldRateFor({ ctx, hand, geo, policy, shrinkWeight }),
  });

  let bestAction = null;
  let bestValue = -Infinity;
  for (const a of responses) {
    const v = values[a];
    if (!Number.isFinite(v)) continue;
    // Ties resolve to the FIRST action in the response set, which is ordered passive-first.
    // Same rule `poolBestResponseAt` uses and for the same reason: a ceiling that broke ties
    // toward aggression would inflate itself on exactly the marginal spots where the
    // measurement is least sure — and here that inflation would land as hero's "loss".
    if (v > bestValue) { bestValue = v; bestAction = a; }
  }
  if (bestAction === null) return { ok: false, reason: PRICE_SKIPS.NO_SCORABLE_ACTION };

  const observedValue = values[observedAction];
  if (!Number.isFinite(observedValue)) {
    return { ok: false, reason: PRICE_SKIPS.OBSERVED_ACTION_UNPRICED, observedAction };
  }

  /**
   * NON-NEGATIVE BY CONSTRUCTION, AND ASSERTED RATHER THAN CLAMPED.
   *
   * `bestValue` is a max over a set that CONTAINS `observedValue`, so the gap is >= 0. A
   * negative would mean hero beat the best response to the field — which is not a good
   * session, it is a bug in the value function or the action mapping. So the raw difference
   * is returned unclamped and a test asserts the property. Clamping here would convert that
   * bug into a silent zero, and a money column that read 0.0 for every hand has already
   * passed fifteen tests in this repo once.
   */
  return {
    ok: true,
    values,
    bestAction,
    bestValueBB: bestValue,
    observedAction,
    observedValueBB: observedValue,
    evLeftBB: bestValue - observedValue,
    agreed: bestAction === observedAction,
    facingAction,
    street: ctx.street ?? null,
    numOpponents,
    potExBetBB: P,
    facingBetBB: B,
    heroEquity,
  };
};

/**
 * Attribute a priced decision to a CAUSE, because a number with no cause is a scoreboard.
 *
 * The sizing axis is deliberately NOT reported as a cause. `actionValues` takes a max over
 * `PBR_SIZINGS` inside the aggressive branch, and the corpus records only the PRIMITIVE — so
 * the ceiling's SIZE is not a measured quantity. Attributing a loss to it would be inventing a
 * comparison the policy cannot support. It is a real axis and it deserves a real instrument;
 * naming it as unbuilt is the honest form.
 */
export const attributeGap = (priced) => {
  if (!priced?.ok) return null;
  if (priced.agreed) return { cause: 'agreed', detail: null };
  return {
    cause: 'action-class',
    detail: `${priced.observedAction} where the ceiling took ${priced.bestAction}`,
  };
};

/**
 * Fold priced decisions into session totals.
 *
 * `exploitationEfficiency` is a RATIO OF SUMS, never a mean of per-decision ratios. A
 * per-decision ratio explodes wherever the ceiling's value is near zero, and averaging those
 * would let the smallest pots dominate the session figure.
 */
export const summarize = (priced) => {
  const ok = priced.filter((p) => p?.ok);
  const evLeftBB = ok.reduce((a, p) => a + p.evLeftBB, 0);
  const ceilingBB = ok.reduce((a, p) => a + p.bestValueBB, 0);
  const heroBB = ok.reduce((a, p) => a + p.observedValueBB, 0);

  const bucket = (map, key, p) => {
    const k = key ?? 'unknown';
    map[k] = map[k] || { decisions: 0, evLeftBB: 0 };
    map[k].decisions += 1;
    map[k].evLeftBB += p.evLeftBB;
  };
  const byStreet = {};
  const byAction = {};
  for (const p of ok) {
    bucket(byStreet, p.street, p);
    bucket(byAction, p.observedAction, p);
  }

  return {
    decisionsPriced: ok.length,
    evLeftBB,
    heroValueBB: heroBB,
    ceilingValueBB: ceilingBB,
    agreedCount: ok.filter((p) => p.agreed).length,
    /**
     * Share of the available value hero actually took. Null when the ceiling's total is not
     * positive — a stretch where the best available play was worth nothing has no denominator,
     * and reporting either 0% or 100% there would be an invention.
     */
    exploitationEfficiency: ceilingBB > 0 ? heroBB / ceilingBB : null,
    byStreet,
    byAction,
  };
};
