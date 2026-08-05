/**
 * ladderAxes.test.js — WS-320.
 *
 * The axis definitions are where a separability study goes wrong QUIETLY. A limp rate whose
 * denominator includes the big blind is not a limp rate — it is a limp rate divided by how
 * often a player sat in the BB, and the between-player variance it produces is a seat
 * artifact that an overdispersion test will faithfully report as heterogeneity. Every test
 * here pins one such definition.
 *
 * These are hand-built action sequences in the shape `phhAdapter.toAppHand` emits, so the
 * tests assert against the same contract the corpus run consumes.
 */

import { describe, it, expect } from 'vitest';

import { PRIMITIVE_ACTIONS } from '../../src/constants/primitiveActions.js';
import {
  AXES,
  BB_SEAT,
  CONTROL_AXIS,
  LADDER_RUNGS,
  LadderTally,
  SB_SEAT,
  observationsFromHand,
} from '../backtest/ladderAxes.mjs';

const A = PRIMITIVE_ACTIONS;

/**
 * Build a hand in the adapter's shape. Seats follow the adapter's right-aligned embedding:
 * SB = 1, BB = 2, button = 9.
 */
const hand = (actions, { players = {}, board = ['2♣', '7♦', 'J♠'] } = {}) => ({
  handId: 'H1',
  seatPlayers: { 1: 'sb', 2: 'bb', 8: 'co', 9: 'btn', ...players },
  gameState: {
    actionSequence: actions.map((a, i) => ({ order: i, ...a })),
    dealerButtonSeat: 9,
    communityCards: board,
    showdownCards: {},
    currentStreet: 'flop',
    potSize: 10,
    blinds: { sb: 0.25, bb: 0.5 },
  },
  _backtest: { site: 'FTP', stakeLabel: '50NLH', bb: 0.5, dealtIn: 4 },
});

const pick = (obs, axis) => obs.filter((o) => o.axis === axis);

describe('limp rate', () => {
  it('counts a call in an unraised pot as a limp', () => {
    const obs = observationsFromHand(hand([
      { seat: 8, action: A.CALL, street: 'preflop', amount: 0.5 },
      { seat: 9, action: A.FOLD, street: 'preflop' },
    ]));
    const limps = pick(obs, 'limpRate');
    expect(limps).toEqual([
      { playerKey: 'FTP:co', axis: 'limpRate', hit: true },
      { playerKey: 'FTP:btn', axis: 'limpRate', hit: false },
    ]);
  });

  it('EXCLUDES the big blind from the denominator entirely', () => {
    // The BB owes nothing in an unraised pot, so it emits CHECK and can never limp. Leaving
    // it in the denominator would deflate every player in proportion to BB frequency — a
    // position artifact that reads as a real habit difference.
    const obs = observationsFromHand(hand([
      { seat: 8, action: A.CALL, street: 'preflop', amount: 0.5 },
      { seat: 9, action: A.FOLD, street: 'preflop' },
      { seat: SB_SEAT, action: A.CALL, street: 'preflop', amount: 0.25 },
      { seat: BB_SEAT, action: A.CHECK, street: 'preflop' },
    ]));
    const keys = pick(obs, 'limpRate').map((o) => o.playerKey);
    expect(keys).not.toContain('FTP:bb');
    expect(keys).toContain('FTP:sb');
  });

  it('counts an SB complete as a limp', () => {
    const obs = observationsFromHand(hand([
      { seat: SB_SEAT, action: A.CALL, street: 'preflop', amount: 0.25 },
    ]));
    expect(pick(obs, 'limpRate')).toEqual([
      { playerKey: 'FTP:sb', axis: 'limpRate', hit: true },
    ]);
  });

  it('stops counting once someone raises — a call facing a raise is not a limp', () => {
    const obs = observationsFromHand(hand([
      { seat: 8, action: A.RAISE, street: 'preflop', amount: 1.5 },
      { seat: 9, action: A.CALL, street: 'preflop', amount: 1.5 },
    ]));
    const limps = pick(obs, 'limpRate');
    expect(limps).toHaveLength(1);
    expect(limps[0]).toMatchObject({ playerKey: 'FTP:co', hit: false });
  });
});

describe('3-bet rate', () => {
  it('counts a raise facing exactly one raise, and not the opener', () => {
    const obs = observationsFromHand(hand([
      { seat: 8, action: A.RAISE, street: 'preflop', amount: 1.5 },   // the open — no opportunity
      { seat: 9, action: A.RAISE, street: 'preflop', amount: 5 },     // the 3-bet
    ]));
    const three = pick(obs, 'threeBetRate');
    expect(three).toEqual([{ playerKey: 'FTP:btn', axis: 'threeBetRate', hit: true }]);
  });

  it('counts a fold or call facing a single raise as an opportunity taken negatively', () => {
    const obs = observationsFromHand(hand([
      { seat: 8, action: A.RAISE, street: 'preflop', amount: 1.5 },
      { seat: 9, action: A.CALL, street: 'preflop', amount: 1.5 },
      { seat: SB_SEAT, action: A.FOLD, street: 'preflop' },
    ]));
    expect(pick(obs, 'threeBetRate')).toEqual([
      { playerKey: 'FTP:btn', axis: 'threeBetRate', hit: false },
      { playerKey: 'FTP:sb', axis: 'threeBetRate', hit: false },
    ]);
  });

  it('does not count a 4-bet spot as a 3-bet opportunity', () => {
    const obs = observationsFromHand(hand([
      { seat: 8, action: A.RAISE, street: 'preflop', amount: 1.5 },
      { seat: 9, action: A.RAISE, street: 'preflop', amount: 5 },
      { seat: SB_SEAT, action: A.RAISE, street: 'preflop', amount: 15 },  // facing TWO raises
    ]));
    const keys = pick(obs, 'threeBetRate').map((o) => o.playerKey);
    expect(keys).toEqual(['FTP:btn']);
  });
});

describe('c-bet rate', () => {
  it('counts the last preflop raiser betting a flop that was checked to them', () => {
    const obs = observationsFromHand(hand([
      { seat: 8, action: A.RAISE, street: 'preflop', amount: 1.5 },
      { seat: 9, action: A.CALL, street: 'preflop', amount: 1.5 },
      { seat: 8, action: A.BET, street: 'flop', amount: 2 },
    ]));
    expect(pick(obs, 'cbetRate')).toEqual([
      { playerKey: 'FTP:co', axis: 'cbetRate', hit: true },
    ]);
  });

  it('counts a check by the aggressor as a missed c-bet, not as no opportunity', () => {
    const obs = observationsFromHand(hand([
      { seat: 8, action: A.RAISE, street: 'preflop', amount: 1.5 },
      { seat: 9, action: A.CALL, street: 'preflop', amount: 1.5 },
      { seat: 8, action: A.CHECK, street: 'flop' },
      { seat: 9, action: A.CHECK, street: 'flop' },
    ]));
    expect(pick(obs, 'cbetRate')).toEqual([
      { playerKey: 'FTP:co', axis: 'cbetRate', hit: false },
    ]);
  });

  it('does NOT count a spot where the aggressor was donked into', () => {
    // Facing a lead is a different decision. Folding it into the same rate mixes two
    // populations of spot and the resulting variance is a mixture artifact.
    const obs = observationsFromHand(hand([
      { seat: 8, action: A.RAISE, street: 'preflop', amount: 1.5 },
      { seat: 9, action: A.CALL, street: 'preflop', amount: 1.5 },
      { seat: 9, action: A.BET, street: 'flop', amount: 2 },
      { seat: 8, action: A.CALL, street: 'flop', amount: 2 },
    ]));
    expect(pick(obs, 'cbetRate')).toHaveLength(0);
  });

  it('gives no c-bet opportunity in a limped pot — there is no preflop aggressor', () => {
    const obs = observationsFromHand(hand([
      { seat: 8, action: A.CALL, street: 'preflop', amount: 0.5 },
      { seat: BB_SEAT, action: A.CHECK, street: 'preflop' },
      { seat: BB_SEAT, action: A.CHECK, street: 'flop' },
      { seat: 8, action: A.BET, street: 'flop', amount: 1 },
    ]));
    expect(pick(obs, 'cbetRate')).toHaveLength(0);
    // …but both flop decisions still count toward the control axis.
    expect(pick(obs, 'flopBetFreq')).toHaveLength(2);
  });

  it('counts only ONE c-bet observation per hand even when action comes back around', () => {
    const obs = observationsFromHand(hand([
      { seat: 8, action: A.RAISE, street: 'preflop', amount: 1.5 },
      { seat: 9, action: A.CALL, street: 'preflop', amount: 1.5 },
      { seat: 8, action: A.BET, street: 'flop', amount: 2 },
      { seat: 9, action: A.RAISE, street: 'flop', amount: 8 },
      { seat: 8, action: A.CALL, street: 'flop', amount: 6 },
    ]));
    expect(pick(obs, 'cbetRate')).toHaveLength(1);
  });
});

describe('control axes', () => {
  it('flop bet frequency counts every unfaced flop decision, bet or check', () => {
    const obs = observationsFromHand(hand([
      { seat: 8, action: A.RAISE, street: 'preflop', amount: 1.5 },
      { seat: 9, action: A.CALL, street: 'preflop', amount: 1.5 },
      { seat: 8, action: A.CHECK, street: 'flop' },
      { seat: 9, action: A.BET, street: 'flop', amount: 2 },
    ]));
    expect(pick(obs, CONTROL_AXIS)).toEqual([
      { playerKey: 'FTP:co', axis: 'flopBetFreq', hit: false },
      { playerKey: 'FTP:btn', axis: 'flopBetFreq', hit: true },
    ]);
  });

  it('excludes a decision that FACES a bet — that is a call/fold, not a bet frequency', () => {
    const obs = observationsFromHand(hand([
      { seat: 8, action: A.RAISE, street: 'preflop', amount: 1.5 },
      { seat: 9, action: A.CALL, street: 'preflop', amount: 1.5 },
      { seat: 8, action: A.BET, street: 'flop', amount: 2 },
      { seat: 9, action: A.CALL, street: 'flop', amount: 2 },
    ]));
    const keys = pick(obs, CONTROL_AXIS).map((o) => o.playerKey);
    expect(keys).toEqual(['FTP:co']);
  });

  it('the non-aggressor control is DISJOINT from the c-bet axis', () => {
    // This is the whole reason the variant exists: cbetRate is a strict subset of
    // flopBetFreq, so their correlation is guaranteed by construction and answers nothing.
    const obs = observationsFromHand(hand([
      { seat: 8, action: A.RAISE, street: 'preflop', amount: 1.5 },
      { seat: 9, action: A.CALL, street: 'preflop', amount: 1.5 },
      { seat: 8, action: A.BET, street: 'flop', amount: 2 },
    ]));
    expect(pick(obs, 'cbetRate').map((o) => o.playerKey)).toEqual(['FTP:co']);
    expect(pick(obs, 'flopBetFreqNonPfa')).toHaveLength(0);
    // …while the overlapping control DOES contain it.
    expect(pick(obs, 'flopBetFreq').map((o) => o.playerKey)).toEqual(['FTP:co']);
  });
});

describe('LadderTally', () => {
  it('keeps observations in play order so a temporal split is possible', () => {
    const tally = new LadderTally();
    tally.addHand(hand([{ seat: 8, action: A.CALL, street: 'preflop', amount: 0.5 }]));
    tally.addHand(hand([{ seat: 8, action: A.FOLD, street: 'preflop' }]));
    tally.addHand(hand([{ seat: 8, action: A.CALL, street: 'preflop', amount: 0.5 }]));

    const row = tally.rows().limpRate.find((r) => r.playerKey === 'FTP:co');
    expect(row.bits).toEqual([true, false, true]);
    expect(row).toMatchObject({ k: 2, n: 3 });
  });

  it('scopes player identity to the SITE, so two sites cannot merge into one fake player', () => {
    const tally = new LadderTally();
    const h1 = hand([{ seat: 8, action: A.CALL, street: 'preflop', amount: 0.5 }]);
    const h2 = hand([{ seat: 8, action: A.CALL, street: 'preflop', amount: 0.5 }]);
    h2._backtest = { ...h2._backtest, site: 'PS' };
    tally.addHand(h1).addHand(h2);

    const keys = tally.rows().limpRate.map((r) => r.playerKey).sort();
    expect(keys).toEqual(['FTP:co', 'PS:co']);
  });
});

describe('axis metadata', () => {
  it('every axis states its conditioning set — a rate without one cannot be reported', () => {
    for (const axis of Object.values(AXES)) {
      expect(axis.conditioning.length).toBeGreaterThan(10);
      expect(axis.numerator.length).toBeGreaterThan(5);
      expect(['lower', 'higher']).toContain(axis.studiedDirection);
    }
  });

  it('the ladder rungs are the three candidates, in the founder\'s stated order', () => {
    expect(LADDER_RUNGS).toEqual(['limpRate', 'threeBetRate', 'cbetRate']);
    expect(LADDER_RUNGS.map((id) => AXES[id].rung)).toEqual([1, 2, 3]);
    expect(AXES[CONTROL_AXIS].role).toBe('control');
  });
});
