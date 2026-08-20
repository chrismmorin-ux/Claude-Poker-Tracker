/**
 * appRecordAdapter — turn a PERSISTED APP HAND RECORD into the shape the labeller reads.
 *
 * WS-555 asked whether a Conduct Card can be built from an Ignition import or from a live-app
 * player, "not just the corpus", and stated as ESTABLISHED that the labeller's contract is
 * "the APP's own hand shape ... so a live-app player from tableview should already satisfy it
 * by construction". THAT IS FALSE, and it is false for the live app as much as for the
 * extension. Measured, not argued — a real captured hand handed to `labelDecisions` with only
 * its `gameState` passed through produced five rows, of which two were `mucked` and `won` (not
 * decisions at all) and all five carried `potBB: null, spr: null, sizeBucket: null,
 * boardCards: null`.
 *
 * The two shapes are genuinely different objects:
 *
 *   PERSISTED RECORD (both `saveHand` and the extension)   LABELLER HAND (phhAdapter output)
 *   ────────────────────────────────────────────────────   ─────────────────────────────────
 *   cardState.communityCards, padded to 5 with ''          gameState.communityCards, exact
 *   cardState.allPlayerCards                               gameState.showdownCards
 *   blinds live off-record (session / ignitionMeta)        gameState.blinds
 *   'mucked' / 'won' rows inside actionSequence            betting actions only
 *   dealerButtonSeat may be an EMPTY seat (dead button)    button is always a dealt-in seat
 *   nothing                                                _backtest.{bb, potBeforeByOrder,
 *                                                            stackBeforeByOrder, streetByOrder}
 *
 * THE LAST ROW IS THE ONE THAT BITES, because it fails silently. `decisionGeometry` returns
 * null with no `_backtest`, and the labeller's fallback is `geo?.bb || hand._backtest?.bb || 1`
 * — so every chip amount is divided by ONE and read as big blinds. A $4.40 raise at 0.10/0.25
 * becomes "4.4bb" instead of 17.6bb, and nothing anywhere says so. Refusing is the only honest
 * behaviour, so this module REQUIRES a positive big blind and skips the hand otherwise. It
 * never defaults one.
 *
 * DIRECTION OF THE CONVERSION IS THE POINT (accept criterion, WS-555): everything converts
 * INTO the labeller's shape. The labeller's contract is not widened to accept a second shape,
 * because a consumer that accepts two shapes is how three representations of one hand drift
 * apart — which is what this item found had already happened.
 *
 * MONEY. The app's convention is BET/RAISE `amount` = the seat's TOTAL commitment for the
 * street ("raise to"; `src/utils/recordSeatAction.js` emits `amount: raiseTo`) and CALL
 * `amount` = the INCREMENT owed. The corpus uses the same one (`decisionGeometry.mjs` header).
 * Ignition's wire speaks increments; the extension now converts at capture time
 * (`hand-state-machine.js` `_recordAction`). `AMOUNT_CONVENTIONS.INCREMENT` remains available
 * here for any source that has not, and for testing that the gate below actually fires.
 */

import { PRIMITIVE_ACTIONS } from '../../src/constants/primitiveActions.js';

/** The streets a decision can happen on. 'showdown' is a result, not a decision. */
const BETTING_STREETS = new Set(['preflop', 'flop', 'turn', 'river']);

/** Rows that ride inside actionSequence but are not choices. */
const NOT_A_DECISION = new Set(['mucked', 'won', 'postSmallBlind', 'postBigBlind', 'post', 'ante']);

const AGGRESSIVE = new Set([PRIMITIVE_ACTIONS.BET, PRIMITIVE_ACTIONS.RAISE]);

export const AMOUNT_CONVENTIONS = Object.freeze({
  /** BET/RAISE = total street commitment, CALL = increment. The app and the corpus. */
  STREET_TOTAL: 'street-total',
  /** Every amount is the chips put in now. The raw Ignition wire. */
  INCREMENT: 'increment',
});

export const ADAPT_SKIPS = Object.freeze({
  MALFORMED: 'malformed',
  NO_ACTIONS: 'no-betting-actions',
  NO_SEATS: 'no-seat-players',
  /**
   * No usable big blind. NOT a defaultable condition — see the header. Real captures hit
   * this: some hands in `spike-data/captures/` carry `blinds.sb = 0` because the blind frame
   * for that seat was never seen, and a hand whose stakes are unknown cannot be priced.
   */
  NO_BLINDS: 'no-blinds',
  BUTTON_UNRESOLVABLE: 'button-unresolvable',
  /**
   * A BET or RAISE that does not exceed the standing commitment on its street. Under the
   * declared convention that is arithmetically impossible, so the record is speaking a
   * different one and every price derived from it would be wrong. This is the gate that
   * catches a source silently emitting increments — it fires on every multi-raise hand from
   * the Ignition captures if `protocol-adapter.js` reads `bet` on a raise instead of `raise`.
   */
  INCONSISTENT_AMOUNTS: 'inconsistent-amounts',
});

const round2 = (x) => Number(x.toFixed(2));

/**
 * Seat order starting after the button — over the WHOLE TABLE, then filtered to who is in.
 *
 * A DEAD BUTTON IS REAL AND THE CORPUS DOES NOT HAVE ONE. Ignition parks the button on an
 * empty seat when a player leaves, and 3 of the first 6 replayed capture hands do exactly
 * that. The labeller derives the blinds and every position from `occupied.indexOf(button)`,
 * which is -1 for a dead button — so position collapses to 'unknown' and the blinds are never
 * seeded, silently mispricing every preflop decision in the hand.
 *
 * Walking all `tableSeats` positions and then keeping the occupied ones reproduces the ring
 * the players actually acted in. `normalizeButton` then re-points the button at the last
 * occupied seat before the dead one, which is not a fudge: that seat is the one that acts
 * last preflop and last postflop, which is what being on the button means.
 */
export const ringFromButton = (occupiedSeats, button, tableSeats = 9) => {
  const occupied = new Set(occupiedSeats.map(Number));
  const ring = [];
  for (let i = 1; i <= tableSeats; i++) {
    const seat = ((Number(button) - 1 + i) % tableSeats) + 1;
    if (occupied.has(seat)) ring.push(seat);
  }
  return ring;
};

/** The occupied seat that is functionally on the button. Identity when the button is live. */
export const normalizeButton = (occupiedSeats, button, tableSeats = 9) => {
  const ring = ringFromButton(occupiedSeats, button, tableSeats);
  return ring.length ? ring[ring.length - 1] : null;
};

/**
 * Start-of-hand stacks from a live-app record's seat-stack ledger, or null.
 *
 * ADMISSIBILITY IS NOT OPTIONAL. `stackLedger` marks a carried value STALE after an orbit
 * precisely because a stale stack is not evidence, and SPR is the one coordinate that reads
 * it. A seat whose stack is inadmissible is simply absent from the result, which leaves
 * `stackBeforeByOrder` unset for its decisions and `spr` null — the labeller already handles
 * an unknown stack, and an unknown one is what this is.
 */
export const startingStacksFromRecord = (record) => {
  // The extension reconstructs these from the wire (`record-builder.deriveStartStacks`) and
  // they are already start-of-hand values, so there is no ledger provenance to weigh.
  const captured = record?.ignitionMeta?.startStacks;
  if (captured && typeof captured === 'object' && Object.keys(captured).length) {
    const fromWire = {};
    for (const [seat, amount] of Object.entries(captured)) {
      if (Number.isFinite(amount) && amount > 0) fromWire[seat] = amount;
    }
    if (Object.keys(fromWire).length) return fromWire;
  }

  const ledger = record?.gameState?.seatStacks;
  if (!ledger || typeof ledger !== 'object') return null;
  const atHand = Number(record?.gameState?.handNumber) || 0;
  const out = {};
  for (const [seat, entry] of Object.entries(ledger)) {
    if (!entry || !Number.isFinite(entry.amount) || entry.amount <= 0) continue;
    // A value observed more than an orbit ago is not a stack, it is a memory.
    const age = atHand - (Number(entry.observedAtHand) || 0);
    if (age < 0 || age > 9) continue;
    out[seat] = entry.amount;
  }
  return Object.keys(out).length ? out : null;
};

/**
 * @param {Object} record persisted hand record — `{ gameState, cardState, seatPlayers, ... }`
 * @param {Object} [opts]
 * @param {{sb:number, bb:number}} [opts.blinds] overrides `record.ignitionMeta.blinds`
 * @param {Object<string,number>} [opts.startingStacks] seat -> chips at the start of the hand
 * @param {string} [opts.amountConvention] one of AMOUNT_CONVENTIONS; defaults to STREET_TOTAL
 * @param {string|number} [opts.handId]
 * @param {string} [opts.site]
 * @param {string} [opts.stakeLabel]
 * @param {number} [opts.tableSeats]
 * @returns {{hand: Object}|{skip: string, detail?: string}}
 */
export const adaptAppRecord = (record, opts = {}) => {
  const {
    blinds: blindsOverride = null,
    startingStacks: stacksOverride = null,
    amountConvention = AMOUNT_CONVENTIONS.STREET_TOTAL,
    handId = null,
    site = null,
    stakeLabel = null,
    tableSeats = 9,
  } = opts;

  const g = record?.gameState;
  if (!g || typeof g !== 'object' || !Array.isArray(g.actionSequence)) {
    return { skip: ADAPT_SKIPS.MALFORMED };
  }

  const seatPlayers = { ...(record.seatPlayers || {}) };
  const occupied = Object.keys(seatPlayers).map(Number).filter(Number.isInteger).sort((a, b) => a - b);
  if (occupied.length < 3) return { skip: ADAPT_SKIPS.NO_SEATS, detail: `${occupied.length} seats` };

  const blinds = blindsOverride || record?.ignitionMeta?.blinds || null;
  const bb = Number(blinds?.bb);
  const sb = Number(blinds?.sb);
  if (!Number.isFinite(bb) || bb <= 0 || !Number.isFinite(sb) || sb <= 0) {
    return { skip: ADAPT_SKIPS.NO_BLINDS, detail: JSON.stringify(blinds) };
  }

  const button = normalizeButton(occupied, g.dealerButtonSeat, tableSeats);
  if (button == null) return { skip: ADAPT_SKIPS.BUTTON_UNRESOLVABLE };
  const ring = ringFromButton(occupied, button, tableSeats);
  const sbSeat = ring[0];
  const bbSeat = ring[1];

  const startingStacks = stacksOverride || startingStacksFromRecord(record);

  // ── the betting walk ────────────────────────────────────────────────────────────────────
  const source = [...g.actionSequence]
    .filter((e) => e && BETTING_STREETS.has(e.street) && !NOT_A_DECISION.has(e.action))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (!source.length) return { skip: ADAPT_SKIPS.NO_ACTIONS };

  const actionSequence = [];
  const potBeforeByOrder = {};
  const streetByOrder = {};
  const stackBeforeByOrder = {};
  const streetCommitted = { [sbSeat]: sb, [bbSeat]: bb };
  const totalCommitted = { [sbSeat]: sb, [bbSeat]: bb };
  let pot = sb + bb;
  let highest = bb;
  let street = 'preflop';
  let order = 0;

  for (const e of source) {
    if (e.street !== street) {
      street = e.street;
      for (const k of Object.keys(streetCommitted)) delete streetCommitted[k];
      highest = 0;
    }
    const seat = Number(e.seat);
    const mine = streetCommitted[seat] || 0;

    // The pot as it stood when this seat had to decide, and its own remaining stack —
    // recorded BEFORE the action is applied, exactly as phhAdapter does.
    potBeforeByOrder[order] = round2(pot);
    streetByOrder[order] = street;
    if (startingStacks && Number.isFinite(startingStacks[seat])) {
      stackBeforeByOrder[order] = round2(startingStacks[seat] - (totalCommitted[seat] || 0));
    }

    if (e.action === PRIMITIVE_ACTIONS.FOLD || e.action === PRIMITIVE_ACTIONS.CHECK) {
      actionSequence.push({ order: order++, seat, action: e.action, street });
      continue;
    }

    const raw = Number(e.amount);
    if (!Number.isFinite(raw) || raw <= 0) {
      return { skip: ADAPT_SKIPS.INCONSISTENT_AMOUNTS, detail: `${e.action} with no amount at order ${e.order}` };
    }

    // Normalise to the labeller's convention: aggressive actions carry the street total,
    // calls carry the increment.
    let increment;
    let total;
    if (AGGRESSIVE.has(e.action)) {
      total = amountConvention === AMOUNT_CONVENTIONS.INCREMENT ? mine + raw : raw;
      increment = total - mine;
      if (!(total > highest) || increment <= 0) {
        return {
          skip: ADAPT_SKIPS.INCONSISTENT_AMOUNTS,
          detail: `${e.action} to ${total} does not exceed standing ${highest} on ${street} (order ${e.order})`,
        };
      }
      highest = total;
      actionSequence.push({ order: order++, seat, action: e.action, street, amount: round2(total) });
    } else if (e.action === PRIMITIVE_ACTIONS.CALL) {
      // Both conventions agree that a call carries the increment.
      increment = raw;
      total = mine + increment;
      // A call may fall SHORT of the standing bet (all-in), but it may never exceed it.
      if (total > highest + 1e-9) {
        return {
          skip: ADAPT_SKIPS.INCONSISTENT_AMOUNTS,
          detail: `call to ${total} exceeds standing ${highest} on ${street} (order ${e.order})`,
        };
      }
      actionSequence.push({ order: order++, seat, action: e.action, street, amount: round2(increment) });
    } else {
      // straddle, or anything else carrying money — treat as a street total, like a raise.
      total = amountConvention === AMOUNT_CONVENTIONS.INCREMENT ? mine + raw : raw;
      increment = total - mine;
      if (increment <= 0) return { skip: ADAPT_SKIPS.INCONSISTENT_AMOUNTS, detail: `${e.action} at order ${e.order}` };
      highest = Math.max(highest, total);
      actionSequence.push({ order: order++, seat, action: e.action, street, amount: round2(total) });
    }

    streetCommitted[seat] = total;
    totalCommitted[seat] = (totalCommitted[seat] || 0) + increment;
    pot += increment;
  }

  // ── cards ───────────────────────────────────────────────────────────────────────────────
  // The record pads the board to five with '' — that padding is not a card, and a slice of
  // it would hand the board-texture analyser empty strings.
  const community = [];
  for (const c of record?.cardState?.communityCards || []) {
    if (typeof c !== 'string' || c === '') break;
    community.push(c);
  }

  const showdownCards = {};
  for (const [seat, cards] of Object.entries(record?.cardState?.allPlayerCards || {})) {
    if (Array.isArray(cards) && cards.length >= 2 && cards.every((c) => typeof c === 'string' && c !== '')) {
      showdownCards[seat] = [...cards];
    }
  }
  // Hero's own cards are known on every hand he saw, not only on the ones that went to
  // showdown — and hero is a seat like any other to the labeller.
  const hero = Number(g.mySeat);
  const hole = record?.cardState?.holeCards;
  if (Number.isInteger(hero) && Array.isArray(hole) && hole.length === 2
      && hole.every((c) => typeof c === 'string' && c !== '') && !showdownCards[hero]) {
    showdownCards[hero] = [...hole];
  }

  return {
    hand: {
      handId: handId ?? record?.ignitionMeta?.handNumber ?? record?.handDisplayId ?? null,
      seatPlayers,
      gameState: {
        actionSequence,
        dealerButtonSeat: button,
        mySeat: Number.isInteger(hero) ? hero : null,
        communityCards: community,
        showdownCards,
        currentStreet: street,
        potSize: round2(pot),
        blinds: { sb, bb },
      },
      _backtest: {
        site: site ?? record?.source ?? null,
        stakeLabel,
        day: null,
        bb,
        dealtIn: occupied.length,
        seatCount: occupied.length,
        playerIndexBySeat: Object.fromEntries(ring.map((s, i) => [s, i])),
        potBeforeByOrder,
        stackBeforeByOrder,
        streetByOrder,
        committedBySeat: Object.fromEntries(
          Object.entries(totalCommitted).map(([s, v]) => [s, round2(v)]),
        ),
      },
    },
  };
};
