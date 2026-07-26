/**
 * phhAdapter.test.js — WS-273. Golden-file verification of the PHH → app-hand adapter.
 *
 * The adapter is load-bearing: every backtest number is only as faithful as the
 * hand records it emits. The golden case below (`hand = 26262271782`, six-handed
 * table with five dealt in) was traced by hand against the raw PHH source before
 * being written down — amounts, board, showdown seats and derived line tags all
 * verified independently of the implementation.
 *
 * Fixture is checked in (`fixtures/sample-hands.phhs`, six records from the
 * public MIT/CC-BY corpus) so the test is hermetic and does not depend on the
 * out-of-repo corpus clone.
 */

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PRIMITIVE_ACTIONS } from '../../src/constants/primitiveActions.js';
import { buildTimeline } from '../../src/utils/handAnalysis/handTimeline.js';
import { derivePreflopDecisions } from '../../src/utils/rangeEngine/lineTaxonomy.js';
import { getPositionName } from '../../src/utils/positionUtils.js';
import {
  parsePhhCards,
  appSeatForIndex,
  BUTTON_SEAT,
  toAppHand,
  iterPhhHands,
  iterAppHands,
  SKIP_REASONS,
} from '../backtest/phhAdapter.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, '..', 'backtest', 'fixtures', 'sample-hands.phhs');

const collect = async (gen) => {
  const out = [];
  for await (const x of gen) out.push(x);
  return out;
};

describe('parsePhhCards', () => {
  it('converts PHH letters to the app canonical suits', () => {
    expect(parsePhhCards('3c6hKc')).toEqual(['3♣', '6♥', 'K♣']);
    expect(parsePhhCards('As')).toEqual(['A♠']);
    expect(parsePhhCards('Td')).toEqual(['T♦']);
  });

  it('rejects malformed input rather than truncating a runout', () => {
    // Silently dropping half a board would corrupt every texture classification
    // downstream, so the parse must fail loudly instead.
    expect(parsePhhCards('3c6')).toBeNull();
    expect(parsePhhCards('1c')).toBeNull();
    expect(parsePhhCards('3x')).toBeNull();
    expect(parsePhhCards('')).toBeNull();
    expect(parsePhhCards('????')).toBeNull();
  });
});

describe('appSeatForIndex — seat embedding', () => {
  it('places SB, BB and the button on their exact app positions for every table size', () => {
    for (let n = 3; n <= 9; n++) {
      expect(getPositionName(appSeatForIndex(0, n), BUTTON_SEAT)).toBe('SB');
      expect(getPositionName(appSeatForIndex(1, n), BUTTON_SEAT)).toBe('BB');
      expect(getPositionName(appSeatForIndex(n - 1, n), BUTTON_SEAT)).toBe('BTN');
    }
  });

  it('right-aligns to the button so the seat before it is always the cutoff', () => {
    for (let n = 4; n <= 9; n++) {
      expect(getPositionName(appSeatForIndex(n - 2, n), BUTTON_SEAT)).toBe('CO');
    }
  });

  it('reproduces exact 9-max naming on a full table', () => {
    const names = Array.from({ length: 9 }, (_, i) =>
      getPositionName(appSeatForIndex(i, 9), BUTTON_SEAT));
    expect(names).toEqual(['SB', 'BB', 'UTG', 'UTG+1', 'MP1', 'MP2', 'HJ', 'CO', 'BTN']);
  });

  it('never collides two players onto one seat', () => {
    for (let n = 3; n <= 9; n++) {
      const seats = Array.from({ length: n }, (_, i) => appSeatForIndex(i, n));
      expect(new Set(seats).size).toBe(n);
      for (const s of seats) {
        expect(s).toBeGreaterThanOrEqual(1);
        expect(s).toBeLessThanOrEqual(9);
      }
    }
  });
});

describe('iterPhhHands', () => {
  it('reads every record in the fixture', async () => {
    const raws = await collect(iterPhhHands(FIXTURE));
    expect(raws).toHaveLength(6);
  });

  it('distinguishes `seats` from `seat_count` despite the shared prefix', async () => {
    // Prefix matching would assign one to the other depending on check order —
    // a silent corruption of the table-size dimension.
    const raws = await collect(iterPhhHands(FIXTURE));
    const fiveHanded = raws.find(r => r.handId === 26262271782);
    expect(fiveHanded.seats).toEqual([3, 4, 6, 1, 2]);
    expect(fiveHanded.seatCount).toBe(6);
    expect(fiveHanded.players).toHaveLength(5);
  });
});

describe('toAppHand — golden case (hand 26262271782)', () => {
  let hand;

  beforeAll(async () => {
    const raws = await collect(iterPhhHands(FIXTURE));
    const raw = raws.find(r => r.handId === 26262271782);
    const result = toAppHand(raw, { site: 'FTP', stakeLabel: '50NLH' });
    expect(result.skip).toBeUndefined();
    hand = result.hand;
  });

  it('seats five players right-aligned to the button', () => {
    expect(hand.gameState.dealerButtonSeat).toBe(9);
    expect(hand.seatPlayers).toEqual({
      1: 'GSig8Jfjwt/27vtX2aj++A',  // SB
      2: '4RBVgvVnd10+BFw+RmZzJg',  // BB
      7: 'SIVDQKHeFkTkskCkcpHMeQ',  // HJ
      8: 'tSOFJrIoODci1ouBZymq2A',  // CO
      9: 'pjjB4GvD2Uwwl9Bm+hZnWQ',  // BTN
    });
  });

  it('derives every action label and amount from betting state', () => {
    // Hand-traced from the raw PHH token list. Note the two derivations that
    // matter most: the preflop open is a RAISE (the big blind is a live bet),
    // and the BB's first flop action is a CHECK (nothing owed).
    expect(hand.gameState.actionSequence).toEqual([
      { order: 0, seat: 7, action: PRIMITIVE_ACTIONS.FOLD, street: 'preflop' },
      { order: 1, seat: 8, action: PRIMITIVE_ACTIONS.RAISE, street: 'preflop', amount: 1.5 },
      { order: 2, seat: 9, action: PRIMITIVE_ACTIONS.CALL, street: 'preflop', amount: 1.5 },
      { order: 3, seat: 1, action: PRIMITIVE_ACTIONS.FOLD, street: 'preflop' },
      { order: 4, seat: 2, action: PRIMITIVE_ACTIONS.CALL, street: 'preflop', amount: 1 },
      { order: 5, seat: 2, action: PRIMITIVE_ACTIONS.CHECK, street: 'flop' },
      { order: 6, seat: 8, action: PRIMITIVE_ACTIONS.BET, street: 'flop', amount: 3 },
      { order: 7, seat: 9, action: PRIMITIVE_ACTIONS.FOLD, street: 'flop' },
      { order: 8, seat: 2, action: PRIMITIVE_ACTIONS.RAISE, street: 'flop', amount: 9.35 },
      { order: 9, seat: 8, action: PRIMITIVE_ACTIONS.CALL, street: 'flop', amount: 6.35 },
    ]);
  });

  it('uses the app amount convention: raise-to totals for aggression, owed for calls', () => {
    const byOrder = Object.fromEntries(hand.gameState.actionSequence.map(e => [e.order, e]));
    // The flop raise is recorded as the TOTAL (9.35), matching
    // recordSeatAction's `raiseTo`, while the call that answers it is the
    // INCREMENT actually owed (9.35 - 3 = 6.35).
    expect(byOrder[8].amount).toBe(9.35);
    expect(byOrder[9].amount).toBe(6.35);
    // Checks and folds carry no amount at all.
    expect(byOrder[0]).not.toHaveProperty('amount');
    expect(byOrder[5]).not.toHaveProperty('amount');
  });

  it('advances streets by cumulative board length, not deal count', () => {
    // The turn and river are dealt AFTER the showdown reveals in this hand
    // (short stack all-in). A deal counter would still work here, but board
    // length is what stays correct when a runout is dealt in one burst.
    expect(hand.gameState.communityCards).toEqual(['3♣', '6♥', 'K♣', 'A♣', '3♠']);
    expect(hand.gameState.currentStreet).toBe('river');
    const streets = new Set(hand.gameState.actionSequence.map(e => e.street));
    expect([...streets]).toEqual(['preflop', 'flop']);
  });

  it('maps showdown cards onto embedded seats', () => {
    expect(hand.gameState.showdownCards).toEqual({
      2: ['3♦', '6♣'],   // BB shows two pair
      8: ['T♠', 'K♥'],   // CO shows top pair
    });
  });

  it('accumulates the pot across all streets', () => {
    expect(hand.gameState.potSize).toBe(23.45);
    expect(hand.gameState.blinds).toEqual({ sb: 0.25, bb: 0.5 });
  });

  it('round-trips through the app timeline builder', () => {
    const timeline = buildTimeline(hand);
    expect(timeline).toHaveLength(10);
    expect(timeline.map(e => e.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(timeline.every(e => typeof e.seat === 'string')).toBe(true);
  });

  it('produces the correct WS-256 preflop line tags', () => {
    const preflop = buildTimeline(hand).filter(e => e.street === 'preflop');
    const tagFor = (seat) => derivePreflopDecisions(preflop, seat);

    // CO raises with only a fold in front — an open, first in.
    expect(tagFor(8)).toEqual([
      { parentAction: 'open', subAction: 'openFirstIn', facedRaise: false },
    ]);
    // BTN and BB both continue against that raise without re-raising.
    expect(tagFor(9)).toEqual([
      { parentAction: 'coldCall', subAction: null, facedRaise: true },
    ]);
    expect(tagFor(2)).toEqual([
      { parentAction: 'coldCall', subAction: null, facedRaise: true },
    ]);
    // HJ folds with no raise faced; SB folds facing one.
    expect(tagFor(7)).toEqual([
      { parentAction: 'fold', subAction: null, facedRaise: false },
    ]);
    expect(tagFor(1)).toEqual([
      { parentAction: 'fold', subAction: null, facedRaise: true },
    ]);
  });

  it('carries backtest provenance for slicing without polluting the engine shape', () => {
    expect(hand._backtest).toMatchObject({
      site: 'FTP', stakeLabel: '50NLH', bb: 0.5, dealtIn: 5, seatCount: 6,
    });
  });
});

describe('toAppHand — skips', () => {
  it('skips heads-up tables, consistent with WS-262 headline numbers', async () => {
    const raws = await collect(iterPhhHands(FIXTURE));
    const hu = raws.filter(r => r.players?.length === 2);
    expect(hu.length).toBeGreaterThan(0);
    for (const raw of hu) {
      expect(toAppHand(raw).skip).toBe(SKIP_REASONS.HEADS_UP);
    }
  });

  it('skips non-NLHE variants', () => {
    expect(toAppHand({ variant: 'FT', actions: [], blinds: [], players: [] }).skip)
      .toBe(SKIP_REASONS.NON_NT_VARIANT);
  });

  it('skips tables that cannot embed into nine seats', () => {
    const raw = {
      variant: 'NT',
      actions: [], blinds: [0.5, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      players: Array.from({ length: 10 }, (_, i) => `p${i}`),
    };
    expect(toAppHand(raw).skip).toBe(SKIP_REASONS.TOO_MANY_PLAYERS);
  });

  it('skips straddled and otherwise non-standard blind structures', () => {
    // A straddle is a distinct primitive in the app; folding it into the blinds
    // would corrupt every preflop line tag for the hand.
    const straddled = {
      variant: 'NT',
      actions: [], blinds: [0.25, 0.5, 1.0, 0, 0],
      players: ['a', 'b', 'c', 'd', 'e'],
    };
    expect(toAppHand(straddled).skip).toBe(SKIP_REASONS.NON_STANDARD_BLINDS);
  });

  it('tallies skip reasons instead of dropping hands silently', async () => {
    const stats = {};
    const hands = await collect(iterAppHands(FIXTURE, {}, stats));
    expect(stats.converted).toBe(hands.length);
    const total = Object.values(stats).reduce((s, v) => s + v, 0);
    expect(total).toBe(6); // every fixture record accounted for
  });
});
