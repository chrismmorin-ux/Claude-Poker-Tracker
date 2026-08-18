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
import { parseAndEncode } from '../../src/utils/pokerCore/cardParser.js';
import { analyzeBoardFromStrings } from '../../src/utils/pokerCore/boardTexture.js';
import { decisionGeometryFull } from '../backtest/decisionGeometry.mjs';

export const STREETS = ['preflop', 'flop', 'turn', 'river'];
const POSTED = new Set(['postSmallBlind', 'postBigBlind', 'post', 'ante', 'straddle']);

const RANKS = '23456789TJQKA';
const rankOf = (card) => RANKS.indexOf(String(card)[0].toUpperCase()) + 2;

/**
 * What THIS seat actually owes to continue, in big blinds — not the size of the bet.
 *
 * `decisionGeometry.facedBetChips` answers a different question: how big is the live bet.
 * Two things make that the wrong number for a price:
 *
 *  1. IT COUNTS ONLY BET/RAISE. Limps are recorded as `call`, and the blinds are not in the
 *     action sequence at all, so a seat facing two limps was reported as "nothing to call"
 *     when it owed a full big blind. Two explainer agents independently flagged folds in
 *     that state as inexplicable — the founder's strange-hand channel catching an instrument
 *     error rather than player behaviour.
 *  2. IT IGNORES WHAT THIS SEAT ALREADY PUT IN. A big blind facing a raise to 3bb owes 2bb,
 *     not 3bb, so every blind's price was overstated.
 *
 * Commitments follow the corpus conventions documented in decisionGeometry:1 91-197 —
 * BET/RAISE `amount` is TOTAL street commitment, CALL `amount` is the INCREMENT owed.
 */
const owedAt = (hand, order, street, seat, bb) => {
  const g = hand.gameState || {};
  const occupied = Object.keys(hand.seatPlayers || {}).map(Number).sort((a, b) => a - b);
  const committed = {};

  if (street === 'preflop' && occupied.length) {
    // Blinds are forced and never appear as actions. Seed them from the button.
    const bi = occupied.indexOf(Number(g.dealerButtonSeat));
    if (bi >= 0) {
      const order2 = [...occupied.slice(bi + 1), ...occupied.slice(0, bi + 1)];
      const sbSeat = order2[0];
      const bbSeat = order2[1];
      if (sbSeat != null) committed[String(sbSeat)] = (g.blinds?.sb ?? bb / 2) / bb;
      if (bbSeat != null) committed[String(bbSeat)] = (g.blinds?.bb ?? bb) / bb;
    }
  }

  for (const e of [...(g.actionSequence || [])].sort((a, b) => a.order - b.order)) {
    if (e.order >= order) break;
    if (e.street !== street) continue;
    const es = String(e.seat);
    const amt = (e.amount ?? 0) / bb;
    if (e.action === PRIMITIVE_ACTIONS.RAISE || e.action === 'bet') {
      committed[es] = amt;                          // total street commitment
    } else if (e.action === PRIMITIVE_ACTIONS.CALL) {
      committed[es] = (committed[es] || 0) + amt;   // increment owed
    }
  }
  const highest = Math.max(0, ...Object.values(committed));
  return Math.max(0, highest - (committed[String(seat)] || 0));
};

/**
 * What this seat has already put in THIS HAND before the decision at `order`.
 *
 * Strictly backward-looking. Blinds are seeded because they are money the villain has
 * committed and can see, and they never appear as actions.
 */
const investedSoFar = (hand, order, seat, bb) => {
  const g = hand.gameState || {};
  const occupied = Object.keys(hand.seatPlayers || {}).map(Number).sort((a, b) => a - b);
  const s = String(seat);
  let total = 0;

  const bi = occupied.indexOf(Number(g.dealerButtonSeat));
  if (bi >= 0) {
    const ring = [...occupied.slice(bi + 1), ...occupied.slice(0, bi + 1)];
    if (String(ring[0]) === s) total += (g.blinds?.sb ?? bb / 2) / bb;
    if (String(ring[1]) === s) total += (g.blinds?.bb ?? bb) / bb;
  }

  const perStreet = {};
  for (const e of [...(g.actionSequence || [])].sort((a, b) => a.order - b.order)) {
    if (e.order >= order) break;
    if (String(e.seat) !== s) continue;
    const amt = (e.amount ?? 0) / bb;
    if (e.action === PRIMITIVE_ACTIONS.RAISE || e.action === 'bet') {
      // total street commitment — replaces this street's prior contribution
      total += Math.max(0, amt - (perStreet[e.street] || 0));
      perStreet[e.street] = amt;
    } else if (e.action === PRIMITIVE_ACTIONS.CALL) {
      total += amt;                                   // increment owed
      perStreet[e.street] = (perStreet[e.street] || 0) + amt;
    }
  }
  return +total.toFixed(2);
};

/**
 * Am I last to act on this street among the players still in the hand?
 *
 * FOUNDER, 2026-08-18: "CO v BTN and SB v BB both have wildly different ranges, but postflop
 * they are just in position or out of position. otherwise the correlation is going to look
 * like a spiral."
 *
 * Exactly right, and it is a feature-selection rule rather than an extra column. Six position
 * labels applied postflop fragment the data six ways chasing structure that is really one
 * binary wearing six names. Preflop the labels are real — the blinds have money in and the
 * button acts last — so both features exist and each is used only where it means something.
 *
 * Postflop order runs SB first and BTN last, which is the reverse of who has already paid.
 */
const isInPosition = (hand, street, seat, foldedBefore) => {
  if (street === 'preflop') return null;
  const g = hand.gameState || {};
  const occupied = Object.keys(hand.seatPlayers || {}).map(Number).sort((a, b) => a - b);
  const bi = occupied.indexOf(Number(g.dealerButtonSeat));
  if (bi < 0) return null;
  // Postflop action order: first seat after the button, ... , button last.
  const order = [...occupied.slice(bi + 1), ...occupied.slice(0, bi + 1)];
  const live = order.filter(x => !foldedBefore.has(String(x)));
  if (!live.length) return null;
  return String(live[live.length - 1]) === String(seat);
};

const geoBB = (hand) => (hand._backtest?.bb || 1);

/** How many opponents have already CALLED the live bet before this decision. */
const countCallersAhead = (hand, order, street) => {
  let seenBet = false, callers = 0;
  for (const e of [...(hand.gameState?.actionSequence || [])].sort((a, b) => a.order - b.order)) {
    if (e.order >= order) break;
    if (e.street !== street) continue;
    if (e.action === PRIMITIVE_ACTIONS.RAISE || e.action === 'bet') { seenBet = true; callers = 0; }
    else if (seenBet && e.action === PRIMITIVE_ACTIONS.CALL) callers++;
  }
  return callers;
};

/** Did the live bet put its bettor all in? */
const isAllInBet = (hand, order, street) => {
  const stacks = hand._backtest?.stackBeforeByOrder || {};
  let last = null;
  for (const e of [...(hand.gameState?.actionSequence || [])].sort((a, b) => a.order - b.order)) {
    if (e.order >= order) break;
    if (e.street !== street) continue;
    if (e.action === PRIMITIVE_ACTIONS.RAISE || e.action === 'bet') last = e;
  }
  if (!last) return null;
  const st = stacks[last.order];
  return st == null ? null : (last.amount ?? 0) >= st - 1e-6;
};

/** Did the newest board card pair the board? */
const boardPairedOn = (prev, now) => {
  if (!prev.length || now.length <= prev.length) return null;
  const fresh = now.slice(prev.length).map(rankOf);
  const before = prev.map(rankOf);
  return fresh.some(r => before.includes(r));
};

/** Did a card arrive higher than everything that was already out? */
const overcardOn = (prev, now) => {
  if (!prev.length || now.length <= prev.length) return null;
  const top = Math.max(...prev.map(rankOf));
  return now.slice(prev.length).map(rankOf).some(r => r > top);
};

/** Did the newest card bring a third (or more) card of one suit? */
const flushCardOn = (prev, now) => {
  if (!prev.length || now.length <= prev.length) return null;
  const suit = (c) => String(c).slice(1);
  const before = {}; for (const c of prev) before[suit(c)] = (before[suit(c)] || 0) + 1;
  const beforeMax = Math.max(0, ...Object.values(before));
  const after = {}; for (const c of now) after[suit(c)] = (after[suit(c)] || 0) + 1;
  const afterMax = Math.max(0, ...Object.values(after));
  return afterMax >= 3 && afterMax > beforeMax;
};

/**
 * OVER-ENUMERATE POSITION — the founder's un-aggregation instruction, 2026-08-18:
 * "we can overenumerate the description of the position for the agent. this is how to
 * unaggregate."
 *
 * One label answers one question. A player uses several at once, and which one governs a
 * given rule is exactly what we do not know in advance — so every framing is offered and the
 * correlation picks. `CO` and `one off the button` and `three players still behind me` are
 * the same fact wearing different clothes, and different rules key on different clothes.
 *
 * The one that matters most is rarely the seat NAME: it is usually the relationship to the
 * player applying pressure. Acting after the aggressor is a different decision from acting
 * before them even when the seat label is identical.
 */
const actionOrder = (hand, street) => {
  const g = hand.gameState || {};
  const occupied = Object.keys(hand.seatPlayers || {}).map(Number).sort((a, b) => a - b);
  const bi = occupied.indexOf(Number(g.dealerButtonSeat));
  if (bi < 0) return occupied.map(String);
  const postflop = [...occupied.slice(bi + 1), ...occupied.slice(0, bi + 1)];  // SB..BTN
  if (street !== 'preflop') return postflop.map(String);
  // Preflop the blinds act last: UTG is two after the SB.
  return [...postflop.slice(2), ...postflop.slice(0, 2)].map(String);
};

const positionDetail = (hand, street, seat, foldedSeats, aggressorSeat) => {
  const g = hand.gameState || {};
  const occupied = Object.keys(hand.seatPlayers || {}).map(Number).sort((a, b) => a - b);
  const order = actionOrder(hand, street);
  const s = String(seat);
  const idx = order.indexOf(s);
  const live = order.filter(x => !foldedSeats.has(x) || x === s);
  const liveIdx = live.indexOf(s);

  // Distance from the button, counting backwards: BTN=0, CO=1, HJ=2 ...
  const bi = occupied.indexOf(Number(g.dealerButtonSeat));
  const ring = bi >= 0 ? [...occupied.slice(bi + 1), ...occupied.slice(0, bi + 1)] : occupied;
  const ringIdx = ring.map(String).indexOf(s);
  const offButton = ringIdx < 0 ? null : (ring.length - 1 - ringIdx);

  return {
    seatsToActAfterMe: liveIdx < 0 ? null : Math.max(0, live.length - 1 - liveIdx),
    seatsActedBeforeMe: liveIdx < 0 ? null : liveIdx,
    offButton,
    isBlind: offButton != null && (offButton === ring.length - 1 || offButton === ring.length - 2),
    isLate: offButton != null && offButton <= 1,
    actsAfterAggressor: aggressorSeat == null || idx < 0 ? null
      : idx > order.indexOf(String(aggressorSeat)),
    blindVsBlind: live.length === 2 && live.every(x => {
      const i = ring.map(String).indexOf(x);
      return i === 0 || i === 1;
    }),
  };
};

const boardFor = (community, street) => {
  const n = { preflop: 0, flop: 3, turn: 4, river: 5 }[street] ?? 0;
  return (community || []).slice(0, n);
};

/**
 * Where this seat sits relative to the button.
 *
 * Added because a ruleset cannot express "the big blind behaves differently" without the
 * feature, and the founder named that split directly. Position appears here as a DESCRIPTION
 * of the situation — who acts when, and who has already posted — never as a causal input to
 * a decision model (POKER_THEORY §7.1). A rule may condition on it for the same reason a
 * player does: it says how much money is already yours and how many people act after you.
 */
export const positionOf = (seat, button, occupiedSeats) => {
  const ring = [...occupiedSeats].map(Number).sort((a, b) => a - b);
  const bi = ring.indexOf(Number(button));
  if (bi < 0) return 'unknown';
  const order = [...ring.slice(bi + 1), ...ring.slice(0, bi + 1)];  // SB, BB, ... , BTN
  const i = order.indexOf(Number(seat));
  if (i < 0) return 'unknown';
  const n = order.length;
  if (i === 0) return 'SB';
  if (i === 1) return 'BB';
  if (i === n - 1) return 'BTN';
  if (i === n - 2) return 'CO';
  if (i === n - 3) return 'HJ';
  return 'EP';
};

/**
 * The made-hand class in the terms a player would use at the table.
 * Only called when hole cards are known; returns null otherwise.
 */
export const classifyMadeHand = (hole, board) => {
  if (!hole || hole.length < 2 || !board || board.length < 3) return null;
  let category = null;
  try {
    // `bestFiveFromSeven` takes ENCODED CARD INTEGERS, not card strings. Passing strings
    // silently scores garbage — it reported "Flush" for 7h6h on 2d 5c 8s, which is 8-high.
    // Caught by a known-answer anchor, not by reading the code, and it would have been
    // fabricated evidence in every explanation built on this field.
    const encoded = [...hole, ...board].map(parseAndEncode);
    category = encoded.some(c => c < 0) ? null : handCategory(bestFiveFromSeven(encoded));
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

  const occupied = Object.keys(hand.seatPlayers || {});
  const position = positionOf(s, hand?.gameState?.dealerButtonSeat, occupied);

  const out = [];
  let street = 'preflop';
  let raisesThisStreet = 0;
  let entrantsPF = 0;
  let aggressorPF = null;
  let streetAggressor = null;
  let lastAggressorSeat = null;   // who made the bet/raise currently standing
  const foldedSeats = new Set();

  /**
   * WHAT HAPPENED ON THE STREET BEFORE THIS ONE.
   *
   * FOUNDER, 2026-08-18: "'faced aggression last street' is inferable from the data. But its
   * also a binary thing that is likely correlated to villain's ruleset."
   *
   * These are the sequence facts a per-node view structurally cannot hold. A player who
   * called a bet and now faces another is in a different decision from one seeing a first
   * bet, even when the price, board and position are identical — and until now those two
   * decisions were the same row.
   */
  let pfRaises = 0;       // how many raises went in preflop — carried into every later street
  let barrels = 0;        // consecutive streets the current aggressor has bet
  const streetLog = {};   // street -> { facedBet, iBet, iCalled, checkedThrough, aggressor }
  let curLog = { facedBet: false, iBet: false, iCalled: false, anyBet: false, aggressor: null };
  let prevLog = null;
  let prevBoard = [];
  let handAggressor = null;   // last player to bet/raise anywhere in the hand

  for (const e of seq) {
    if (e.street !== street) {
      if (street === 'preflop') pfRaises = raisesThisStreet;
      barrels = curLog.anyBet ? barrels + 1 : 0;
      streetLog[street] = curLog;
      prevLog = curLog;
      prevBoard = boardFor(community, street);
      curLog = { facedBet: false, iBet: false, iCalled: false, anyBet: false, aggressor: null };
      street = e.street;
      raisesThisStreet = 0;
      streetAggressor = null;
      lastAggressorSeat = null;
    }
    const es = String(e.seat);

    if (es === s && !POSTED.has(e.action)) {
      const geo = decisionGeometryFull(hand, e.order, street, s);
      const board = boardFor(community, street);
      const texture = board.length >= 3 ? analyzeBoardFromStrings(board) : null;
      // What this seat OWES, not the size of the live bet. See `owedAt` — using the bet size
      // reported "nothing to call" in limped pots and overstated every blind's price.
      const facingBB = owedAt(hand, e.order, street, s, geo?.bb || (hand._backtest?.bb || 1));
      const bbUnit = geo?.bb || (hand._backtest?.bb || 1);
      // Everything the villain can see about the money, not only his own price.
      const myStackBB = geo?.stackChips != null ? geo.stackChips / bbUnit : null;
      // NOT `_backtest.committedBySeat` — that is the FINAL total for the hand, so using it
      // here would feed the inducer the future. It produced "invested 21.7bb" against a
      // 20.7bb stack, which is what exposed it. Computed strictly from actions before this
      // decision, blinds included.
      const investedBB = investedSoFar(hand, e.order, s, bbUnit);
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
        position,
        seatsDealt: occupied.length,
        // WHO is applying the pressure. A player reads a button raise differently from an
        // under-the-gun raise, and withholding it hides a condition the villain acts on.
        inPosition: isInPosition(hand, street, s, foldedSeats),
        // ── the pot's HISTORY, carried forward. A flop in a 3-bet pot is a different spot
        // from a flop in a limped pot, and `raisesFaced` resets every street so postflop
        // rows had no memory of it at all.
        preflopPotType: street === 'preflop' ? null
          : (pfRaises === 0 ? 'limped pot' : pfRaises === 1 ? 'single-raised pot'
            : pfRaises === 2 ? '3-bet pot' : '4-bet+ pot'),
        barrelsSoFar: street === 'preflop' ? null : barrels,
        // Within a street, "a bet" hid two opposite situations: someone bet into me, or
        // someone RAISED the bet I just made. `iAmStreetAggressor` was computed and never
        // surfaced, so those were the same row.
        iBetThisStreet: streetAggressor === s,
        raisedOverMyBet: facingBB > 0 && curLog.iBet,
        // How many have already CALLED the live bet ahead of me — a squeeze/overcall spot is
        // not the same decision as being first to answer.
        callersAhead: countCallersAhead(hand, e.order, street),
        facingAllIn: geo?.stackChips != null && lastAggressorSeat != null
          ? isAllInBet(hand, e.order, street) : null,
        callingIsAllIn: (myStackBB != null && facingBB >= myStackBB - 0.01),
        ...positionDetail(hand, street, s, foldedSeats, lastAggressorSeat),
        // ── derived binaries: the sequence, and what the board just did ──
        facedAggressionLastStreet: prevLog ? prevLog.facedBet : null,
        iBetLastStreet: prevLog ? prevLog.iBet : null,
        iCalledLastStreet: prevLog ? prevLog.iCalled : null,
        lastStreetCheckedThrough: prevLog ? !prevLog.anyBet : null,
        iHaveInitiative: handAggressor == null ? null : handAggressor === s,
        facingSameAggressorAgain: !!(prevLog && prevLog.aggressor && lastAggressorSeat
          && prevLog.aggressor === lastAggressorSeat),
        multiway: geo?.liveOpponents == null ? null : geo.liveOpponents >= 2,
        boardPairedThisCard: boardPairedOn(prevBoard, boardFor(community, street)),
        overcardArrived: overcardOn(prevBoard, boardFor(community, street)),
        flushCardArrived: flushCardOn(prevBoard, boardFor(community, street)),
        potCommitted: (myStackBB != null && investedBB != null && (myStackBB + investedBB) > 0)
          ? (investedBB / (myStackBB + investedBB)) >= 0.33 : null,
        aggressorPosition: lastAggressorSeat
          ? positionOf(lastAggressorSeat, hand?.gameState?.dealerButtonSeat, occupied) : null,
        myStackBB: myStackBB == null ? null : +myStackBB.toFixed(1),
        investedBB: investedBB == null ? null : +investedBB.toFixed(2),
        // ---- the situation, as faced ----
        // WHAT is in front of me — keyed on the raise count, never on the amount owed.
        // Owing money and facing aggression are different facts: preflop everyone owes the
        // big blind, so keying `facing` on `owed > 0` labelled a LIMPED pot "facing a raise"
        // and destroyed the first-in population entirely. `owed` carries the price; this
        // carries the kind of action.
        // Raise DEPTH, not a binary. Collapsing every raise count >= 2 into "a 3-bet" put
        // 3-bets, 4-bets and 5-bets in one bucket, and facing a 4-bet is usually a
        // shove-or-fold decision rather than a defend decision. Measured: the old label
        // covered raises_in of 2, 3 and 4.
        facing: street === 'preflop'
          ? (raisesThisStreet === 0 ? 'no raise'
            : raisesThisStreet === 1 ? 'a raise'
              : raisesThisStreet === 2 ? 'a 3-bet'
                : raisesThisStreet === 3 ? 'a 4-bet' : 'a 5-bet or beyond')
          : (facingBB > 0 ? 'a bet' : 'no bet'),
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
        // NULL, not 0, when the field does not apply. Forcing 0 made "nobody limped, I am
        // first in" (734 decisions) indistinguishable from "facing a raise" (588) in that
        // column. It was masked only because `facing` always won the root split first.
        limpersAhead: street === 'preflop' && raisesThisStreet === 0 ? entrantsPF : null,
        boardTexture: texture ? {
          // `analyzeBoardTexture` returns isPaired / isTrips / straightPossible — reading
          // `texture.paired` and `texture.straighty` silently returned undefined, so PAIRED
          // NEVER FIRED ONCE in 1,937 rows and the straight-possible branch was dead code.
          // Every paired board in the dataset was labelled as unpaired.
          paired: !!texture.isPaired,
          trips: !!texture.isTrips,
          monotone: !!texture.monotone,
          twoTone: !!texture.twoTone,
          flushDraw: !!texture.flushDraw,
          connected: (texture.connected || 0) > 0,
          straightPossible: !!texture.straightPossible,
          broadwayCount: texture.highCardCount ?? null,
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

    if (es === s) {
      if (e.action === PRIMITIVE_ACTIONS.CALL) curLog.iCalled = true;
      if (e.action === PRIMITIVE_ACTIONS.RAISE || e.action === 'bet') curLog.iBet = true;
      if (owedAt(hand, e.order, street, s, geoBB(hand)) > 0) curLog.facedBet = true;
    }
    if (e.action === PRIMITIVE_ACTIONS.FOLD) foldedSeats.add(es);
    if (street === 'preflop' && !POSTED.has(e.action)
        && (e.action === PRIMITIVE_ACTIONS.CALL || e.action === PRIMITIVE_ACTIONS.RAISE)) {
      entrantsPF++;
    }
    if (e.action === PRIMITIVE_ACTIONS.RAISE || e.action === 'bet') {
      raisesThisStreet++;
      streetAggressor = es;
      lastAggressorSeat = es;
      handAggressor = es;
      curLog.anyBet = true;
      curLog.aggressor = es;
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
