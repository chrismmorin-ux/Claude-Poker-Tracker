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
import { strengthAt } from './handStrength.mjs';
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

  const perStreet = {};

  /**
   * THE POSTED BLIND IS SEEDED INTO THE PREFLOP RUNNING TOTAL, NOT JUST ADDED.
   *
   * A bet/raise `amount` is the seat's CUMULATIVE commitment for the street, so the loop below
   * adds `amount - alreadyThisStreet`. With the blind added here but not recorded as
   * already-in, a big blind who raises TO 3 was charged 1 (the blind) plus the full 3 - four
   * big blinds of a three big-blind raise.
   *
   * It only fires for a blind who VOLUNTARILY raises, which is why it hid: 566 of 569 blind
   * decisions facing an open are exact, because those seats had not acted yet. Measured against
   * an independent recomputation: 69 of 3,386 decisions, every one off by exactly the posted
   * blind (+0.5 SB, +1.0 BB). Found by an agent reading one leaf, and I first refuted it with a
   * weaker test than the one that catches it.
   *
   * `investedBB` feeds `potCommitted` (a third of stack), so the error propagated into a
   * conditionable flag on exactly the aggressive-blind spots.
   */
  const bi = occupied.indexOf(Number(g.dealerButtonSeat));
  if (bi >= 0) {
    const ring = [...occupied.slice(bi + 1), ...occupied.slice(0, bi + 1)];
    if (String(ring[0]) === s) { const v = (g.blinds?.sb ?? bb / 2) / bb; total += v; perStreet.preflop = v; }
    if (String(ring[1]) === s) { const v = (g.blinds?.bb ?? bb) / bb; total += v; perStreet.preflop = v; }
  }

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
/**
 * Opponents who already put money in ahead of me on this street.
 *
 * PREFLOP THE BIG BLIND IS THE LIVE BET, so a limper has called it. Requiring a bet or raise
 * first made this 0 on every limped pot - 385 rows on villain 1, 894 on villain 2 - so a reader
 * treating it as "opponents already in" saw a heads-up-shaped spot that was three ways.
 */
const countCallersAhead = (hand, order, street) => {
  let seenBet = street === 'preflop';       // preflop the blind is already the live bet
  let callers = 0;
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
  const seq = [...(hand.gameState?.actionSequence || [])].sort((a, b) => a.order - b.order);
  let last = null;
  for (const e of seq) {
    if (e.order >= order) break;
    if (e.street !== street) continue;
    if (e.action === PRIMITIVE_ACTIONS.RAISE || e.action === 'bet') last = e;
  }
  if (!last) return null;
  const st = stacks[last.order];
  if (st == null) return null;

  /**
   * INCREMENTAL COST, NOT THE RAISE-TO FIGURE — the two are different bases and comparing
   * them across the equals sign called a bet all-in whenever the pot got big.
   *
   * `amount` on a bet/raise is CUMULATIVE for the street (the "raise to" number); `stackBefore`
   * is what the seat still HAS. So a seat who already put in 9 and raises TO 19 spends 10, and
   * the old test `19 >= 18.75` declared them all-in with 8.75 behind. Caught by the legal-action
   * gate on the first full-ring villain (2 of 13,723 decisions): he raised in a spot the labeller
   * said he could not, because it believed the seat in front of him was all-in. It was not - it
   * raised again two actions later.
   *
   * The error only fires in a multi-raise war on one street, which is why 4-6-handed villains
   * never triggered it: it needs the same seat to raise twice, so `amount` has a prior
   * commitment to be cumulative OVER. Everything it touches - `canRaise`, `facingAllIn` - was
   * therefore biased in ONE direction: too many spots looked forced.
   */
  let committed = 0;
  for (const e of seq) {
    if (e.order >= last.order) break;
    if (e.street !== street) continue;
    if (String(e.seat) !== String(last.seat)) continue;
    if (e.action === PRIMITIVE_ACTIONS.RAISE || e.action === 'bet'
      || e.action === PRIMITIVE_ACTIONS.CALL) committed = Math.max(committed, e.amount ?? 0);
  }
  return ((last.amount ?? 0) - committed) >= st - 1e-6;
};

/**
 * THE BET STANDING IN FRONT OF ME: how big it actually was, and what it was bet into.
 *
 * FOUNDER-FACING GAP, found by an agent reading one leaf cold: "no column reports how big the
 * raise actually was - the most informative fact about the aggressor." It was right. The schema
 * carried `to_call_bb` (what I owe) and `bet_x_pot`, and `bet_x_pot` was NOT the bet as a
 * fraction of the pot despite saying so: it computed `to_call / (pot - to_call)`, which is the
 * caller's price with his own dead blind folded in. Verified: `price_pct == 100b/(1+2b)` on all
 * 2,829 rows with zero exceptions, so the two columns carried ONE quantity between them and the
 * aggressor's sizing was nowhere.
 *
 * That matters because what I owe and what he bet are different facts whenever I already have
 * money in: a big blind facing a raise to 3 owes 2, and 2 is not the size of the bet he must
 * read. Every "is this a big bet or a small one" rule keyed on the old column was keyed on his
 * own price instead.
 *
 * The incremental cost is taken, not the cumulative "raise to" figure, and the posted blind is
 * seeded for preflop - the same base mismatch that made `isAllInBet` call a raise all-in.
 */
/**
 * WHAT I HAVE PUT IN ON THIS STREET, which is not what I have put in this hand.
 *
 * The schema carried only the hand total. But the quantity that closes the money identity at a
 * decision is the street one: what I owe is his bet MINUS what I already have in front of me
 * this street. Without it, "he bet 22 and I owe 17" looks like a contradiction rather than a
 * player who called 5 earlier in the round.
 */
const investedThisStreet = (hand, order, street, seat, bb) => {
  const g = hand.gameState || {};
  const occ = Object.keys(hand.seatPlayers || {}).map(Number).sort((a, b) => a - b);
  const bi = occ.indexOf(Number(g.dealerButtonSeat));
  const s = String(seat);
  let cum = 0;
  if (street === 'preflop' && bi >= 0) {
    const ring = [...occ.slice(bi + 1), ...occ.slice(0, bi + 1)];
    if (String(ring[0]) === s) cum = (g.blinds?.sb ?? bb / 2) / bb;
    if (String(ring[1]) === s) cum = (g.blinds?.bb ?? bb) / bb;
  }
  for (const e of [...(g.actionSequence || [])].sort((a, b) => a.order - b.order)) {
    if (e.order >= order) break;
    if (e.street !== street || String(e.seat) !== s) continue;
    const amt = (e.amount ?? 0) / bb;
    if (e.action === PRIMITIVE_ACTIONS.RAISE || e.action === 'bet') cum = Math.max(cum, amt);
    else if (e.action === PRIMITIVE_ACTIONS.CALL) cum += amt;
  }
  return +cum.toFixed(2);
};

const standingBet = (hand, order, street, bb) => {
  const g = hand.gameState || {};
  const seq = [...(g.actionSequence || [])].sort((a, b) => a.order - b.order);
  const occ = Object.keys(hand.seatPlayers || {}).map(Number).sort((a, b) => a - b);
  const bi = occ.indexOf(Number(g.dealerButtonSeat));
  const ring = bi >= 0 ? [...occ.slice(bi + 1), ...occ.slice(0, bi + 1)] : [];
  const blindOf = (seat) => {
    if (street !== 'preflop' || !ring.length) return 0;
    if (String(ring[0]) === String(seat)) return (g.blinds?.sb ?? bb / 2) / bb;
    if (String(ring[1]) === String(seat)) return (g.blinds?.bb ?? bb) / bb;
    return 0;
  };

  let last = null;
  for (const e of seq) {
    if (e.order >= order) break;
    if (e.street !== street) continue;
    if (e.action === PRIMITIVE_ACTIONS.RAISE || e.action === 'bet') last = e;
  }
  if (!last) return { betBB: null, potBeforeBB: null, fracPot: null };

  // What the bettor already had in on this street, so we price the RAISE and not the total.
  let prior = blindOf(last.seat);
  for (const e of seq) {
    if (e.order >= last.order) break;
    if (e.street !== street) continue;
    if (String(e.seat) !== String(last.seat)) continue;
    const amt = (e.amount ?? 0) / bb;
    if (e.action === PRIMITIVE_ACTIONS.RAISE || e.action === 'bet') prior = Math.max(prior, amt);
    else if (e.action === PRIMITIVE_ACTIONS.CALL) prior += amt;
  }
  const betBB = Math.max(0, (last.amount ?? 0) / bb - prior);

  // Every chip in the middle before he bet.
  let pot = 0; const per = {};
  if (ring.length) {
    const sb = (g.blinds?.sb ?? bb / 2) / bb, bbA = (g.blinds?.bb ?? bb) / bb;
    pot += sb + bbA;
    per[`preflop:${ring[0]}`] = sb;
    per[`preflop:${ring[1]}`] = bbA;
  }
  for (const e of seq) {
    if (e.order >= last.order) break;
    const key = `${e.street}:${e.seat}`;
    const amt = (e.amount ?? 0) / bb;
    if (e.action === PRIMITIVE_ACTIONS.RAISE || e.action === 'bet') {
      pot += Math.max(0, amt - (per[key] || 0)); per[key] = amt;
    } else if (e.action === PRIMITIVE_ACTIONS.CALL) {
      pot += amt; per[key] = (per[key] || 0) + amt;
    }
  }
  return {
    // BOTH BASES, NAMED, because confusing them has now produced three separate bugs in this
    // file: `isAllInBet` compared a raise-to against a remaining stack, `investedSoFar` added a
    // posted blind to a cumulative raise, and the first version of the sizing gate subtracted a
    // street total from an increment. The two numbers answer different questions - what he
    // RISKED on this action, and what I must MATCH - and neither is derivable from the other
    // without the street history, so both are carried.
    betBB: +betBB.toFixed(2),          // the increment: what this action cost him
    toBB: +((last.amount ?? 0) / bb).toFixed(2),  // cumulative for the street: what I must match
    potBeforeBB: +pot.toFixed(2),
    fracPot: pot > 0 ? +(betBB / pot).toFixed(3) : null,
  };
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

const positionDetail = (hand, street, seat, foldedSeats, aggressorSeat, streetActions = []) => {
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
  const rawOffButton = ringIdx < 0 ? null : (ring.length - 1 - ringIdx);
  const isBlind = rawOffButton != null
    && (rawOffButton === ring.length - 1 || rawOffButton === ring.length - 2);

  /**
   * OFF-BUTTON IS NULL IN THE BLINDS, and that is the whole point of the field.
   *
   * FOUNDER, 2026-08-18: "i did not know off button blended all those. They certainly need to
   * be their own seats, SB, BB, and UTG are drastically different."
   *
   * Counting seats back from the button is only a coherent quantity across DIFFERENT TABLE
   * SIZES if the blinds are excluded. With them in, `offButton = 3` was the small blind at a
   * 5-handed table, the big blind at a 6-handed table, and early position at a 7-handed one —
   * so the induction pooled three unrelated seats into one "rule" and the resulting ladder was
   * non-monotone for a reason that had nothing to do with the player. Measured on villain 1:
   * off_button 3 held EP 180, BB 71 and SB 25, and two independent readers flagged that bucket
   * as anomalous before the cause was known.
   *
   * Excluded, the field means "how many voluntarily-acting seats are behind me", which is a
   * mechanism (players left to act) and is stable across table sizes: 2 is the hijack whether
   * the table is five-handed or nine. The blinds are described by `seat_pos` and `is_blind`,
   * which do not conflate anything.
   */
  /**
   * BLINDS CARRY THEIR DISTANCE FROM THE BUTTON TOO.
   *
   * This was null for a blind, which is ~90% of some postflop spots - an agent reading one put
   * it plainly: the numeric position column is blank exactly where position is the whole story.
   * The defect it originally guarded against was `off_button = 3` meaning early position at
   * six-handed and a BLIND at five-handed, but `is_blind` and `players` sit beside it and
   * disambiguate, and the gate now checks uniqueness within a table size.
   *
   * Withholding a true decision-time fact to prevent a downstream confusion is the wrong trade
   * against an instruction to over-enumerate: a rule can ignore a column, and can never recover
   * one that was never emitted.
   */
  const offButton = rawOffButton;

  /**
   * WHO STILL OWES A DECISION, not who merely sits behind me.
   *
   * These were pure SEAT ORDER: `live.length - 1 - liveIdx` counts non-folded players positioned
   * after me, which is a different quantity from players who still owe an action. Once the
   * betting wraps - I check, someone behind bets, it returns to me - that player has acted and
   * is still "behind" me, so the column said 1 where the true answer is 0.
   *
   * Measured before the fix: 166 decisions on villain 1 and 466 on villain 2 read "first to act"
   * while FACING A BET, which the legend's own words make impossible, and ~6.7% of all rows
   * contradicted `closes`. The corrected quantity is the one a player uses - how many opponents
   * can still raise behind me - and a seat that has already matched the live bet is not one.
   */
  const lastAggOrder = (() => {
    let o = -1;
    for (const e of streetActions) {
      if (e.action === PRIMITIVE_ACTIONS.RAISE || e.action === 'bet') o = e.order;
    }
    return o;
  })();
  const lastActOf = new Map();
  for (const e of streetActions) lastActOf.set(String(e.seat), e.order);
  const stillOwes = (seat2) => {
    const last = lastActOf.get(String(seat2));
    if (last === undefined) return true;             // has not acted on this street at all
    return last < lastAggOrder;                      // acted, then a bet or raise came over it
  };
  let behind = 0;
  for (let i = liveIdx + 1; i < live.length; i++) if (stillOwes(live[i])) behind++;

  return {
    seatsToActAfterMe: liveIdx < 0 ? null : behind,
    seatsActedBeforeMe: liveIdx < 0 ? null : Math.max(0, live.length - 1 - behind),
    offButton,
    isBlind,
    // A BLIND IS NEVER LATE POSITION, however close it sits to the button.
    // `rawOffButton` is computed for every seat, including the blinds - unlike the exposed
    // `offButton`, which is deliberately null for them. At THREE-handed the big blind is one
    // seat off the button, so the bare distance test flagged it `is_late`. Measured on villain
    // 2: 42 rows, every one a big blind at a 3-handed table. Villain 1 never played 3-handed,
    // which is why the first villain profiled showed zero and the bug survived.
    isLate: !isBlind && rawOffButton != null && rawOffButton <= 1,
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
  // FOUNDER, 2026-08-18: "SB, BB, and UTG are drastically different." `EP` used to swallow
  // every remaining seat, so at a full table the first seat to act — the one with the whole
  // field behind it — was pooled with a seat two off the hijack. Naming them separately costs
  // nothing: the induction merges what it cannot distinguish, but it can never recover a
  // distinction the labels threw away.
  //
  // UTG IS TESTED BEFORE THE HIJACK, and the order is the whole point. `i === n - 3` used to
  // run first, which is correct at six-handed and wrong at five: there the third seat is BOTH
  // `n - 3` and the first voluntary actor, and it was named HJ. That pooled 365 preflop
  // decisions where he opened the field with 4 behind into the same label as the seat that
  // acts second — measured on villain 1 as HJ@5 4.8% (n=146) against HJ@6 12.2% (n=213). The
  // induction then emitted `seat pos = HJ -> I raise 9%`, a rule describing no real situation
  // and sitting below UTG, which reads as a player who opens tighter in later position.
  //
  // Early seats are named from the FRONT (who acts first) and late seats from the BACK
  // (distance to the button); that is how the game names them, and it is why the two checks
  // cannot be written in either order indifferently. Five-handed is now SB/BB/UTG/CO/BTN with
  // no hijack, which is the standard naming and leaves every label meaning one seat role.
  if (i === 2) return 'UTG';
  if (i === n - 3) return 'HJ';
  if (i === 3) return 'UTG1';
  if (i === 4) return 'UTG2';
  // Numbered, because a bare 'MP' fall-through put TWO seats under one label at ten-handed --
  // the same collision as the hijack above, just further from the button and out of reach of
  // this corpus (max 9 dealt). Naming it by index costs nothing and keeps the invariant that
  // one label means one seat.
  return i === 5 ? 'MP' : `MP${i - 5}`;
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

  /**
   * EVERY action on the current street, in order, opponents included.
   *
   * Kept so each decision can carry the raw material the CANONICAL situation key needs
   * (`buildSpotAxes` derives `facingAction` and `contextAction` from it). The villain schema
   * already records a `facing` column, but that is THIS module's own vocabulary; the canonical
   * key is `src/utils/pokerCore/situationKey.js`, whose atom schema states outright that a
   * situationKey must not be "a positional string of the caller's own devising". Carrying the
   * timeline lets the canonical deriver run on the same rows rather than being reimplemented
   * here, which is the only version that cannot drift from the rest of the repo.
   */
  let streetActions = [];

  for (const e of seq) {
    if (e.street !== street) {
      streetActions = [];
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
      const stand = standingBet(hand, e.order, street, geo?.bb || (hand._backtest?.bb || 1));
      const inStreet = investedThisStreet(hand, e.order, street, s, geo?.bb || (hand._backtest?.bb || 1));
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
        // THE ACTUAL BOARD, carried and never keyed. He can see it, so it is not an outcome -
        // but as a rule CONDITION it would explode the feature space and fit noise, exactly as
        // `handClass` would. It exists so the combinatorics can delete the combos the board
        // makes impossible, which is the only way to ask what his range could actually MAKE.
        boardCards: board && board.length ? [...board] : null,
        // Filled in below, once the whole decision exists - `strengthAt` reads the board and the
        // preflop context off the finished row rather than being handed six loose arguments.
        strength: null,
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
        // BUG, found 2026-08-18 by an agent reading this leaf cold: this was
        // `streetAggressor === s`, and `streetAggressor` is REASSIGNED to whoever raised
        // last. So the moment someone raised over him the field flipped to false, and it
        // meant "am I currently the aggressor" rather than "did I bet on this street" —
        // which is what its own schema description claims. All 39 rows with
        // `raisedOverMyBet` true had `iBetThisStreet` false, which is impossible: your bet
        // cannot be raised if you never bet. `curLog.iBet` is the fact the name describes.
        // Same failure mode as `texture.paired` and the price-owed bug: a field whose name
        // and behaviour disagree in silence. Gated below.
        iBetThisStreet: curLog.iBet,
        raisedOverMyBet: facingBB > 0 && curLog.iBet,
        /**
         * WAS MY BET RAISED ON THE PREVIOUS STREET. `raisedOverMyBet` is street-scoped, so on
         * the street AFTER being raised it is trivially false - and that is precisely the state
         * that matters, because his range is then capped by his own decision not to re-raise.
         * An agent found this state separates a 163-row leaf at p = 5e-6 (1 bet in 18 against 88
         * in 145); the automated pass could not, because the fact existed only as a conjunction
         * of two other columns and neither alone was significant.
         */
        myBetWasRaisedLastStreet: prevLog ? !!(prevLog.iBet && prevLog.iCalled) : null,
        // WHETHER RAISING IS EVEN LEGAL. Without this, a mix is computed over rows where
        // one of the actions in the mix was not available — the villain "chose" not to raise
        // in spots where raising did not exist. Measured on villain 1: 9 of the 33 decisions
        // in the heavily-invested leaf face an all-in, and removing them moves that rule from
        // call 52 / fold 27 / raise 21 to call 42 / fold 29 / raise 29. The published "calls
        // about half" was partly an artifact of counting forced continuations as choices.
        // It belongs in SITUATION rather than being filtered out: the villain could see it,
        // so the induction should be allowed to condition on it and keep 100% coverage.
        // Two ways raising can be off the table, and BOTH are needed. Having chips left is
        // not sufficient: facing an all-in with no other live opponent, there is nobody left
        // to raise, however deep you are. That case is 7 of the 9 forced rows in the
        // heavily-invested leaf, and a stack-only test misses every one of them.
        canRaise: (myStackBB == null || facingBB == null) ? null
          : (myStackBB > facingBB + 0.01)
            && !(isAllInBet(hand, e.order, street) && (geo?.liveOpponents ?? 0) <= 1),
        // How many have already CALLED the live bet ahead of me — a squeeze/overcall spot is
        // not the same decision as being first to answer.
        callersAhead: countCallersAhead(hand, e.order, street),
        facingAllIn: geo?.stackChips != null && lastAggressorSeat != null
          ? isAllInBet(hand, e.order, street) : null,
        callingIsAllIn: (myStackBB != null && facingBB >= myStackBB - 0.01),
        ...positionDetail(hand, street, s, foldedSeats, lastAggressorSeat, streetActions),
        // ── derived binaries: the sequence, and what the board just did ──
        facedAggressionLastStreet: prevLog ? prevLog.facedBet : null,
        iBetLastStreet: prevLog ? prevLog.iBet : null,
        iCalledLastStreet: prevLog ? prevLog.iCalled : null,
        lastStreetCheckedThrough: prevLog ? !prevLog.anyBet : null,
        iHaveInitiative: handAggressor == null ? null : handAggressor === s,
        // NULL WHEN THERE IS NO AGGRESSOR, rather than "no".
        // A bare `false` here asserts something about a player who does not exist: 2,119 rows on
        // villain 1 and 5,995 on villain 2 read `same_aggressor = no` while `aggressor = -`.
        // That is not a fact about him, and it hands the induction a pseudo-informative value to
        // split on - `initiative` and `after_aggr` already blank correctly in the same state.
        facingSameAggressorAgain: lastAggressorSeat == null ? null
          : !!(prevLog && prevLog.aggressor && prevLog.aggressor === lastAggressorSeat),
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
        /**
         * POSTFLOP NOW HAS A RAISE VOCABULARY. It did not, and the omission collapsed two
         * opposite situations into one string: a villain betting into him, and a villain RAISING
         * his own bet, both read "a bet". Two leaves in the same ruleset carried flop rows that
         * were indistinguishable on this field while being the reverse of each other - in one he
         * decides whether to defend, in the other his own aggression has just been beaten.
         * Preflop escalated correctly the whole time, so the vocabulary existed and stopped at
         * the flop.
         */
        facing: street === 'preflop'
          ? (raisesThisStreet === 0 ? 'no raise'
            : raisesThisStreet === 1 ? 'a raise'
              : raisesThisStreet === 2 ? 'a 3-bet'
                : raisesThisStreet === 3 ? 'a 4-bet' : 'a 5-bet or beyond')
          : (facingBB <= 0 ? 'no bet'
            : raisesThisStreet <= 1 ? 'a bet'
              : raisesThisStreet === 2 ? 'a raise'
                : raisesThisStreet === 3 ? 'a re-raise' : 'a re-raise or beyond'),
        toCallBB: +facingBB.toFixed(2),
        potBB: potBB == null ? null : +potBB.toFixed(2),
        // THE AGGRESSOR'S SIZING, which the schema did not carry until now. `betFractionOfPot`
        // used to be `toCall / (pot - toCall)` - the caller's own price, algebraically identical
        // to `potOddsNeeded` and therefore a duplicate column, while the bet itself went
        // unrecorded. It is now what its name and its legend always claimed.
        betFractionOfPot: stand.fracPot,
        aggressorBetBB: stand.betBB,
        aggressorToBB: stand.toBB,
        investedThisStreetBB: inStreet,
        potBeforeBetBB: stand.potBeforeBB,
        potOddsNeeded: potOdds == null ? null : +potOdds.toFixed(3),
        spr: geo?.spr ?? null,
        sprBand: geo?.sprBand ?? null,
        sizeBucket: geo?.sizeBucket ?? null,
        closesAction: geo?.closesAction ?? null,
        opponentsLive: geo?.liveOpponents ?? null,
        raisesFaced: raisesThisStreet,
        // "Was I the LAST preflop aggressor", which is NOT "did I raise preflop": a player who
        // opens and then calls a 3-bet reads false here despite having raised. The name now says
        // which of the two it is.
        iAmLastPreflopAggressor: aggressorPF === s,
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
          // FOUNDER, 2026-08-19: "we aren't inputting flushdraws on two toned boards???"
          // We were not. `flushDraw` is `maxSuitFreq >= 3` - three to a suit ON THE BOARD - so
          // it is FALSE on every two-tone board, which is exactly where a hand holds a flush
          // draw. The count is what carries the fact: 2 = he can hold a draw with two cards to
          // come, 3 = one card completes it, 4+ = the flush is already out there.
          // Forgetting to add it to THIS subset is how `paired` fired zero times in 1,937 rows.
          maxSuitFreq: texture.maxSuitFreq ?? null,
          connected: (texture.connected || 0) > 0,
          straightPossible: !!texture.straightPossible,
          broadwayCount: texture.highCardCount ?? null,
          highCard: board.length ? RANKS[Math.max(...board.map(rankOf)) - 2] : null,
        } : null,
        // ---- what they did ----
        action: e.action,
        /**
         * MY OWN SIZING, WITH ITS BASE NAMED. `raiseToFractionOfPot` divided the CUMULATIVE
         * street commitment by the pot INCLUDING the bet being raised - two conventions in one
         * ratio, under a legend that said only "as a fraction of the pot". Read naively every
         * raise in the corpus converts wrongly: one reported as "2.08x pot" was a raise TO
         * 2.08x, which is 3.57x the pot actually being raised into. Both quantities are emitted
         * under names that say what they are, and the ambiguous one is gone rather than
         * re-documented.
         */
        myRaiseToBB: (e.action === PRIMITIVE_ACTIONS.RAISE || e.action === 'bet')
          && Number.isFinite(e.amount) ? +(e.amount / geo.bb).toFixed(2) : null,
        myBetOverPotBefore: (e.action === PRIMITIVE_ACTIONS.RAISE || e.action === 'bet')
          && Number.isFinite(e.amount) && potBB
          ? +(((e.amount / geo.bb) - inStreet)
            / Math.max(potBB - ((e.amount / geo.bb) - inStreet), 0.01)).toFixed(3) : null,
        // ---- what we could see of their hand ----
        handKnown: !!shown,
        holeCards: shown || null,
        handClass: shown ? classifyMadeHand(shown, board) : null,

        /**
         * RAW MATERIAL FOR THE CANONICAL SPOT KEY — deliberately not a key.
         *
         * Underscored because these are inputs to `spotKey.mjs`, not columns a rule may
         * condition on. Deriving the canonical axes HERE would be a second implementation of
         * `buildSpotAxes` and would be free to disagree with the first, which is the exact
         * failure WS-318 fixed (hero-side and villain-side keys disagreeing about what axis 3
         * meant, so the weakness matcher compared 'bet' against 'agg' and never matched).
         */
        _spotRaw: {
          entryOrder: e.order,
          seat: s,
          buttonSeat: hand?.gameState?.dealerButtonSeat ?? null,
          streetActions: streetActions.map((a) => ({ seat: a.seat, action: a.action, order: a.order })),
          aggSeat: streetAggressor,
          textureClass: texture?.texture ?? null,
          primitive: e.action,
          seatsDealt: occupied.length,
        },
      });
    }

    /**
     * STRENGTH IS COMPUTED ON THE FINISHED ROW, and only for the EXACT basis here.
     *
     * The exact arm needs nothing but the board, so it belongs in the labeller where every
     * consumer gets it for free. The assumed arm needs this villain's measured entry widths,
     * which are a product of a full pass over his hands and cannot exist while that pass is
     * still running - `profileVillain` fills those in afterwards. Computing half of it here and
     * half later is deliberate: the half that needs no assumption should never wait on the half
     * that does.
     */
    if (out.length && out[out.length - 1].order === e.order) {
      const row = out[out.length - 1];
      row.strength = strengthAt(row, null);
    }

    // AFTER the decision above is emitted, so a decision never sees its own action.
    if (!POSTED.has(e.action)) streetActions.push({ seat: es, action: e.action, order: e.order });

    if (es === s) {
      if (e.action === PRIMITIVE_ACTIONS.CALL) curLog.iCalled = true;
      if (e.action === PRIMITIVE_ACTIONS.RAISE || e.action === 'bet') curLog.iBet = true;
      /**
       * A POSTED BLIND IS NOT AGGRESSION. This read `owed > 0`, and preflop everyone owes the
       * big blind - so the small blind "faced aggression" in a limped pot and the flag became a
       * proxy for "am I not the big blind". Measured: 38 limped-pot rows on villain 1 carried
       * `faced_agg_prev = yes`, and on flop rows it ran ~96% constant, which reads as a feature
       * while carrying nothing.
       */
      if (raisesThisStreet > 0 && owedAt(hand, e.order, street, s, geoBB(hand)) > 0) {
        curLog.facedBet = true;
      }
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
  const role = d.iAmLastPreflopAggressor ? ' [I raised pf]' : '';
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
    ? `I ${d.action} ${d.myBetOverPotBefore != null ? d.myBetOverPotBefore.toFixed(2) + 'x pot' : '?'}`
    : `I ${d.action}`;
  return `${d.street.padEnd(7)} | ${facing}${board}, ${d.opponentsLive} live, pot ${d.potBB}bb, ${spr}, ${price}${role} -> ${did}${hand}`;
};
