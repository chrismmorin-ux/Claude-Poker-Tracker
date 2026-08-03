/**
 * decisionGeometryClosure.test.js — WS-333 Part 0.
 *
 * The load-bearing test here is the INERTNESS GUARD at the bottom. `closesAction` is only
 * worth adding as a geometry coordinate if it is not a restatement of something already in
 * the ladder — and `isIP` is `HIERARCHY_ORDER[1]`. A closure predicate that tracked position
 * would be a rename, the shrinkage loop's `totalN === lastAppliedN` guard would swallow it,
 * and the ablation would measure nothing while appearing to succeed.
 *
 * That is not hypothetical. WS-312 recorded exactly this failure in `teachableArmsProbe.mjs`:
 * closure was derived from a callback that structurally could not fire on a closing action,
 * every check was classified as check-OOP, and two arms scored bit-identically. The guard
 * pattern is copied from that file's fix.
 */

import { describe, it, expect } from 'vitest';

import { PRIMITIVE_ACTIONS } from '../../src/constants/primitiveActions.js';
import {
  closesAction,
  sprFor,
  sprBandFor,
  sizeBucketFor,
  geometryKey,
  decisionGeometryFull,
} from '../backtest/decisionGeometry.mjs';
import { SPR_BAND_EDGES, getSPRZone } from '../../src/utils/pokerCore/sprBands.js';

/**
 * A 6-handed hand. Seats 1..6; seat 6 is the button, so seat 1 = SB, seat 2 = BB.
 * Blinds are POSTED, not actions — the adapter does the same, which is what makes the
 * "has not acted yet" test come out right preflop without special-casing the blinds.
 */
const handWith = (actions, seats = [1, 2, 3, 4, 5, 6]) => ({
  seatPlayers: Object.fromEntries(seats.map((s) => [String(s), `p${s}`])),
  gameState: {
    actionSequence: actions.map((a, i) => ({ order: i + 1, street: 'preflop', ...a })),
    blinds: { sb: 0.5, bb: 1 },
  },
  _backtest: { bb: 1, potBeforeByOrder: {}, stackBeforeByOrder: {} },
});

const F = PRIMITIVE_ACTIONS.FOLD;
const C = PRIMITIVE_ACTIONS.CALL;
const R = PRIMITIVE_ACTIONS.RAISE;
const B = PRIMITIVE_ACTIONS.BET;
const K = PRIMITIVE_ACTIONS.CHECK;

describe('closesAction — the SB/BB asymmetry, which is the whole point', () => {
  // BTN (seat 6) opens to 2.5. Folds to the blinds.
  const btnOpen = [
    { seat: 3, action: F }, { seat: 4, action: F }, { seat: 5, action: F },
    { seat: 6, action: R, amount: 2.5 },
  ];

  it('SB does NOT close the action — BB is still live behind it', () => {
    const hand = handWith(btnOpen);
    // SB decides at order 5.
    expect(closesAction(hand, 5, 'preflop', 1)).toBe(false);
  });

  it('BB DOES close the action once SB has folded', () => {
    const hand = handWith([...btnOpen, { seat: 1, action: F }]);
    expect(closesAction(hand, 6, 'preflop', 2)).toBe(true);
  });

  it('BB DOES close the action when SB merely calls', () => {
    const hand = handWith([...btnOpen, { seat: 1, action: C, amount: 2 }]);
    expect(closesAction(hand, 6, 'preflop', 2)).toBe(true);
  });

  it('SB still does not close even when everyone else has folded — BB remains', () => {
    // This is the case pot odds cannot see: SB is heads-up on price, but not on structure.
    const hand = handWith(btnOpen);
    expect(closesAction(hand, 5, 'preflop', 1)).toBe(false);
  });
});

describe('closesAction — the blinds are pending because they have not acted', () => {
  it('a BTN limp does not close the action, because BB has the option', () => {
    const hand = handWith([
      { seat: 3, action: F }, { seat: 4, action: F }, { seat: 5, action: F },
      { seat: 6, action: C, amount: 1 },
    ]);
    // BTN decides at order 4; SB and BB are both still to act.
    expect(closesAction(hand, 4, 'preflop', 6)).toBe(false);
  });

  it('an early-position open does not close the action', () => {
    const hand = handWith([]);
    expect(closesAction(hand, 1, 'preflop', 3)).toBe(false);
  });
});

describe('closesAction — a raise behind reopens it', () => {
  it('a seat that has acted but is no longer square is pending again', () => {
    // CO opens 2.5, BTN 3-bets to 8. CO is square-with-2.5 but owes 5.5 — still pending,
    // so BB facing the 3-bet does NOT close the action.
    const hand = handWith([
      { seat: 3, action: F }, { seat: 4, action: F },
      { seat: 5, action: R, amount: 2.5 },
      { seat: 6, action: R, amount: 8 },
      { seat: 1, action: F },
    ]);
    expect(closesAction(hand, 6, 'preflop', 2)).toBe(false);
  });

  it('folded seats do not keep the action open', () => {
    const hand = handWith([
      { seat: 3, action: F }, { seat: 4, action: F }, { seat: 5, action: F },
      { seat: 6, action: R, amount: 2.5 }, { seat: 1, action: F },
    ]);
    // Only BTN and BB remain; BB closes.
    expect(closesAction(hand, 6, 'preflop', 2)).toBe(true);
  });
});

describe('closesAction — postflop', () => {
  const postflop = (actions, seats = [1, 2, 6]) => ({
    seatPlayers: Object.fromEntries(seats.map((s) => [String(s), `p${s}`])),
    gameState: {
      actionSequence: actions.map((a, i) => ({ order: i + 1, street: 'flop', ...a })),
      blinds: { sb: 0.5, bb: 1 },
    },
    _backtest: { bb: 1 },
  });

  it('the last player to act on a checked-around street closes it — the check-back', () => {
    const hand = postflop([{ seat: 1, action: K }, { seat: 2, action: K }]);
    expect(closesAction(hand, 3, 'flop', 6)).toBe(true);
  });

  it('first to act does not close', () => {
    const hand = postflop([]);
    expect(closesAction(hand, 1, 'flop', 1)).toBe(false);
  });

  it('a caller in the middle does not close', () => {
    const hand = postflop([{ seat: 1, action: B, amount: 5 }]);
    expect(closesAction(hand, 2, 'flop', 2)).toBe(false);
  });

  it('the last caller facing a bet closes', () => {
    const hand = postflop([{ seat: 1, action: B, amount: 5 }, { seat: 2, action: C, amount: 5 }]);
    expect(closesAction(hand, 3, 'flop', 6)).toBe(true);
  });

  it('CALL amounts are increments, not totals — a caller must read as square', () => {
    // The adapter writes `amount: owed` for CALL and `amount: raiseTo` for BET/RAISE.
    // Treating the call's increment as a total would leave the caller below `highest` and
    // wrongly report the street as still open.
    const hand = postflop([
      { seat: 1, action: B, amount: 10 },
      { seat: 2, action: C, amount: 10 },
    ]);
    expect(closesAction(hand, 3, 'flop', 6)).toBe(true);
  });
});

describe('closesAction — degradation', () => {
  it('returns null when the seat set is unknown rather than guessing', () => {
    expect(closesAction({ gameState: { actionSequence: [] } }, 1, 'preflop', 1)).toBeNull();
  });
});

/**
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE INERTNESS GUARD.
 * ─────────────────────────────────────────────────────────────────────────────────────
 */
describe('closesAction is NOT a restatement of isIP', () => {
  it('produces preflop cases where closure and position disagree, in BOTH directions', () => {
    const btnOpen = [
      { seat: 3, action: F }, { seat: 4, action: F }, { seat: 5, action: F },
      { seat: 6, action: R, amount: 2.5 },
    ];

    // SB: out of position AND does not close.
    const sbCloses = closesAction(handWith(btnOpen), 5, 'preflop', 1);
    // BB (after SB folds): out of position AND DOES close.
    const bbCloses = closesAction(handWith([...btnOpen, { seat: 1, action: F }]), 6, 'preflop', 2);

    // Both seats are OOP preflop against a BTN open. If closure tracked position they would
    // be equal, the coordinate would be a rename of HIERARCHY_ORDER[1], and the shrinkage
    // loop would swallow it. They must differ.
    expect(sbCloses).toBe(false);
    expect(bbCloses).toBe(true);
    expect(sbCloses).not.toBe(bbCloses);
  });

  it('produces an IN-position seat that does NOT close, closing the other direction', () => {
    // BTN limps: in position, but SB and BB are still to act.
    const hand = handWith([
      { seat: 3, action: F }, { seat: 4, action: F }, { seat: 5, action: F },
      { seat: 6, action: C, amount: 1 },
    ]);
    expect(closesAction(hand, 4, 'preflop', 6)).toBe(false);
  });
});

describe('SPR banding — one definition, imported not duplicated', () => {
  it('sprBandFor agrees with the canonical getSPRZone', () => {
    for (const spr of [0.5, 1.9, 2, 3.9, 4, 7.9, 8, 12.9, 13, 50]) {
      expect(sprBandFor(spr)).toBe(getSPRZone(spr));
    }
  });

  it('bands on the documented edges', () => {
    expect(SPR_BAND_EDGES).toEqual([2, 4, 8, 13]);
    expect(sprBandFor(1.99)).toBe('micro');
    expect(sprBandFor(2)).toBe('low');
    expect(sprBandFor(13)).toBe('deep');
  });

  it('reports unknown rather than null so a cell key is always a string', () => {
    expect(sprBandFor(null)).toBe('unknown');
  });

  it('uses the pot INCLUDING the live bet, matching the shipped sprZone slice', () => {
    // stack 400, pot 200 (of which 100 is the live bet) → 2.0, not 4.0.
    expect(sprFor({ stackChips: 400, potChips: 200, enginePotChips: 100 })).toBe(2);
  });

  it('returns null on unusable geometry', () => {
    expect(sprFor({ stackChips: 400, potChips: 0 })).toBeNull();
    expect(sprFor(null)).toBeNull();
  });
});

describe('geometryKey', () => {
  it('is an object, not a delimited string', () => {
    // A colon-delimited geometry key would trip the repo-wide situationKey guard test, or
    // need an opt-out marker. Named fields need neither.
    const key = geometryKey({ sBucket: '33-66', sprBand: 'low', playersRemaining: 2, closes: true });
    expect(key).toEqual({
      sBucket: '33-66', sprBand: 'low', playersRemaining: 2, closesAction: true,
    });
  });

  it('fills unknowns explicitly rather than dropping fields', () => {
    expect(geometryKey({})).toEqual({
      sBucket: 'unknown', sprBand: 'unknown', playersRemaining: null, closesAction: null,
    });
  });

  it('keeps closesAction false distinguishable from unknown', () => {
    expect(geometryKey({ closes: false }).closesAction).toBe(false);
    expect(geometryKey({}).closesAction).toBeNull();
  });
});

describe('decisionGeometryFull', () => {
  it('derives every coordinate from ONE geometry object', () => {
    const hand = {
      seatPlayers: { 1: 'a', 2: 'b', 6: 'c' },
      gameState: {
        actionSequence: [{ order: 1, seat: 6, action: B, amount: 50, street: 'flop' }],
        blinds: { sb: 0.5, bb: 1 },
      },
      _backtest: {
        bb: 1,
        potBeforeByOrder: { 2: 150 },
        stackBeforeByOrder: { 2: 400 },
      },
    };
    const full = decisionGeometryFull(hand, 2, 'flop', 1);
    expect(full.potBB).toBe(150);
    expect(full.facingBetBB).toBe(50);
    expect(full.enginePotChips).toBe(100);
    expect(full.sizeBucket).toBe(sizeBucketFor(50, 150));
    expect(full.sprBand).toBe(sprBandFor(400 / 150));
    expect(full.closesAction).toBe(false); // seat 2 acts with seat 1 still behind
    expect(full.liveOpponents).toBe(2);
  });

  it('returns null when the underlying geometry is unusable', () => {
    expect(decisionGeometryFull({ gameState: { actionSequence: [] }, _backtest: {} }, 1, 'flop', 1))
      .toBeNull();
  });
});
