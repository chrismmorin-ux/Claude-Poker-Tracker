/**
 * shared/record-builder.js — Stateless hand record builder
 *
 * Extracted from HandStateMachine.buildRecord(). Takes accumulated state
 * and produces a validated hand record. Pure function, no side effects.
 *
 * IT IS ALSO WHERE THE MONEY CHANGES CONVENTION (WS-555). The wire reports an INCREMENT for
 * every action — chips in now. The main app's hand record reports a BET/RAISE `amount` as the
 * seat's TOTAL commitment for the street ("raise to"; `src/utils/recordSeatAction.js` emits
 * `amount: raiseTo`) and a CALL `amount` as the increment owed. This file's whole job is to
 * hand the app a record in the app's schema, so it is the right and only place to convert.
 */

import * as handFormat from './hand-format.js';

const NUM_SEATS = 9;

const BETTING_STREETS = new Set(['preflop', 'flop', 'turn', 'river']);
const AGGRESSIVE = new Set(['bet', 'raise']);

/**
 * Seat order starting after the button, over the whole table, filtered to who is dealt in.
 *
 * Written over all nine positions rather than over the occupied list because IGNITION PARKS
 * THE BUTTON ON AN EMPTY SEAT when a player leaves — 3 of the first 6 hands replayed from
 * `spike-data/captures/` do exactly that. Indexing the occupied list by the button seat
 * returns -1 for those hands, which would put the blinds on the wrong players.
 */
const ringFromButton = (occupiedSeats, button) => {
  const occupied = new Set(occupiedSeats.map(Number));
  const ring = [];
  for (let i = 1; i <= NUM_SEATS; i++) {
    const seat = ((Number(button) - 1 + i) % NUM_SEATS) + 1;
    if (occupied.has(seat)) ring.push(seat);
  }
  return ring;
};

/**
 * Rewrite BET/RAISE amounts from the wire's increment to the app's total street commitment.
 *
 * DERIVED FROM THE FINISHED HAND, NOT ACCUMULATED AS FRAMES ARRIVE. An earlier attempt kept a
 * running commitment inside the state machine, seeded from the CO_BLIND_INFO frames. Replaying
 * the four real captures showed that seed was EMPTY at the first action of all 109 hands: the
 * blind frames arrive before the hand-start message and `_applyHandStart` calls `reset()`. So
 * every blind who later raised was recorded short by its own blind, and every seat behind it
 * then looked like it had called more than the standing bet. Here the button, the seat set and
 * the blinds are all known at once and none of it depends on frame order.
 *
 * A CALL IS LEFT ALONE on purpose — the increment is what the app's convention wants for a
 * call, so both conventions already agree about it.
 *
 * Returns the sequence unchanged when the blinds or the button are unknown. That is not a
 * silent fallback: an unconverted sequence fails the arithmetic gate in
 * `scripts/backtest/appRecordAdapter.mjs` the moment a blind raises, which is exactly the
 * hand it would be wrong about.
 */
export const toStreetTotals = (actionSequence, { blinds, dealerSeat, seatPlayers }) => {
  const seq = Array.isArray(actionSequence) ? actionSequence : [];
  const sb = Number(blinds?.sb);
  const bb = Number(blinds?.bb);
  const occupied = Object.keys(seatPlayers || {}).map(Number).filter(Number.isInteger);
  if (!(sb > 0) || !(bb > 0) || !occupied.length || !Number.isFinite(Number(dealerSeat))) return seq;

  const ring = ringFromButton(occupied, dealerSeat);
  if (ring.length < 3) return seq;

  const committed = { [ring[0]]: sb, [ring[1]]: bb };
  let street = 'preflop';

  return seq.map((e) => {
    if (!e || !BETTING_STREETS.has(e.street)) return e;
    if (e.street !== street) {
      street = e.street;
      for (const k of Object.keys(committed)) delete committed[k];
    }
    if (typeof e.amount !== 'number') return e;
    const seat = Number(e.seat);
    const total = (committed[seat] || 0) + e.amount;
    committed[seat] = total;
    if (!AGGRESSIVE.has(e.action)) return e;
    return { ...e, amount: Number(total.toFixed(2)) };
  });
};

/**
 * START-OF-HAND stacks, reconstructed from the first stack reading of each seat.
 *
 * `account` on a CO_SELECT_INFO is the stack AFTER the action it rode in on, so a seat's
 * start-of-hand stack is that reading plus everything the seat had already put in — the
 * blind it posted, plus every increment up to and including that action.
 *
 * WHY THIS MATTERS ENOUGH TO RECONSTRUCT. SPR is one of the four geometry coordinates a
 * decision is keyed on (`scripts/backtest/decisionGeometry.mjs`), and it is the only one that
 * needs a stack. Without a start-of-hand stack every Ignition decision carries `spr: null`,
 * so an Ignition-built Conduct Card is blind to stack depth — the axis that separates "he
 * calls wide" from "he calls wide when there is nothing behind it".
 *
 * A seat that never acted has no reading and is simply absent. Absent is correct: the
 * consumer reads a missing stack as unknown, and unknown is what it is.
 *
 * @param {Array} sequence action sequence ALREADY in street-total convention
 * @param {Object} stackObs seat -> { order, stack }
 * @param {{sb:number,bb:number}} blinds
 * @param {number} dealerSeat
 * @param {Object} seatPlayers
 */
export const deriveStartStacks = (sequence, stackObs, { blinds, dealerSeat, seatPlayers }) => {
  const obs = stackObs || {};
  if (!Object.keys(obs).length) return {};
  const sb = Number(blinds?.sb);
  const bb = Number(blinds?.bb);
  const occupied = Object.keys(seatPlayers || {}).map(Number).filter(Number.isInteger);
  const ring = occupied.length && Number.isFinite(Number(dealerSeat))
    ? ringFromButton(occupied, dealerSeat) : [];

  // What each seat has put in, accumulated forward. Seeded with the posted blinds, which are
  // money in the pot and never appear as actions.
  const contributed = {};
  if (ring.length >= 2 && sb > 0 && bb > 0) {
    contributed[ring[0]] = sb;
    contributed[ring[1]] = bb;
  }
  const streetCommitted = { ...contributed };

  const out = {};
  const pending = new Map(
    Object.entries(obs).map(([seat, o]) => [Number(o?.order), { seat: Number(seat), stack: o?.stack }]),
  );

  let street = 'preflop';
  for (const e of Array.isArray(sequence) ? sequence : []) {
    if (!e || !BETTING_STREETS.has(e.street)) continue;
    if (e.street !== street) {
      street = e.street;
      for (const k of Object.keys(streetCommitted)) delete streetCommitted[k];
    }
    const seat = Number(e.seat);
    if (typeof e.amount === 'number') {
      const before = streetCommitted[seat] || 0;
      // Aggressive amounts are street totals by now; a call is still an increment.
      const total = AGGRESSIVE.has(e.action) ? e.amount : before + e.amount;
      const increment = total - before;
      streetCommitted[seat] = total;
      contributed[seat] = (contributed[seat] || 0) + increment;
    }
    const hit = pending.get(Number(e.order));
    if (hit && hit.seat === seat && Number.isFinite(hit.stack)) {
      out[seat] = Number((hit.stack + (contributed[seat] || 0)).toFixed(2));
      pending.delete(Number(e.order));
    }
  }
  return out;
};

/**
 * Build a hand record from accumulated HSM state.
 *
 * @param {Object} state - Accumulated state from HSM
 * @param {string|null} state.currentStreet
 * @param {number|null} state.dealerSeat
 * @param {number|null} state.heroSeat
 * @param {Array} state.actionSequence
 * @param {Array} state.communityCards
 * @param {Array} state.holeCards
 * @param {Object} state.allPlayerCards
 * @param {Set} state.activeSeats
 * @param {Object} state.seatPlayers
 * @param {string|number} state.connId
 * @param {string|number|null} state.handNumber
 * @param {Object} state.blinds - { sb, bb }
 * @param {number} state.ante
 * @param {*} state.gameType
 * @param {Object} state.stacks
 * @param {number} state.pot
 * @param {Array} state.potDistribution
 * @param {Array} state.winners
 * @param {Object} state.seatDisplayMap
 * @returns {{ record: Object|null, validation: { valid: boolean, errors: string[] } }}
 */
export const buildRecordFromState = (state) => {
  const {
    currentStreet, dealerSeat, heroSeat, actionSequence, stackObs,
    communityCards, holeCards, allPlayerCards, activeSeats,
    seatPlayers, connId, handNumber, blinds, ante, gameType,
    stacks, pot, potDistribution, winners, seatDisplayMap,
  } = state;

  // Determine final street
  let finalStreet = currentStreet || 'preflop';
  if (allPlayerCards && Object.keys(allPlayerCards).length > 0) {
    finalStreet = 'showdown';
  }

  // Absent seats
  const activeSeatSet = activeSeats instanceof Set ? activeSeats : new Set(activeSeats);
  const maxActive = activeSeatSet.size > 0 ? Math.max(...activeSeatSet) : 0;
  const absentSeats = [];
  if (maxActive <= NUM_SEATS) {
    for (let s = 1; s <= NUM_SEATS; s++) {
      if (!activeSeatSet.has(s)) absentSeats.push(s);
    }
  }

  // Mark hero in seatPlayers
  const finalSeatPlayers = { ...seatPlayers };
  if (heroSeat) {
    finalSeatPlayers[heroSeat] = 'hero';
  }

  // A hand with no known hero seat is still a hand. Measured on the four real
  // captures: 11 of 117 hands (9.4%) were discarded here, and EVERY ONE was the
  // first hand on a table connection -- the hand already in progress when capture
  // attached. Under the cold-read regime that is the scarcest data there is: the
  // opening hand of observation on a villain we may never see again.
  //
  // What must never happen is a GUESSED seat -- falling back to seat 1 puts hero in
  // a seat he was not in and corrupts every positional read downstream. So the seat
  // stays explicitly null and the hand is marked `heroInvolved: false`. Hero-centric
  // analysis skips it; villain observation (actions, showdown cards, stack deltas)
  // is kept. Null is a fact here, not a missing value to be filled.
  //
  // The one thing still refused is an EMPTY observation: no hero AND no actions is
  // noise, not a hand.
  const heroInvolved = Boolean(heroSeat);
  if (!heroInvolved && (!Array.isArray(actionSequence) || actionSequence.length === 0)) {
    return {
      record: null,
      validation: {
        valid: false,
        errors: ['no hero seat and no observed actions — nothing to record'],
      },
    };
  }

  const streetTotalled = toStreetTotals(actionSequence, {
    blinds, dealerSeat: dealerSeat || 1, seatPlayers: finalSeatPlayers,
  });

  const record = handFormat.buildHandRecord({
    currentStreet: finalStreet,
    dealerButtonSeat: dealerSeat || 1,
    mySeat: heroSeat ?? null,
    actionSequence: streetTotalled,
    absentSeats,
    communityCards,
    holeCards,
    allPlayerCards,
    seatPlayers: finalSeatPlayers,
    tableId: `table_${connId}`,
    ignitionMeta: {
      handNumber,
      blinds: { ...blinds },
      ante,
      gameType,
      finalStacks: { ...stacks },
      // Start-of-hand stacks — the SPR numerator. `finalStacks` cannot serve: it is the
      // stack after the hand resolved, which is a different number on every hand that
      // involved money.
      startStacks: deriveStartStacks(streetTotalled, stackObs, {
        blinds, dealerSeat: dealerSeat || 1, seatPlayers: finalSeatPlayers,
      }),
      pot,
      potDistribution,
      winners,
      // `heroInvolved: false` marks an OBSERVED hand -- captured for villain policy,
      // with no hero decision in it. Consumers keyed on hero must skip on this flag
      // rather than inferring from a null seat.
      heroInvolved,
      heroSeatConfidence: heroInvolved ? (state.heroSeatConfidence || 'unknown') : 'none',
      seatDisplayMap: seatDisplayMap && Object.keys(seatDisplayMap).length > 0
        ? { ...seatDisplayMap } : undefined,
    },
  });

  const validation = handFormat.validateHandRecord(record);
  return { record: validation.valid ? record : null, validation };
};
