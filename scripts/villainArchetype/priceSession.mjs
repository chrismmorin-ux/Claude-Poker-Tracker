/**
 * priceSession.mjs — run the money column over one session hero actually played.
 *
 * NO SHEBANG, DELIBERATELY — see `reviewSession.mjs`. Imported by tests.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * ONE EQUITY PATH, NOT A SECOND ONE
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * The equity behind every priced decision comes from `heroPolicyAt` — the SAME function the
 * backtest scores the engine with — not from a lighter equity call assembled here. The
 * difference is the input: instead of `sampleCombos` drawing ten holdings from hero's inferred
 * range, this passes ONE combo, hero's real hand, at weight 1.
 *
 * That is the whole cards-known arm, and it is expressed as an ARGUMENT rather than as a new
 * code path on purpose. A second equity path would be a second axis, and `evLeftBB` is a
 * subtraction against a ceiling computed on the first one.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHAT REFUSES, AND WHAT THAT COSTS TODAY
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * PREFLOP IS NOT PRICED. `heroPolicyAt` returns `empty-range` for `board.length < 3`, and on
 * the four June captures 99 of 184 hero decisions — 54% — are preflop. That is a hole in the
 * instrument, not a property of the game, and it is reported as `unpriced.preflop` on every
 * run rather than being quietly excluded from the denominator. Removing it means a preflop
 * equity path through the same evaluator; until that exists, no session total here describes
 * hero's whole session and the output says so on its face.
 */

import { decisionGeometry } from '../backtest/decisionGeometry.mjs';
import { heroPolicyAt } from '../backtest/heroPolicy.mjs';
import { encodeCardStr } from './handStrength.mjs';
import { priceDecisionAt, attributeGap, summarize } from './priceHeroDecisions.mjs';

/** Why a hero decision produced no price. Closed set; each means something different. */
export const UNPRICED = Object.freeze({
  PREFLOP: 'preflop',
  CARDS_UNKNOWN: 'cards-unknown',
  CARDS_UNPARSEABLE: 'cards-unparseable',
  NO_GEOMETRY: 'no-geometry',
  ENGINE: 'engine',
  NO_EQUITY: 'no-equity',
  PRICING: 'pricing',
});

/**
 * Hero's real holding as the single combo the engine should evaluate.
 *
 * Returns null rather than a guess when the cards are absent or unparseable. A combo built
 * from a partially-decoded hand would produce an equity that looks exactly like a real one.
 */
export const knownCombo = (holeCards) => {
  if (!Array.isArray(holeCards) || holeCards.length !== 2) return null;
  const card1 = encodeCardStr(holeCards[0]);
  const card2 = encodeCardStr(holeCards[1]);
  if (card1 < 0 || card2 < 0 || card1 === card2) return null;
  // `weight` and `sampleWeight` are both 1: this is not one holding sampled out of a range,
  // it is the holding. Nothing is being marginalized over.
  return { card1, card2, weight: 1, sampleWeight: 1, strength: null };
};

/**
 * Price every hero decision in one session.
 *
 * @param {Object}   args
 * @param {Array}    args.ctxs   - decision contexts for hero, in order
 * @param {Function} args.handFor - (ctx) => app-shaped hand
 * @param {Function} args.holeCardsFor - (ctx) => hero's hole cards for that hand, or null
 * @param {Object}   args.policy - validated behaviour-policy table
 * @param {Object}   [args.heroPolicyOpts] - passed through to `heroPolicyAt`
 */
export const priceSession = async ({
  ctxs, handFor, holeCardsFor, policy, heroPolicyOpts = {},
}) => {
  const priced = [];
  const unpriced = {};
  const bump = (k) => { unpriced[k] = (unpriced[k] || 0) + 1; };

  for (const ctx of ctxs) {
    const hand = handFor(ctx);
    if (!hand) { bump(UNPRICED.NO_GEOMETRY); continue; }

    // Reported before the engine is asked, so the preflop hole is counted even on a run where
    // the engine would have failed for another reason too.
    if (!Array.isArray(ctx.board) || ctx.board.length < 3) { bump(UNPRICED.PREFLOP); continue; }

    const holeCards = holeCardsFor(ctx);
    if (!holeCards) { bump(UNPRICED.CARDS_UNKNOWN); continue; }
    const combo = knownCombo(holeCards);
    if (!combo) { bump(UNPRICED.CARDS_UNPARSEABLE); continue; }

    const geo = decisionGeometry(hand, ctx.order, ctx.street);
    if (!geo) { bump(UNPRICED.NO_GEOMETRY); continue; }

    let res;
    try {
      res = await heroPolicyAt({ ctx, hand, combos: [combo], ...heroPolicyOpts });
    } catch {
      bump(UNPRICED.ENGINE);
      continue;
    }
    const heroEquity = res?.perCombo?.[0]?.heroEquity;
    if (!Number.isFinite(heroEquity)) { bump(UNPRICED.NO_EQUITY); continue; }

    const p = priceDecisionAt({
      ctx, hand, geo, heroEquity, observedAction: ctx.action, policy,
    });
    if (!p.ok) { bump(`${UNPRICED.PRICING}:${p.reason}`); continue; }

    priced.push({
      ...p,
      handId: ctx.handId ?? hand?.handId ?? null,
      order: ctx.order,
      holeCards,
      attribution: attributeGap(p),
    });
  }

  const totals = summarize(priced);
  const attempted = ctxs.length;
  const skipped = Object.values(unpriced).reduce((a, b) => a + b, 0);

  return {
    priced,
    unpriced,
    totals,
    coverage: {
      decisionsAttempted: attempted,
      decisionsPriced: priced.length,
      decisionsUnpriced: skipped,
      // Every decision is accounted for. A count that does not reconcile is a bug, not a
      // rounding — the same rule `reviewSession` applies to its intake.
      reconciles: attempted === priced.length + skipped,
      pricedShare: attempted ? priced.length / attempted : 0,
    },
    /**
     * The scope label that must travel with the totals. Stated as data, not prose, because a
     * caveat in a comment is not carried to the surface that quotes the number.
     */
    scope: {
      covers: 'postflop hero decisions only',
      preflopUnpriced: unpriced[UNPRICED.PREFLOP] ?? 0,
      why: 'heroPolicyAt returns empty-range for board.length < 3; no preflop equity path exists yet',
      removedBy: 'a preflop equity path through the same evaluator, so both arms stay on one axis',
    },
  };
};
