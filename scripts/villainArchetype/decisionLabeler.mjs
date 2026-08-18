/**
 * decisionLabeler — turn a villain's actions into DECISIONS DESCRIBED AS THEY WERE FACED.
 *
 * The point of this module is a change of unit. Everything upstream measures a villain by
 * RATES ("folds 85.6% facing a raise"). A rate is a summary of a player; it is not a thing
 * anyone does. This emits, for every action a seat took, the situation that seat was looking
 * at when they took it — the price, the stack depth, how many players could still act, what
 * the board was doing, whether they were representing strength — and then the action. That
 * is the unit a RULE is written against.
 *
 * POT GEOMETRY IS NOT COMPUTED HERE, DELIBERATELY. `scripts/backtest/decisionGeometry.mjs`
 * owns it, and WS-333 exists because this repo once had three private notions of "the pot".
 * A first draft of this file made it four and got it wrong in the documented way: the corpus
 * writes BET/RAISE `amount` as TOTAL street commitment and CALL `amount` as the INCREMENT
 * owed (decisionGeometry.mjs:191-197). Treating both as totals overstated `toCall` for the
 * blinds and produced impossible rows — "facing a raise ... I check". Everything geometric
 * here now comes from `decisionGeometryFull`, which also carries real stacks, so SPR is
 * available rather than absent.
 *
 * WHAT IS KNOWN, AND WHAT IS NOT. Measured on the corpus (2,004 hands sampled): hole cards
 * exist for 4.70% of seat-hands, showdown only, and FOLDS ARE NEVER REVEALED. Amounts,
 * blinds, button, stacks and board are present on 100% of decisions. Each label carries
 * `handClass` when the hand was shown and null otherwise; no consumer may read a null as a
 * hand class.
 *
 * THE ASYMMETRY THAT FOLLOWS, stated because it silently biases any range fitted from
 * showdowns: a seat reaches showdown by CONTINUING. Calls and raises are over-represented
 * among revealed hands, folds are absent entirely, so a range fitted only on revealed hands
 * is the range that continued, not the range that acted.
 *
 * WHY THAT DOES NOT BLOCK RANGE RULES (founder ruling, 2026-08-18). A range rule carries a
 * COMBINATORIAL MEASURE — "JJ+, AQo+, ATs+" is ~8% of hands — while the villain's frequency
 * in that spot is measured on ALL decisions. A villain who enters 22% first-in REFUTES an 8%
 * opening rule outright, with no card ever shown. Frequency falsifies shape. Revealed hands
 * are the second instrument, discriminating among the many candidate ranges of the right
 * size, and each is a hard constraint rather than a statistical one.
 */

import { PRIMITIVE_ACTIONS } from '../../src/constants/primitiveActions.js';
import { bestFiveFromSeven, handCategory } from '../../src/utils/pokerCore/handEvaluator.js';
import { analyzeBoardFromStrings } from '../../src/utils/pokerCore/boardTexture.js';
import { decisionGeometryFull } from '../backtest/decisionGeometry.mjs';

export const STREETS = ['preflop', 'flop', 'turn', 'river'];
const POSTED = new Set(['postSmallBlind', 'postBigBlind', 'post', 'ante', 'straddle']);

const RANKS = '23456789TJQKA';
const rankOf = (card) => RANKS.indexOf(String(card)[0].toUpperCase()) + 2;

const boardFor = (community, street) => {
  const n = { preflop: 0, flop: 3, turn: 4, river: 5 }[street] ?? 0;
  return (community || []).slice(0, n);
};

/**
 * The made-hand class in the terms a player would use at the table.
 * Only called when hole cards are known; returns null otherwise.
 */
export const classifyMadeHand = (hole, board) => {
  if (!hole || hole.length < 2 || !board || board.length < 3) return null;
  let category = null;
  try {
    const best = bestFiveFromSeven([...hole, ...board]);
    category = handCategory(typeof best === 'number' ? best : best.score);
  } catch { category = null; }

  const boardRanks = board.map(rankOf).sort((a, b) => b - a);
  const holeRanks = hole.map(rankOf).sort((a, b) => b - a);
  const paired = holeRanks[0] === holeRanks[1];
  const distinctBoard = [...new Set(boardRanks)];

  let pairClass = null;
  const hits = holeRanks.filter(r => boardRanks.includes(r));
  if (hits.length > 0) {
    const idx = distinctBoard.indexOf(Math.max(...hits));
    pairClass = paired ? 'set' : (idx === 0 ? 'top-pair' : idx === 1 ? 'second-pair' : 'weak-pair');
  } else if (paired) {
    pairClass = holeRanks[0] > boardRanks[0] ? 'overpair' : 'underpair';
  }

  let kicker = null;
  if (pairClass && pairClass.endsWith('-pair') && !paired && hits.length === 1) {
    const k = holeRanks.find(r => !boardRanks.includes(r));
    kicker = k ? RANKS[k - 2] : null;
  }
  return { category, pairClass, kicker, paired };
};

/**
 * Every decision one seat faced in one hand, with the situation as they saw it.
 *
 * @param {Object} hand   app-shaped hand from phhAdapter (must carry `_backtest`)
 * @param {string|number} seat
 * @returns {Array<Object>} one entry per voluntary action
 */
export const labelDecisions = (hand, seat) => {
  const s = String(seat);
  const seq = [...(hand?.gameState?.actionSequence || [])].sort((a, b) => a.order - b.order);
  if (!seq.length) return [];
  const community = hand?.gameState?.communityCards || [];
  const shown = hand?.gameState?.showdownCards?.[s] || null;

  const out = [];
  let street = 'preflop';
  let raisesThisStreet = 0;
  let entrantsPF = 0;
  let aggressorPF = null;
  let streetAggressor = null;

  for (const e of seq) {
    if (e.street !== street) {
      street = e.street;
      raisesThisStreet = 0;
      streetAggressor = null;
    }
    const es = String(e.seat);

    if (es === s && !POSTED.has(e.action)) {
      const geo = decisionGeometryFull(hand, e.order, street, s);
      const board = boardFor(community, street);
      const texture = board.length >= 3 ? analyzeBoardFromStrings(board) : null;
      const facingBB = geo?.facingBetBB ?? 0;
      const potBB = geo?.potBB ?? null;
      // `potBB` INCLUDES the live bet (decisionGeometry exposes `enginePotChips` as the
      // pot MINUS it). So the pot won by calling is potBB, and the required equity is
      // call/(pot + call) — NOT call/pot, which overstates the price on every row and is
      // the exact number every threshold rule is keyed on.
      const potOdds = facingBB > 0 && potBB ? facingBB / (potBB + facingBB) : null;

      out.push({
        handId: hand.handId,
        street,
        order: e.order,
        // ---- the situation, as faced ----
        facing: facingBB > 0
          ? (street === 'preflop' ? (raisesThisStreet > 1 ? 'a 3-bet' : 'a raise') : 'a bet')
          : 'no bet',
        toCallBB: +facingBB.toFixed(2),
        potBB: potBB == null ? null : +potBB.toFixed(2),
        betFractionOfPot: facingBB > 0 && potBB
          ? +(facingBB / Math.max(potBB - facingBB, 0.01)).toFixed(3) : null,
        potOddsNeeded: potOdds == null ? null : +potOdds.toFixed(3),
        spr: geo?.spr ?? null,
        sprBand: geo?.sprBand ?? null,
        sizeBucket: geo?.sizeBucket ?? null,
        closesAction: geo?.closesAction ?? null,
        opponentsLive: geo?.liveOpponents ?? null,
        raisesFaced: raisesThisStreet,
        iAmPreflopAggressor: aggressorPF === s,
        iAmStreetAggressor: streetAggressor === s,
        firstIn: street === 'preflop' && raisesThisStreet === 0 && entrantsPF === 0,
        limpersAhead: street === 'preflop' && raisesThisStreet === 0 ? entrantsPF : 0,
        boardTexture: texture ? {
          paired: !!texture.paired,
          monotone: !!texture.monotone,
          twoTone: !!texture.twoTone,
          connected: !!(texture.connected || texture.straighty),
          highCard: board.length ? RANKS[Math.max(...board.map(rankOf)) - 2] : null,
        } : null,
        // ---- what they did ----
        action: e.action,
        // BET/RAISE amount is TOTAL street commitment; express it against the pot before it.
        raiseToFractionOfPot: (e.action === PRIMITIVE_ACTIONS.RAISE || e.action === 'bet')
          && potBB && Number.isFinite(e.amount)
          ? +((e.amount / geo.bb) / Math.max(potBB, 0.01)).toFixed(3) : null,
        // ---- what we could see of their hand ----
        handKnown: !!shown,
        holeCards: shown || null,
        handClass: shown ? classifyMadeHand(shown, board) : null,
      });
    }

    if (street === 'preflop' && !POSTED.has(e.action)
        && (e.action === PRIMITIVE_ACTIONS.CALL || e.action === PRIMITIVE_ACTIONS.RAISE)) {
      entrantsPF++;
    }
    if (e.action === PRIMITIVE_ACTIONS.RAISE || e.action === 'bet') {
      raisesThisStreet++;
      streetAggressor = es;
      if (street === 'preflop') aggressorPF = es;
    }
  }
  return out;
};

/** A one-line, first-person rendering of a labelled decision. */
export const renderDecision = (d) => {
  const price = d.potOddsNeeded != null ? `need ${(d.potOddsNeeded * 100).toFixed(0)}%` : 'free';
  const size = d.betFractionOfPot != null ? `${d.betFractionOfPot.toFixed(2)}x pot` : '';
  const facing = d.facing === 'no bet'
    ? (d.firstIn ? 'nobody in yet'
      : (d.limpersAhead ? `${d.limpersAhead} limper(s)` : 'checked to me'))
    : `facing ${d.facing} ${size}`;
  const role = d.iAmPreflopAggressor ? ' [I raised pf]' : '';
  const spr = d.spr != null ? `SPR ${d.spr.toFixed(1)}` : 'SPR ?';
  const hc = d.handClass;
  const hand = hc
    ? ` {${d.holeCards.join('')} = ${[hc.pairClass, hc.kicker ? hc.kicker + ' kicker' : null]
        .filter(Boolean).join(', ') || hc.category}}`
    : (d.handKnown ? ` {${d.holeCards.join('')}}` : '');
  const board = d.boardTexture
    ? ` [${[d.boardTexture.paired && 'paired', d.boardTexture.monotone && 'mono',
            d.boardTexture.connected && 'connected'].filter(Boolean).join('/') || 'dry'}]`
    : '';
  const did = (d.action === PRIMITIVE_ACTIONS.RAISE || d.action === 'bet')
    ? `I ${d.action} ${d.raiseToFractionOfPot != null ? d.raiseToFractionOfPot.toFixed(2) + 'x pot' : '?'}`
    : `I ${d.action}`;
  return `${d.street.padEnd(7)} | ${facing}${board}, ${d.opponentsLive} live, pot ${d.potBB}bb, ${spr}, ${price}${role} -> ${did}${hand}`;
};
